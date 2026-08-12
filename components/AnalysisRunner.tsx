"use client";

import { useEffect, useRef, useState } from "react";
import PoseOverlay, { type PoseOverlayHandle } from "@/components/PoseOverlay";
import {
  createPoseLandmarker,
  detectPoseOnVideoFrame,
  getPrimaryPose,
  type PoseLandmarker,
} from "@/lib/pose";
import { analyzeSquatSession, type AnalysisOutcome, type PoseFrame } from "@/lib/squatAnalysis";

interface AnalysisRunnerProps {
  videoUrl: string;
  onComplete: (outcome: AnalysisOutcome) => void;
  onError: (message: string) => void;
}

type Phase = "loading-model" | "processing" | "finishing";

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
    let finished = false;
    let rvfcHandle: number | null = null;
    let rafHandle: number | null = null;
    let landmarker: PoseLandmarker | null = null;
    const frames: PoseFrame[] = [];

    const onLoadedMetadata = () => {
      setDims({ width: video.videoWidth || 640, height: video.videoHeight || 360 });
    };

    const finish = () => {
      if (finished) return;
      finished = true;
      setPhase("finishing");
      landmarker?.close();
      landmarker = null;
      onComplete(analyzeSquatSession(frames));
    };

    const onVideoError = () => {
      if (cancelled) return;
      onError("לא ניתן לטעון את קובץ הווידאו. ודאו שהקובץ תקין ונסו שוב.");
    };

    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("ended", finish);
    video.addEventListener("error", onVideoError);

    const processFrame = (mediaTimeSeconds: number) => {
      if (cancelled || !landmarker || video.readyState < 2) return;
      const timestampMs = mediaTimeSeconds * 1000;
      const result = detectPoseOnVideoFrame(landmarker, video, timestampMs);
      const pose = getPrimaryPose(result);
      frames.push({ timestampMs, landmarks: pose });
      overlayRef.current?.draw(pose);
      if (video.duration > 0) {
        setProgress(Math.min(1, mediaTimeSeconds / video.duration));
      }
    };

    const supportsRvfc = typeof video.requestVideoFrameCallback === "function";

    const rvfcLoop = (_now: number, metadata: VideoFrameCallbackMetadata) => {
      if (cancelled) return;
      processFrame(metadata.mediaTime);
      if (!video.ended && !video.paused) {
        rvfcHandle = video.requestVideoFrameCallback(rvfcLoop);
      }
    };

    const rafLoop = () => {
      if (cancelled || video.ended) return;
      processFrame(video.currentTime);
      rafHandle = requestAnimationFrame(rafLoop);
    };

    (async () => {
      try {
        landmarker = await createPoseLandmarker("VIDEO");
        if (cancelled) {
          landmarker.close();
          return;
        }
        setPhase("processing");
        if (supportsRvfc) {
          rvfcHandle = video.requestVideoFrameCallback(rvfcLoop);
        } else {
          rafHandle = requestAnimationFrame(rafLoop);
        }
        await video.play();
      } catch (err) {
        console.error("AnalysisRunner error:", err);
        if (!cancelled) {
          onError(
            "לא ניתן היה לטעון את מנוע זיהוי התנועה. בדקו את החיבור לרשת ונסו שוב.",
          );
        }
      }
    })();

    return () => {
      cancelled = true;
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("ended", finish);
      video.removeEventListener("error", onVideoError);
      if (rvfcHandle !== null) video.cancelVideoFrameCallback(rvfcHandle);
      if (rafHandle !== null) cancelAnimationFrame(rafHandle);
      landmarker?.close();
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
