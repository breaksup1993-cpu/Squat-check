"use client";

import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import PoseOverlay, { type PoseOverlayHandle } from "@/components/PoseOverlay";
import type { NormalizedLandmark } from "@/lib/pose";
import { seekTo } from "@/lib/videoSeek";

export interface MomentPreviewHandle {
  showMoment: (timestampMs: number, landmarks: NormalizedLandmark[] | null) => void;
}

interface MomentPreviewProps {
  videoUrl: string;
}

function nextAnimationFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

/**
 * A single video+skeleton preview, seekable to an arbitrary timestamp with
 * a pre-computed pose drawn on top (no re-running detection). Used by
 * "view this moment" links next to flagged checks in the results screen.
 */
const MomentPreview = forwardRef<MomentPreviewHandle, MomentPreviewProps>(
  function MomentPreview({ videoUrl }, ref) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const overlayRef = useRef<PoseOverlayHandle>(null);
    const primedRef = useRef(false);
    // Bumped per showMoment call; an in-flight call whose generation is
    // stale stops before painting, so clicking several moments quickly
    // can't leave an earlier one's pose on screen.
    const generationRef = useRef(0);
    const [dims, setDims] = useState({ width: 640, height: 360 });

    useImperativeHandle(
      ref,
      () => ({
        showMoment(timestampMs, landmarks) {
          const video = videoRef.current;
          if (!video) return;
          const generation = ++generationRef.current;

          void (async () => {
            // iOS Safari treats a video that has never started playback as
            // "not activated": the element paints black on screen, and in
            // some versions has no frame available to drawImage either.
            // One play/pause activates it for good. A muted, playsInline
            // video may autoplay without a gesture, and this runs from a
            // click anyway, so the play() should be permitted - but a
            // rejection isn't fatal, so it's only best-effort.
            if (!primedRef.current) {
              primedRef.current = true;
              try {
                await video.play();
              } catch {
                // Ignored: seek + drawImage may still work without it.
              }
              video.pause();
            }
            if (generation !== generationRef.current) return;

            await seekTo(video, timestampMs / 1000);
            if (generation !== generationRef.current) return;

            // `seeked` can fire a beat before the decoded frame is actually
            // presented; one frame of slack avoids compositing the previous
            // frame instead of the requested one.
            await nextAnimationFrame();
            if (generation !== generationRef.current) return;

            // Composite the frame into the canvas rather than relying on the
            // <video> element underneath to have painted it - see the
            // iOS note above, and drawFrame's own comment in PoseOverlay.
            overlayRef.current?.drawFrame(video, landmarks);
          })();
        },
      }),
      [],
    );

    return (
      <div
        className="relative mx-auto max-w-md overflow-hidden rounded-xl bg-black"
        style={{ aspectRatio: `${dims.width} / ${dims.height}` }}
      >
        <video
          ref={videoRef}
          src={videoUrl}
          muted
          playsInline
          preload="auto"
          onLoadedMetadata={(e) => {
            const v = e.currentTarget;
            setDims({ width: v.videoWidth || 640, height: v.videoHeight || 360 });
          }}
          className="h-full w-full object-contain"
        />
        <PoseOverlay
          ref={overlayRef}
          width={dims.width}
          height={dims.height}
          className="pointer-events-none absolute inset-0 h-full w-full"
        />
      </div>
    );
  },
);

export default MomentPreview;
