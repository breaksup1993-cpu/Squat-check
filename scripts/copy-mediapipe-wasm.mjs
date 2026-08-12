// Copies the MediaPipe WASM runtime out of node_modules and into public/
// so the browser loads it from our own origin instead of a third-party CDN.
// Runs automatically after `npm install` (see package.json "postinstall").
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const src = join(root, "node_modules", "@mediapipe", "tasks-vision", "wasm");
const dest = join(root, "public", "mediapipe", "wasm");

if (!existsSync(src)) {
  console.warn(`[copy-mediapipe-wasm] source not found at ${src}, skipping`);
  process.exit(0);
}

mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });
console.log(`[copy-mediapipe-wasm] copied MediaPipe WASM runtime to ${dest}`);
