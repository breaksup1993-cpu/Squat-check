"use client";

import { useEffect, useRef, useState } from "react";
import PoseOverlay, { type PoseOverlayHandle } from "@/components/PoseOverlay";
import { createPoseLandmarker, detectPoseOnVideoFrame, getPrimaryPose } from "@/lib/pose";
import { analyzeSquatSession, type AnalysisOutcome, type PoseFrame } from "@/lib/squatAnalysis";

interface AnalysisRunnerProps {
  videoUrl: string;
  onComplete: (outcome: AnalysisOutcome) => void;
  onError: (message: string) => void;
}

type Phase = "loading-model" | "processing" | "finishing";

// Frames are sampled by seeking rather than by playing the video in real
// time. Real-time playback (via requestVideoFrameCallback) races CPU-bound
// inference against the video clock: whenever a frame takes longer to
// process than the playback interval, frames get silently skipped, and
// *which* frames get skipped depends on machine load and timing jitter.
// That made rep counts and flagged checks vary between runs of the exact
// same video. Seeking to each timestamp and waiting for it to land makes
// every run process the same frames in the same order, regardless of how
// fast the device is.
const SAMPLE_FPS = 15;
const SAMPLE_STEP_MS = 1000 / SAMPLE_FPS;

function seekTo(video: HTMLVideoElement, timeSeconds: number): Promise<void> {
  return new Promise((resolve) => {
    if (video.currentTime === timeSeconds) {
      resolve();
      return;
    }
    const onSeeked = () => {
      video.removeEventListener("seeked", onSeeked);
      resolve();
    };
    video.addEventListener("seeked", onSeeked);
    video.currentTime = timeSeconds;
  });
}

export default function AnalysisRunner({ videoUrl, onComplete, onError }: AnalysisRunnerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<PoseOverlayHandle>(null);
  const [dims, setDims] = useState({ width: 640, height: 360 });
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<Phase>("loading-model");

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let cancelled = false;

    const onLoadedMetadata = () => {
      setDims({ width: video.videoWidth || 640, height: video.videoHeight || 360 });
    };
    const onVideoError = () => {
      if (cancelled) return;
      onError("לא ניתן לטעון את קובץ הווידאו. ודאו שהקובץ תקין ונסו שוב.");
    };
    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("error", onVideoError);

    (async () => {
      try {
        const landmarker = await createPoseLandmarker("VIDEO");
        if (cancelled) {
          landmarker.close();
          return;
        }

        try {
          if (video.readyState < 1) {
            await new Promise<void>((resolve) => {
              video.addEventListener("loadedmetadata", () => resolve(), { once: true });
            });
          }
          if (cancelled) return;

          setPhase("processing");
          const durationMs = video.duration * 1000;
          const frames: PoseFrame[] = [];

          for (let timestampMs = 0; timestampMs <= durationMs; timestampMs += SAMPLE_STEP_MS) {
            if (cancelled) return;
            await seekTo(video, timestampMs / 1000);
            if (cancelled) return;

            const result = detectPoseOnVideoFrame(landmarker, video, timestampMs);
            const pose = getPrimaryPose(result);
            frames.push({ timestampMs, landmarks: pose });
            overlayRef.current?.draw(pose);
            setProgress(durationMs > 0 ? Math.min(1, timestampMs / durationMs) : 1);
          }

          if (cancelled) return;
          setPhase("finishing");
          onComplete(analyzeSquatSession(frames));
        } finally {
          landmarker.close();
        }
      } catch (err) {
        console.error("AnalysisRunner error:", err);
        if (!cancelled) {
          onError("לא ניתן היה לטעון את מנוע זיהוי התנועה. בדקו את החיבור לרשת ונסו שוב.");
        }
      }
    })();

    return () => {
      cancelled = true;
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("error", onVideoError);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoUrl]);

  return (
    <div>
      <div
        className="relative mx-auto max-w-md overflow-hidden rounded-xl bg-black"
        style={{ aspectRatio: `${dims.width} / ${dims.height}` }}
      >
        <video
          ref={videoRef}
          src={videoUrl}
          muted
          playsInline
          className="h-full w-full object-contain"
        />
        <PoseOverlay
          ref={overlayRef}
          width={dims.width}
          height={dims.height}
          className="pointer-events-none absolute inset-0 h-full w-full"
        />
      </div>
      <div className="mx-auto mt-4 max-w-md">
        <div className="h-2 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
          <div
            className="h-full bg-blue-600 transition-[width] duration-150"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
        <p className="mt-2 text-center text-sm text-foreground/70">
          {phase === "loading-model" && "טוען מודל זיהוי תנועה…"}
          {phase === "processing" && "מנתח את הווידאו…"}
          {phase === "finishing" && "מסכם תוצאות…"}
        </p>
      </div>
    </div>
  );
}
