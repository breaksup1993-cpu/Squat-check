"use client";

import { useCallback, useRef, useState } from "react";
import AnalysisRunner from "@/components/AnalysisRunner";
import Disclaimer from "@/components/Disclaimer";
import ResultsSummary from "@/components/ResultsSummary";
import VideoUploader from "@/components/VideoUploader";
import type { AnalysisOutcome } from "@/lib/squatAnalysis";

type Step = "intro" | "upload" | "analyzing" | "results";

export default function Home() {
  const [step, setStep] = useState<Step>("intro");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<AnalysisOutcome | null>(null);
  const [runnerError, setRunnerError] = useState<string | null>(null);
  const videoUrlRef = useRef<string | null>(null);

  const handleVideoReady = useCallback((url: string) => {
    videoUrlRef.current = url;
    setVideoUrl(url);
    setRunnerError(null);
    setStep("analyzing");
  }, []);

  const handleComplete = useCallback((result: AnalysisOutcome) => {
    setOutcome(result);
    setStep("results");
  }, []);

  const handleError = useCallback((message: string) => {
    setRunnerError(message);
  }, []);

  const handleRestart = useCallback(() => {
    if (videoUrlRef.current) {
      URL.revokeObjectURL(videoUrlRef.current);
      videoUrlRef.current = null;
    }
    setVideoUrl(null);
    setOutcome(null);
    setRunnerError(null);
    setStep("upload");
  }, []);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-10">
      <header className="text-center">
        <h1 className="text-2xl font-bold">בדיקת סקוואט</h1>
        <p className="mt-1 text-sm text-foreground/60">
          ניתוח טכניקה מווידאו קצר, ישירות בדפדפן שלכם
        </p>
      </header>

      {step === "intro" && (
        <section className="flex flex-col gap-6">
          <p className="leading-relaxed">
            העלו קליפ קצר (5-8 חזרות) של סקוואט, מצולם מהצד. האפליקציה תזהה
            את השלד שלכם ותבדוק שלושה דברים נפוצים: האם הברך נכנסת פנימה,
            האם הגב התחתון מתעגל בתחתית התנועה, והאם העומק מספיק. כל הניתוח
            מתבצע במכשיר שלכם — שום וידאו לא נשלח לשרת.
          </p>
          <Disclaimer variant="full" />
          <button
            type="button"
            onClick={() => setStep("upload")}
            className="self-start rounded-lg bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-700"
          >
            בואו נתחיל
          </button>
        </section>
      )}

      {step === "upload" && <VideoUploader onVideoReady={handleVideoReady} />}

      {step === "analyzing" && videoUrl && (
        <div className="flex flex-col gap-4">
          <AnalysisRunner
            key={videoUrl}
            videoUrl={videoUrl}
            onComplete={handleComplete}
            onError={handleError}
          />
          {runnerError && (
            <div className="rounded-lg border-2 border-red-300 bg-red-50 p-4 text-sm text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
              <p>{runnerError}</p>
              <button
                type="button"
                onClick={handleRestart}
                className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                ניסיון נוסף
              </button>
            </div>
          )}
        </div>
      )}

      {step === "results" && outcome && (
        <ResultsSummary outcome={outcome} onRestart={handleRestart} />
      )}
    </main>
  );
}
