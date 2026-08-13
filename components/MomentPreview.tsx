"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import PoseOverlay, { type PoseOverlayHandle } from "@/components/PoseOverlay";
import type { NormalizedLandmark } from "@/lib/pose";

export interface MomentPreviewHandle {
  showMoment: (frame: HTMLCanvasElement | null, landmarks: NormalizedLandmark[] | null) => void;
}

interface Moment {
  frame: HTMLCanvasElement | null;
  landmarks: NormalizedLandmark[] | null;
}

const FALLBACK_DIMS = { width: 640, height: 360 };

/**
 * Shows one already-captured moment: the video frame snapshotted during
 * analysis with that frame's pose drawn over it.
 *
 * There is deliberately no <video> element here. An earlier version seeked
 * a second video to the rep's timestamp on demand, which put the frame and
 * the skeleton out of sync - that element had a different decode state from
 * the one the analysis ran on, so the same timestamp could resolve to a
 * different frame - and on Safari/iOS a never-played video would not paint
 * at all. Drawing the snapshot taken at analysis time removes both problems
 * by construction.
 */
const MomentPreview = forwardRef<MomentPreviewHandle, object>(
  function MomentPreview(_props, ref) {
    const overlayRef = useRef<PoseOverlayHandle>(null);
    const [moment, setMoment] = useState<Moment | null>(null);

    useImperativeHandle(
      ref,
      () => ({
        showMoment(frame, landmarks) {
          // Recorded as state rather than painted right here: a frame of a
          // different size resizes the canvas, and resizing a canvas clears
          // it. Painting from an effect instead guarantees it happens after
          // PoseOverlay's own resize effect, since child effects run before
          // parent effects.
          setMoment({ frame, landmarks });
        },
      }),
      [],
    );

    const dims = moment?.frame
      ? { width: moment.frame.width, height: moment.frame.height }
      : FALLBACK_DIMS;

    useEffect(() => {
      if (!moment) return;
      overlayRef.current?.drawFrame(moment.frame, moment.landmarks);
    }, [moment]);

    return (
      <div
        className="relative mx-auto max-w-md overflow-hidden rounded-xl bg-black"
        style={{ aspectRatio: `${dims.width} / ${dims.height}` }}
      >
        <PoseOverlay
          ref={overlayRef}
          width={dims.width}
          height={dims.height}
          className="h-full w-full"
        />
      </div>
    );
  },
);

export default MomentPreview;
