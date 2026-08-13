"use client";

import { useRef, useState } from "react";
import Disclaimer from "@/components/Disclaimer";
import MomentPreview, { type MomentPreviewHandle } from "@/components/MomentPreview";
import { COACHING_TIPS, COACHING_TIPS_DISCLAIMER } from "@/lib/coachingTips";
import type { AnalysisOutcome, RepAnalysis } from "@/lib/squatAnalysis";

interface ResultsSummaryProps {
  outcome: AnalysisOutcome;
  videoUrl: string | null;
  onRestart: () => void;
}

const CHECK_LABELS = { knee: "ברך קורסת פנימה", back: "גב תחתון", depth: "עומק" };

export default function ResultsSummary({ outcome, videoUrl, onRestart }: ResultsSummaryProps) {
  if (outcome.status === "no-pose") {
    return (
      <div className="flex flex-col gap-5">
        <div className="rounded-xl border-2 border-red-300 bg-red-50 p-5 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          <h2 className="mb-2 text-lg font-bold">לא זוהה שלד תקין בווידאו</h2>
          <p className="text-sm leading-relaxed">
            המערכת לא הצליחה לזהות באופן ברור ועקבי את הגוף לאורך הסרטון, ולכן
            לא ניתן להציג ניתוח אמין. סיבות אפשריות: תאורה חלשה, חלקי גוף
            שיוצאים מהפריים, בגדים רפויים שמסתירים מפרקים, או זווית צילום לא
            מתאימה.
          </p>
          <ul className="mt-3 list-disc space-y-1 pr-5 text-sm">
            <li>ודאו שכל הגוף (מהראש ועד כפות הרגליים) נמצא בפריים</li>
            <li>צלמו במקום מואר היטב, בזווית של כ-45 מעלות (בין חזית לצד)</li>
            <li>הימנעו מבגדים רפויים במיוחד</li>
          </ul>
        </div>
        <button
          type="button"
          onClick={onRestart}
          className="self-start rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          ניסיון נוסף
        </button>
      </div>
    );
  }

  if (outcome.status === "no-reps") {
    return (
      <div className="flex flex-col gap-5">
        <div className="rounded-xl border-2 border-red-300 bg-red-50 p-5 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          <h2 className="mb-2 text-lg font-bold">לא זוהו חזרות סקוואט ברורות</h2>
          <p className="text-sm leading-relaxed">
            זיהינו שלד בווידאו, אך לא זיהינו תנועת ירידה-עלייה ברורה של
            סקוואט. ודאו שהסרטון כולל 5-8 חזרות שלמות, בזווית של כ-45 מעלות,
            עם ירידה ברורה למטה בכל חזרה.
          </p>
        </div>
        <button
          type="button"
          onClick={onRestart}
          className="self-start rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          ניסיון נוסף
        </button>
      </div>
    );
  }

  const { result } = outcome;

  return (
    <ResultsWithMoments result={result} videoUrl={videoUrl} onRestart={onRestart} />
  );
}

function ResultsWithMoments({
  result,
  videoUrl,
  onRestart,
}: {
  result: Extract<AnalysisOutcome, { status: "ok" }>["result"];
  videoUrl: string | null;
  onRestart: () => void;
}) {
  const previewRef = useRef<MomentPreviewHandle>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [activeRepIndex, setActiveRepIndex] = useState<number | null>(null);

  function handleViewMoment(rep: RepAnalysis) {
    setActiveRepIndex(rep.index);
    previewRef.current?.showMoment(rep.bottomTimeMs, rep.bottomLandmarks);
    previewContainerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  const hasValgusFlag = result.reps.some((r) => r.kneeValgus.flagged);
  const hasBackFlag = result.reps.some((r) => r.backRounding.flagged);
  const hasDepthFlag = result.reps.some((r) => r.depth.flagged);
  const anyFlag = hasValgusFlag || hasBackFlag || hasDepthFlag;
  // result.checkSentences is always [knee valgus, back rounding, depth], in
  // that fixed order (see buildCheckSentences in lib/squatAnalysis.ts).
  const summaryItems = [
    { sentence: result.checkSentences[0], flagged: hasValgusFlag, tip: COACHING_TIPS.kneeValgus },
    { sentence: result.checkSentences[1], flagged: hasBackFlag, tip: COACHING_TIPS.backRounding },
    { sentence: result.checkSentences[2], flagged: hasDepthFlag, tip: COACHING_TIPS.depth },
  ];

  return (
    <div className="flex flex-col gap-6">
      <Disclaimer variant="compact" />

      <div className="rounded-xl border border-black/10 p-5 dark:border-white/15">
        <h2 className="mb-1 text-lg font-bold">סיכום</h2>
        <p className="mb-4 text-sm text-foreground/70">זוהו {result.repCount} חזרות</p>
        <ul className="space-y-3">
          {summaryItems.map(({ sentence, flagged, tip }) => (
            <li key={sentence}>
              <div className="flex gap-2 text-sm leading-relaxed">
                <span aria-hidden>•</span>
                <span>{sentence}</span>
              </div>
              {flagged && (
                <p className="mt-1 pr-4 text-xs text-blue-700 dark:text-blue-300">
                  <strong>טיפ:</strong> {tip}
                </p>
              )}
            </li>
          ))}
        </ul>
        {anyFlag && (
          <p className="mt-3 text-[11px] text-foreground/50">{COACHING_TIPS_DISCLAIMER}</p>
        )}
      </div>

      {videoUrl && (
        <div ref={previewContainerRef} className={activeRepIndex === null ? "hidden" : undefined}>
          <p className="mb-2 text-sm font-semibold">
            הרגע התחתון של חזרה #{activeRepIndex}
          </p>
          <MomentPreview ref={previewRef} videoUrl={videoUrl} />
        </div>
      )}

      {/* Per-rep cards rather than a wide table: a 4-column table needs
          horizontal scrolling on phone-width screens, and that scroll isn't
          discoverable - on a real device the last column silently went
          unseen. A 3-column grid inside a full-width card has no fixed
          minimum width, so it always fits. */}
      <div className="flex flex-col gap-3">
        {result.reps.map((rep) => (
          <div key={rep.index} className="rounded-xl border border-black/10 p-4 dark:border-white/15">
            <p className="mb-3 text-sm font-semibold">חזרה #{rep.index}</p>
            <div className="grid grid-cols-3 gap-2">
              <CheckCell
                label={CHECK_LABELS.knee}
                flagged={rep.kneeValgus.flagged}
                onViewMoment={videoUrl ? () => handleViewMoment(rep) : undefined}
              />
              <CheckCell
                label={CHECK_LABELS.back}
                flagged={rep.backRounding.flagged}
                onViewMoment={videoUrl ? () => handleViewMoment(rep) : undefined}
              />
              <CheckCell
                label={CHECK_LABELS.depth}
                flagged={rep.depth.flagged}
                onViewMoment={videoUrl ? () => handleViewMoment(rep) : undefined}
              />
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onRestart}
        className="self-start rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
      >
        ניתוח וידאו נוסף
      </button>
    </div>
  );
}

function CheckCell({
  label,
  flagged,
  onViewMoment,
}: {
  label: string;
  flagged: boolean;
  onViewMoment?: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 text-center">
      <span className="text-xs text-foreground/70">{label}</span>
      {flagged ? (
        <>
          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-800 dark:bg-red-950 dark:text-red-300">
            סומן
          </span>
          {onViewMoment && (
            <button
              type="button"
              onClick={onViewMoment}
              className="text-[11px] text-blue-600 underline hover:text-blue-800 dark:text-blue-400"
            >
              צפה ברגע הזה
            </button>
          )}
        </>
      ) : (
        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-800 dark:bg-green-950 dark:text-green-300">
          תקין
        </span>
      )}
    </div>
  );
}
