"use client";

import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import PoseOverlay, { type PoseOverlayHandle } from "@/components/PoseOverlay";
import type { NormalizedLandmark } from "@/lib/pose";

export interface MomentPreviewHandle {
  showMoment: (timestampMs: number, landmarks: NormalizedLandmark[] | null) => void;
}

interface MomentPreviewProps {
  videoUrl: string;
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
    const pendingSeekHandlerRef = useRef<(() => void) | null>(null);
    const [dims, setDims] = useState({ width: 640, height: 360 });

    useImperativeHandle(
      ref,
      () => ({
        showMoment(timestampMs, landmarks) {
          const video = videoRef.current;
          if (!video) return;
          const targetSeconds = timestampMs / 1000;

          // A seek requested while a previous one is still pending would
          // otherwise leave a stale listener around that could paint the
          // wrong (earlier) moment's landmarks if it happens to fire.
          if (pendingSeekHandlerRef.current) {
            video.removeEventListener("seeked", pendingSeekHandlerRef.current);
            pendingSeekHandlerRef.current = null;
          }

          const paint = () => overlayRef.current?.drawFrame(video, landmarks);

          // Composite from the video element's own decoded frame via
          // drawImage rather than relying on the <video> element to have
          // visibly painted that frame on screen - a paused video freshly
          // seeked to an arbitrary timestamp isn't reliably painted by the
          // browser (notably on Safari/iOS), but drawImage reads the
          // decoded buffer directly regardless of on-screen paint state.
          if (video.readyState >= 2 && video.currentTime === targetSeconds) {
            paint();
            return;
          }

          const onSeeked = () => {
            video.removeEventListener("seeked", onSeeked);
            pendingSeekHandlerRef.current = null;
            paint();
          };
          pendingSeekHandlerRef.current = onSeeked;
          video.addEventListener("seeked", onSeeked);
          video.currentTime = targetSeconds;
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
