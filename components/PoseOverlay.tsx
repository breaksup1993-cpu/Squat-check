"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { POSE_CONNECTIONS, type NormalizedLandmark } from "@/lib/pose";

export interface PoseOverlayHandle {
  draw: (landmarks: NormalizedLandmark[] | null) => void;
  clear: () => void;
}

interface PoseOverlayProps {
  width: number;
  height: number;
  className?: string;
}

const MIN_VISIBILITY_TO_DRAW = 0.3;

/**
 * Canvas overlay that draws the pose skeleton on top of a video element.
 * Exposes an imperative `draw()` so a per-frame processing loop can update
 * the canvas directly without triggering a React re-render on every frame.
 */
const PoseOverlay = forwardRef<PoseOverlayHandle, PoseOverlayProps>(
  function PoseOverlay({ width, height, className }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useImperativeHandle(
      ref,
      () => ({
        draw(landmarks) {
          const canvas = canvasRef.current;
          const ctx = canvas?.getContext("2d");
          if (!canvas || !ctx) return;
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          if (!landmarks) return;

          const lineWidth = Math.max(2, canvas.width * 0.006);
          ctx.lineWidth = lineWidth;
          ctx.strokeStyle = "rgba(34, 197, 94, 0.9)";
          ctx.beginPath();
          for (const { start, end } of POSE_CONNECTIONS) {
            const a = landmarks[start];
            const b = landmarks[end];
            if (!a || !b) continue;
            if (a.visibility < MIN_VISIBILITY_TO_DRAW || b.visibility < MIN_VISIBILITY_TO_DRAW) continue;
            ctx.moveTo(a.x * canvas.width, a.y * canvas.height);
            ctx.lineTo(b.x * canvas.width, b.y * canvas.height);
          }
          ctx.stroke();

          const pointRadius = Math.max(2.5, canvas.width * 0.007);
          ctx.fillStyle = "rgba(250, 204, 21, 0.95)";
          for (const lm of landmarks) {
            if (lm.visibility < MIN_VISIBILITY_TO_DRAW) continue;
            ctx.beginPath();
            ctx.arc(lm.x * canvas.width, lm.y * canvas.height, pointRadius, 0, Math.PI * 2);
            ctx.fill();
          }
        },
        clear() {
          const canvas = canvasRef.current;
          const ctx = canvas?.getContext("2d");
          if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        },
      }),
      [],
    );

    // Keep the canvas's backing-store resolution in sync with the video's
    // intrinsic size so drawing coordinates (normalized 0-1) map correctly.
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = width;
      canvas.height = height;
    }, [width, height]);

    return <canvas ref={canvasRef} width={width} height={height} className={className} />;
  },
);

export default PoseOverlay;
