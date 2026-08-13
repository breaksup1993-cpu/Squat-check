import {
  POSE_LANDMARKS,
  isPoseUsableForAnalysis,
  type NormalizedLandmark,
} from "./pose";

/** One processed video frame: the pose detected at a given playback time. */
export interface PoseFrame {
  timestampMs: number;
  landmarks: NormalizedLandmark[] | null;
}

export type Side = "left" | "right";

export type Severity = "ok" | "mild" | "significant";

export interface RepCheck {
  flagged: boolean;
  severity: Severity;
}

export interface RepAnalysis {
  index: number;
  startTimeMs: number;
  bottomTimeMs: number;
  endTimeMs: number;
  kneeValgus: RepCheck;
  backRounding: RepCheck;
  depth: RepCheck;
  /** The pose at bottomTimeMs, so the UI can show "this moment" without re-running detection. */
  bottomLandmarks: NormalizedLandmark[] | null;
  /**
   * Snapshot of the video at bottomTimeMs. Filled in by the caller after
   * analysis - this module is DOM-free and can't produce it - so that the
   * UI can show that exact frame without seeking a video element to it
   * again. Re-seeking is what made the displayed frame disagree with the
   * drawn skeleton: it happened on a different element, in a different
   * decode state, which can resolve the same timestamp to a different
   * frame.
   */
  bottomFrame: HTMLCanvasElement | null;
}

export interface SquatAnalysisResult {
  side: Side;
  repCount: number;
  reps: RepAnalysis[];
  /** Ready-to-render Hebrew sentences, one per check. */
  checkSentences: string[];
}

export type AnalysisOutcome =
  | { status: "ok"; result: SquatAnalysisResult }
  | { status: "no-pose" }
  | { status: "no-reps" };

// --- Tunables -------------------------------------------------------------
// These thresholds are heuristics tuned for a rough MVP, not clinical
// measurements. See the app's disclaimers: single-camera analysis is
// approximate.

/** Fraction of frames that must have a usable pose to attempt analysis. */
const MIN_USABLE_FRAME_FRACTION = 0.5;
const MIN_USABLE_FRAMES = 10;

/** Knee angle (degrees) at/above which the person is considered "standing". */
const STANDING_KNEE_ANGLE_DEG = 160;
/** Knee angle (degrees) at/below which the person is considered "in a squat". */
const SQUAT_ENTRY_KNEE_ANGLE_DEG = 140;
/** Minimum knee-angle drop from standing to bottom to count as a real rep (filters out noise/weight shifts). */
const MIN_REP_ANGLE_DROP_DEG = 30;

/**
 * Knee deviation from the hip-ankle line (as a fraction of leg length)
 * beyond which we flag valgus, measured by `estimateInwardKneeDeviation`
 * below. This was already just a heuristic tuned by feel for the original
 * side-view-only (z-only) formula, not a physically derived number - and
 * the app now recommends filming at ~45° instead. Verified (via synthetic
 * landmark data modeling a camera at 45°, run through this function
 * directly - not part of this repo's checked-in code) that this formula
 * and threshold still cleanly separate an obviously-clean rep (reads
 * exactly 0) from an obviously-valgus one (reads well above this
 * threshold), and correctly reject a pure-forward-knee-travel confound
 * that a z-only formula would have wrongly flagged at 45°. TODO
 * re-calibrate against real 45°-filmed video once available - this
 * couldn't be derived more precisely than "clearly separates two
 * synthetic extremes" without it.
 */
const KNEE_VALGUS_RATIO_THRESHOLD = 0.12;
/** Torso-angle change (degrees) between rep start and rep bottom beyond which we flag back rounding. */
const BACK_ROUNDING_ANGLE_THRESHOLD_DEG = 25;
/** How far (as a fraction of thigh length) the hip crease may stay above knee height and still pass depth. */
const DEPTH_TOLERANCE_RATIO = 0.05;

/** Moving-average window (frames) used to smooth landmark jitter before analysis. */
const SMOOTHING_WINDOW = 5;

/**
 * How far past a check's threshold a measurement has to be to count as
 * "significant" rather than "mild", as a multiple of that threshold.
 * TODO this is a rough starting line, not calibrated against real video -
 * revisit once real flagged/borderline footage is available to check
 * whether 1.5x actually separates what a person would call "mild" from
 * "significant".
 */
const SEVERITY_MULTIPLIER = 1.5;

/**
 * `measuredExcess` and `threshold` must be on the same scale and same sign
 * convention as the check's own flagging test (i.e. `measuredExcess >
 * threshold` should be equivalent to that check's `flagged` condition).
 */
function severityFromExcess(measuredExcess: number, threshold: number): Severity {
  if (measuredExcess <= threshold) return "ok";
  if (measuredExcess <= threshold * SEVERITY_MULTIPLIER) return "mild";
  return "significant";
}

// --- Geometry helpers -------------------------------------------------------

interface Point3 {
  x: number;
  y: number;
  z: number;
}

function angleAtPoint(a: Point3, b: Point3, c: Point3): number {
  const abx = a.x - b.x;
  const aby = a.y - b.y;
  const cbx = c.x - b.x;
  const cby = c.y - b.y;
  const dot = abx * cbx + aby * cby;
  const magAB = Math.hypot(abx, aby);
  const magCB = Math.hypot(cbx, cby);
  if (magAB === 0 || magCB === 0) return 0;
  const cos = Math.min(1, Math.max(-1, dot / (magAB * magCB)));
  return (Math.acos(cos) * 180) / Math.PI;
}

/** Angle (degrees) of vector b->a relative to vertical "up" (0 = perfectly upright). */
function angleFromVertical(a: Point3, b: Point3): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  // Image y grows downward, so "up" is (0, -1).
  const angleRad = Math.atan2(Math.abs(dx), -dy);
  return Math.abs((angleRad * 180) / Math.PI);
}

/**
 * How far `p` deviates from the straight hip-ankle line along one axis
 * ("x": left-right in the image, "z": depth from the camera) at p's height,
 * normalized by leg length.
 */
function axisDeviationRatio(
  hip: Point3,
  knee: Point3,
  ankle: Point3,
  axis: "x" | "z",
): number {
  const legLength = Math.hypot(
    ankle.x - hip.x,
    ankle.y - hip.y,
    ankle.z - hip.z,
  );
  if (legLength === 0) return 0;
  const span = ankle.y - hip.y;
  const t = span === 0 ? 0.5 : (knee.y - hip.y) / span;
  const expected = hip[axis] + t * (ankle[axis] - hip[axis]);
  return (knee[axis] - expected) / legLength;
}

/**
 * Estimated medial ("inward") knee deviation from the hip-ankle line, at
 * the app's recommended ~45° camera angle (between a pure front view and a
 * pure side view).
 *
 * At a pure side view, inward knee collapse is almost entirely a
 * depth-axis (z) motion, while forward knee travel over the toes is almost
 * entirely a left-right (x) motion in the image - the two don't mix, so
 * reading z alone is a clean valgus signal (this was the original
 * side-view-only design). At 45°, world-frame trigonometry shows *both*
 * axes pick up a roughly equal mix of the two motions, so reading either
 * axis alone at 45° would partly measure forward travel too (which is
 * often normal, especially in a deep squat) and count it as inward
 * collapse.
 *
 * Combining the two axes cancels that mix-up: for the near/tracked leg,
 * summing the depth deviation with the *sign-adjusted* horizontal
 * deviation (adjusted for which side is tracked, since a left-tracked vs
 * right-tracked setup mirrors the camera's position relative to the body)
 * reconstructs the pure medial-lateral deviation, at 45° specifically. This
 * is exact only at exactly 45°; it degrades gracefully for camera angles
 * somewhat off that target, but is a worse (more confounded) estimate than
 * before if someone films close to a pure side view instead of following
 * the 45° guidance.
 */
function estimateInwardKneeDeviation(
  hip: Point3,
  knee: Point3,
  ankle: Point3,
  side: Side,
): number {
  const depthDev = axisDeviationRatio(hip, knee, ankle, "z");
  const horizontalDev = axisDeviationRatio(hip, knee, ankle, "x");
  const signedHorizontalDev = side === "left" ? horizontalDev : -horizontalDev;
  return (depthDev + signedHorizontalDev) / Math.SQRT2;
}

function movingAverage(values: number[], window: number): number[] {
  const half = Math.floor(window / 2);
  return values.map((_, i) => {
    const start = Math.max(0, i - half);
    const end = Math.min(values.length, i + half + 1);
    let sum = 0;
    for (let j = start; j < end; j++) sum += values[j];
    return sum / (end - start);
  });
}

// --- Side selection ---------------------------------------------------------

const SIDE_LANDMARKS: Record<Side, number[]> = {
  left: [
    POSE_LANDMARKS.LEFT_SHOULDER,
    POSE_LANDMARKS.LEFT_HIP,
    POSE_LANDMARKS.LEFT_KNEE,
    POSE_LANDMARKS.LEFT_ANKLE,
  ],
  right: [
    POSE_LANDMARKS.RIGHT_SHOULDER,
    POSE_LANDMARKS.RIGHT_HIP,
    POSE_LANDMARKS.RIGHT_KNEE,
    POSE_LANDMARKS.RIGHT_ANKLE,
  ],
};

function pickTrackedSide(frames: NormalizedLandmark[][]): Side {
  let leftVisibility = 0;
  let rightVisibility = 0;
  for (const landmarks of frames) {
    for (const idx of SIDE_LANDMARKS.left) leftVisibility += landmarks[idx]?.visibility ?? 0;
    for (const idx of SIDE_LANDMARKS.right) rightVisibility += landmarks[idx]?.visibility ?? 0;
  }
  return rightVisibility >= leftVisibility ? "right" : "left";
}

interface SideIndices {
  shoulder: number;
  hip: number;
  knee: number;
  ankle: number;
}

function sideIndices(side: Side): SideIndices {
  return side === "left"
    ? {
        shoulder: POSE_LANDMARKS.LEFT_SHOULDER,
        hip: POSE_LANDMARKS.LEFT_HIP,
        knee: POSE_LANDMARKS.LEFT_KNEE,
        ankle: POSE_LANDMARKS.LEFT_ANKLE,
      }
    : {
        shoulder: POSE_LANDMARKS.RIGHT_SHOULDER,
        hip: POSE_LANDMARKS.RIGHT_HIP,
        knee: POSE_LANDMARKS.RIGHT_KNEE,
        ankle: POSE_LANDMARKS.RIGHT_ANKLE,
      };
}

// --- Rep segmentation ---------------------------------------------------------

interface RepIndices {
  startIdx: number;
  bottomIdx: number;
  endIdx: number;
}

function segmentReps(kneeAngles: number[]): RepIndices[] {
  const reps: RepIndices[] = [];
  let state: "up" | "down" = "up";
  let lastStandingIdx = 0;
  let bottomIdx = -1;
  let bottomAngle = Infinity;

  for (let i = 0; i < kneeAngles.length; i++) {
    const angle = kneeAngles[i];
    if (state === "up") {
      if (angle >= STANDING_KNEE_ANGLE_DEG) {
        lastStandingIdx = i;
      } else if (angle <= SQUAT_ENTRY_KNEE_ANGLE_DEG) {
        state = "down";
        bottomIdx = i;
        bottomAngle = angle;
      }
    } else {
      if (angle < bottomAngle) {
        bottomAngle = angle;
        bottomIdx = i;
      }
      if (angle >= STANDING_KNEE_ANGLE_DEG) {
        const drop = STANDING_KNEE_ANGLE_DEG - bottomAngle;
        if (drop >= MIN_REP_ANGLE_DROP_DEG) {
          reps.push({ startIdx: lastStandingIdx, bottomIdx, endIdx: i });
        }
        state = "up";
        lastStandingIdx = i;
        bottomIdx = -1;
        bottomAngle = Infinity;
      }
    }
  }
  return reps;
}

// --- Main entry point ---------------------------------------------------------

export function analyzeSquatSession(frames: PoseFrame[]): AnalysisOutcome {
  const usable = frames.filter(
    (f): f is { timestampMs: number; landmarks: NormalizedLandmark[] } =>
      isPoseUsableForAnalysis(f.landmarks),
  );

  if (
    frames.length === 0 ||
    usable.length < MIN_USABLE_FRAMES ||
    usable.length / frames.length < MIN_USABLE_FRAME_FRACTION
  ) {
    return { status: "no-pose" };
  }

  const side = pickTrackedSide(usable.map((f) => f.landmarks));
  const { shoulder, hip, knee, ankle } = sideIndices(side);

  const timestamps = usable.map((f) => f.timestampMs);
  const rawKneeAngles = usable.map((f) =>
    angleAtPoint(f.landmarks[hip], f.landmarks[knee], f.landmarks[ankle]),
  );
  const kneeAngles = movingAverage(rawKneeAngles, SMOOTHING_WINDOW);

  const torsoAngles = usable.map((f) =>
    angleFromVertical(f.landmarks[shoulder], f.landmarks[hip]),
  );
  const hipY = usable.map((f) => f.landmarks[hip].y);
  const kneeY = usable.map((f) => f.landmarks[knee].y);
  const thighLength = usable.map((f) =>
    Math.hypot(
      f.landmarks[knee].x - f.landmarks[hip].x,
      f.landmarks[knee].y - f.landmarks[hip].y,
    ),
  );
  // The depth axis (z) is the noisiest signal MediaPipe estimates from a
  // single camera, and knee valgus is a small deviation right at the
  // detection threshold. Smooth it like the knee angle so single-frame
  // numerical jitter (e.g. from the CPU inference backend's floating-point
  // reduction order, which is not bit-exact run to run) doesn't flip a rep
  // between flagged/clean.
  const rawValgusRatios = usable.map((f) =>
    estimateInwardKneeDeviation(f.landmarks[hip], f.landmarks[knee], f.landmarks[ankle], side),
  );
  const valgusRatios = movingAverage(rawValgusRatios, SMOOTHING_WINDOW);

  const repIndices = segmentReps(kneeAngles);
  if (repIndices.length === 0) {
    return { status: "no-reps" };
  }

  const reps: RepAnalysis[] = repIndices.map(({ startIdx, bottomIdx, endIdx }, i) => {
    // Look at a small window around the deepest point to reduce single-frame noise.
    const windowStart = Math.max(startIdx, bottomIdx - 2);
    const windowEnd = Math.min(endIdx, bottomIdx + 2);
    let maxValgus = -Infinity;
    for (let j = windowStart; j <= windowEnd; j++) {
      if (valgusRatios[j] > maxValgus) maxValgus = valgusRatios[j];
    }

    const depthGap = (hipY[bottomIdx] - kneeY[bottomIdx]) / (thighLength[bottomIdx] || 1);
    const backAngleChange = Math.abs(torsoAngles[bottomIdx] - torsoAngles[startIdx]);
    // depthGap's flagging test is depthGap < -DEPTH_TOLERANCE_RATIO, i.e. it
    // gets *more negative* the worse it is - so -depthGap is the excess on
    // the same positive, threshold-comparable scale as the other two checks.
    const depthExcess = -depthGap;

    const kneeValgusSeverity = severityFromExcess(maxValgus, KNEE_VALGUS_RATIO_THRESHOLD);
    const backRoundingSeverity = severityFromExcess(backAngleChange, BACK_ROUNDING_ANGLE_THRESHOLD_DEG);
    const depthSeverity = severityFromExcess(depthExcess, DEPTH_TOLERANCE_RATIO);

    return {
      index: i + 1,
      startTimeMs: timestamps[startIdx],
      bottomTimeMs: timestamps[bottomIdx],
      endTimeMs: timestamps[endIdx],
      kneeValgus: { flagged: kneeValgusSeverity !== "ok", severity: kneeValgusSeverity },
      backRounding: { flagged: backRoundingSeverity !== "ok", severity: backRoundingSeverity },
      depth: { flagged: depthSeverity !== "ok", severity: depthSeverity },
      bottomLandmarks: usable[bottomIdx].landmarks,
      bottomFrame: null,
    };
  });

  return {
    status: "ok",
    result: {
      side,
      repCount: reps.length,
      reps,
      checkSentences: buildCheckSentences(side, reps),
    },
  };
}

// --- Hebrew summary text ---------------------------------------------------------

const SIDE_KNEE_LABEL: Record<Side, string> = {
  left: "השמאלית",
  right: "הימנית",
};

function countSentence(
  flaggedCount: number,
  total: number,
  flaggedPhrase: string,
  allGoodPhrase: string,
): string {
  if (flaggedCount === 0) {
    return `בכל ${total} החזרות ${allGoodPhrase}.`;
  }
  return `ב-${flaggedCount} מתוך ${total} חזרות ${flaggedPhrase}.`;
}

function buildCheckSentences(side: Side, reps: RepAnalysis[]): string[] {
  const total = reps.length;
  const kneeLabel = SIDE_KNEE_LABEL[side];
  const valgusCount = reps.filter((r) => r.kneeValgus.flagged).length;
  const backCount = reps.filter((r) => r.backRounding.flagged).length;
  const depthCount = reps.filter((r) => r.depth.flagged).length;

  return [
    countSentence(
      valgusCount,
      total,
      `הברך ${kneeLabel} נכנסה פנימה`,
      `הברך ${kneeLabel} נשמרה יציבה`,
    ),
    countSentence(
      backCount,
      total,
      "זוהה עיגול משמעותי בגב התחתון בתחתית התנועה",
      "הגב התחתון נשמר יציב",
    ),
    countSentence(
      depthCount,
      total,
      "הירך לא ירדה מתחת לגובה הברך (עומק לא מספיק)",
      "העומק היה תקין (הירך ירדה מתחת לגובה הברך)",
    ),
  ];
}
