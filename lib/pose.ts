import {
  FilesetResolver,
  PoseLandmarker,
  type NormalizedLandmark,
  type PoseLandmarkerResult,
} from "@mediapipe/tasks-vision";

/**
 * Everything here runs entirely in the browser (WASM, CPU delegate).
 * No video frame or image is ever sent to a server.
 */

// Self-hosted copy of the MediaPipe WASM runtime (see scripts/copy-mediapipe-wasm.mjs).
const WASM_BASE_PATH = "/mediapipe/wasm";

// Self-hosted copy of Google's pose_landmarker_lite model (see
// scripts/download-pose-model.mjs). Served from our own origin so the browser
// never needs a cross-origin request at runtime; no image/video data is ever
// sent anywhere.
const MODEL_ASSET_PATH = "/models/pose_landmarker_lite.task";

export type RunningMode = "IMAGE" | "VIDEO";

// Indices into the 33-point BlazePose landmark array returned by PoseLandmarker.
export const POSE_LANDMARKS = {
  NOSE: 0,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_HEEL: 29,
  RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31,
  RIGHT_FOOT_INDEX: 32,
} as const;

export const POSE_CONNECTIONS = PoseLandmarker.POSE_CONNECTIONS;

export type { NormalizedLandmark, PoseLandmarkerResult, PoseLandmarker };

/**
 * Creates a fresh PoseLandmarker instance. Callers own the instance's
 * lifecycle and must call `.close()` when done with it (e.g. when a video
 * analysis session ends) to free the WASM memory.
 *
 * `runningMode: "IMAGE"` must be paired with `landmarker.detect(image)`.
 * `runningMode: "VIDEO"` must be paired with `landmarker.detectForVideo(video, timestampMs)`
 * with a strictly increasing timestamp across calls on the same instance.
 */
export async function createPoseLandmarker(
  runningMode: RunningMode,
): Promise<PoseLandmarker> {
  const vision = await FilesetResolver.forVisionTasks(WASM_BASE_PATH);
  return PoseLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: MODEL_ASSET_PATH,
      delegate: "CPU",
    },
    runningMode,
    numPoses: 1,
  });
}

/** Runs pose detection on a single static image (IMAGE mode only). */
export function detectPoseOnImage(
  landmarker: PoseLandmarker,
  image: HTMLImageElement | ImageBitmap | HTMLCanvasElement,
): PoseLandmarkerResult {
  return landmarker.detect(image);
}

/** Runs pose detection on one video frame (VIDEO mode only). */
export function detectPoseOnVideoFrame(
  landmarker: PoseLandmarker,
  video: HTMLVideoElement,
  timestampMs: number,
): PoseLandmarkerResult {
  return landmarker.detectForVideo(video, timestampMs);
}

/**
 * A pose is only trustworthy enough to analyze if one full side (shoulder,
 * hip, knee, ankle) is clearly visible. This is a *side-view* squat video,
 * so the far side is normally partly occluded by the near leg/arm — we only
 * need the near side to run the checks (see `pickTrackedSide` in
 * squatAnalysis.ts, which picks whichever side is more visible).
 */
const SIDE_LANDMARKS_FOR_ANALYSIS = [
  [POSE_LANDMARKS.LEFT_SHOULDER, POSE_LANDMARKS.LEFT_HIP, POSE_LANDMARKS.LEFT_KNEE, POSE_LANDMARKS.LEFT_ANKLE],
  [POSE_LANDMARKS.RIGHT_SHOULDER, POSE_LANDMARKS.RIGHT_HIP, POSE_LANDMARKS.RIGHT_KNEE, POSE_LANDMARKS.RIGHT_ANKLE],
];

const MIN_VISIBILITY = 0.5;

export function getPrimaryPose(
  result: PoseLandmarkerResult,
): NormalizedLandmark[] | null {
  return result.landmarks[0] ?? null;
}

export function isPoseUsableForAnalysis(
  landmarks: NormalizedLandmark[] | null,
): boolean {
  if (!landmarks) return false;
  return SIDE_LANDMARKS_FOR_ANALYSIS.some((indices) =>
    indices.every((index) => {
      const point = landmarks[index];
      return point && point.visibility >= MIN_VISIBILITY;
    }),
  );
}
