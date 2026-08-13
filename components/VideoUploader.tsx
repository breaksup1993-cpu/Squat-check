"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface VideoUploaderProps {
  onVideoReady: (url: string) => void;
}

type CameraState = "idle" | "requesting" | "live" | "recording" | "denied";

const MAX_FILE_SIZE_BYTES = 200 * 1024 * 1024; // 200MB, a generous cap for a short clip

export default function VideoUploader({ onVideoReady }: VideoUploaderProps) {
  const [fileError, setFileError] = useState<string | null>(null);
  const [cameraState, setCameraState] = useState<CameraState>("idle");
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => stopStream, [stopStream]);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    setFileError(null);
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      setFileError("יש לבחור קובץ וידאו.");
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setFileError("הקובץ גדול מדי. נסו להעלות קליפ קצר יותר.");
      return;
    }
    onVideoReady(URL.createObjectURL(file));
  }

  async function startCamera() {
    setCameraError(null);
    setCameraState("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        await videoPreviewRef.current.play();
      }
      setCameraState("live");
    } catch {
      setCameraState("denied");
      setCameraError(
        "לא ניתן לגשת למצלמה. ודאו שנתתם הרשאה לדפדפן, או השתמשו בהעלאת קובץ במקום.",
      );
    }
  }

  function startRecording() {
    const stream = streamRef.current;
    if (!stream) return;
    chunksRef.current = [];
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : "video/webm";
    const recorder = new MediaRecorder(stream, { mimeType });
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      stopStream();
      setCameraState("idle");
      onVideoReady(URL.createObjectURL(blob));
    };
    recorder.start();
    recorderRef.current = recorder;
    setCameraState("recording");
  }

  function stopRecording() {
    recorderRef.current?.stop();
  }

  function cancelCamera() {
    stopStream();
    setCameraState("idle");
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-xl border border-black/10 p-5 dark:border-white/15">
        <h3 className="mb-3 font-semibold">העלאת קובץ וידאו</h3>
        <p className="mb-3 text-sm text-foreground/70">
          קליפ קצר (5-8 חזרות) של סקוואט, מצולם בזווית של כ-45 מעלות (בין חזית
          לצד).
        </p>
        <input
          type="file"
          accept="video/*"
          onChange={handleFileChange}
          className="block w-full text-sm file:me-3 file:rounded-lg file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-blue-700"
        />
        {fileError && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{fileError}</p>}
      </section>

      <div className="flex items-center gap-3 text-sm text-foreground/50">
        <div className="h-px flex-1 bg-black/10 dark:bg-white/15" />
        או
        <div className="h-px flex-1 bg-black/10 dark:bg-white/15" />
      </div>

      <section className="rounded-xl border border-black/10 p-5 dark:border-white/15">
        <h3 className="mb-3 font-semibold">הקלטה במצלמה</h3>
        <p className="mb-3 text-sm text-foreground/70">
          הציבו את המצלמה בזווית של כ-45 מעלות (בין חזית לצד), כך שהגוף כולו
          (מהראש ועד הרגליים) נראה בפריים לאורך כל התנועה.
        </p>

        {cameraState === "idle" && (
          <button
            type="button"
            onClick={startCamera}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            פתיחת מצלמה
          </button>
        )}

        {cameraState === "requesting" && (
          <p className="text-sm text-foreground/70">מבקשים הרשאת מצלמה…</p>
        )}

        {cameraError && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{cameraError}</p>}

        <div className={cameraState === "live" || cameraState === "recording" ? "mt-3" : "hidden"}>
          <video
            ref={videoPreviewRef}
            muted
            playsInline
            className="aspect-video w-full rounded-lg bg-black object-contain"
          />
          <div className="mt-3 flex gap-3">
            {cameraState === "live" && (
              <>
                <button
                  type="button"
                  onClick={startRecording}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                >
                  ● התחלת הקלטה
                </button>
                <button
                  type="button"
                  onClick={cancelCamera}
                  className="rounded-lg border border-black/15 px-4 py-2 text-sm font-medium hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
                >
                  ביטול
                </button>
              </>
            )}
            {cameraState === "recording" && (
              <button
                type="button"
                onClick={stopRecording}
                className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-black/80 dark:bg-white dark:text-black"
              >
                ■ עצירת הקלטה
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
