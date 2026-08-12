// Downloads the MediaPipe Pose Landmarker model file into public/ so the
// browser loads it from our own origin instead of fetching it cross-origin
// from Google's CDN on every session. Runs after `npm install`
// (see package.json "postinstall"). The model itself still never leaves
// the browser once loaded — only this one-time build-time download touches
// the network.
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const destDir = join(root, "public", "models");
const destFile = join(destDir, "pose_landmarker_lite.task");

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

if (existsSync(destFile)) {
  console.log("[download-pose-model] model already present, skipping");
  process.exit(0);
}

mkdirSync(destDir, { recursive: true });

const result = spawnSync(
  "curl",
  ["-fsSL", "--retry", "3", "-o", destFile, MODEL_URL],
  { stdio: "inherit" },
);

if (result.status !== 0) {
  console.warn(
    "[download-pose-model] failed to download the pose model. " +
      "The app will not be able to run pose detection until this file exists at " +
      destFile,
  );
  process.exit(0);
}

console.log(`[download-pose-model] saved model to ${destFile}`);
