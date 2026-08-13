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
    const [dims, setDims] = useState({ width: 640, height: 360 });

    useImperativeHandle(
      ref,
      () => ({
        showMoment(timestampMs, landmarks) {
          const video = videoRef.current;
          if (!video) return;
          const targetSeconds = timestampMs / 1000;
          const onSeeked = () => {
            video.removeEventListener("seeked", onSeeked);
            overlayRef.current?.draw(landmarks);
          };
          if (video.currentTime === targetSeconds) {
            overlayRef.current?.draw(landmarks);
          } else {
            video.addEventListener("seeked", onSeeked);
            video.currentTime = targetSeconds;
          }
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
