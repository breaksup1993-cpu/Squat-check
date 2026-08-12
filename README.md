# בדיקת סקוואט (Squat Check)

MVP web app that analyzes a short (5-8 rep) side-view squat video and
flags common technique issues. Everything runs client-side in the
browser — no backend, no database, no auth, and the video never leaves
the device.

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS
- [`@mediapipe/tasks-vision`](https://www.npmjs.com/package/@mediapipe/tasks-vision) Pose Landmarker, running in-browser via WASM (CPU delegate — no GPU or server required)

## How it works

1. **`lib/pose.ts`** — loads the MediaPipe Pose Landmarker and runs it on
   a video frame or a static image. The WASM runtime and the model file
   are both self-hosted (see below) rather than fetched from a
   third-party CDN at runtime.
2. **`components/PoseOverlay.tsx`** — canvas overlay that draws the
   detected skeleton on top of the video.
3. **`components/AnalysisRunner.tsx`** — plays the uploaded/recorded
   clip, runs pose detection frame-by-frame via
   `requestVideoFrameCallback`, and draws the live overlay.
4. **`lib/squatAnalysis.ts`** — turns the per-frame landmarks into rep
   segmentation (via knee-angle hysteresis) and three angle-based
   checks per rep:
   - **Knee valgus** — does the knee deviate from the hip-ankle line
     (along the camera's depth axis, since this is a side-view check)?
   - **Lower-back rounding** — does the shoulder-hip angle change
     significantly between the start of the rep and its bottom?
   - **Depth** — does the hip crease drop below knee height?
5. **`components/ResultsSummary.tsx`** — renders the Hebrew summary
   sentences and a per-rep pass/flag table.

If too few frames have a confidently-tracked pose, or no clear squat
reps are detected, the app shows an explicit message instead of a
misleading result.

## Getting started

```bash
npm install   # also fetches the MediaPipe WASM runtime + model file (see scripts/)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

`npm install`, `npm run dev`, and `npm run build` all run
`scripts/copy-mediapipe-wasm.mjs` (copies the WASM runtime out of
`node_modules` into `public/mediapipe/`) and
`scripts/download-pose-model.mjs` (downloads Google's
`pose_landmarker_lite` model into `public/models/`). Both destinations
are gitignored and regenerated on install/build.

## Scope

v1 intentionally does not include: multiple exercises, user accounts,
a native mobile app, or cross-user comparison. See the in-app
disclaimer: this is an aid tool, not a substitute for professional
diagnosis, and single-camera analysis is not lab-accurate.
