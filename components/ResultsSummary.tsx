import Disclaimer from "@/components/Disclaimer";
import type { AnalysisOutcome } from "@/lib/squatAnalysis";

interface ResultsSummaryProps {
  outcome: AnalysisOutcome;
  onRestart: () => void;
}

const CHECK_LABELS = ["ברך קורסת פנימה", "עיגול גב תחתון", "עומק"];

export default function ResultsSummary({ outcome, onRestart }: ResultsSummaryProps) {
  if (outcome.status === "no-pose") {
    return (
      <div className="flex flex-col gap-5">
        <div className="rounded-xl border-2 border-red-300 bg-red-50 p-5 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          <h2 className="mb-2 text-lg font-bold">לא זוהה שלד תקין בווידאו</h2>
          <p className="text-sm leading-relaxed">
            המערכת לא הצליחה לזהות באופן ברור ועקבי את הגוף לאורך הסרטון, ולכן
            לא ניתן להציג ניתוח אמין. סיבות אפשריות: תאורה חלשה, חלקי גוף
            שיוצאים מהפריים, בגדים רפויים שמסתירים מפרקים, או זווית צילום לא
            מהצד.
          </p>
          <ul className="mt-3 list-disc space-y-1 pr-5 text-sm">
            <li>ודאו שכל הגוף (מהראש ועד כפות הרגליים) נמצא בפריים</li>
            <li>צלמו במקום מואר היטב, מהצד</li>
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
            סקוואט. ודאו שהסרטון כולל 5-8 חזרות שלמות, מהצד, עם ירידה ברורה
            למטה בכל חזרה.
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
    <div className="flex flex-col gap-6">
      <Disclaimer variant="compact" />

      <div className="rounded-xl border border-black/10 p-5 dark:border-white/15">
        <h2 className="mb-1 text-lg font-bold">סיכום</h2>
        <p className="mb-4 text-sm text-foreground/70">זוהו {result.repCount} חזרות</p>
        <ul className="space-y-2">
          {result.checkSentences.map((sentence) => (
            <li key={sentence} className="flex gap-2 text-sm leading-relaxed">
              <span aria-hidden>•</span>
              <span>{sentence}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="overflow-x-auto rounded-xl border border-black/10 dark:border-white/15">
        <table className="w-full min-w-[420px] text-sm">
          <thead>
            <tr className="border-b border-black/10 bg-black/[0.03] dark:border-white/15 dark:bg-white/[0.05]">
              <th className="p-3 text-start font-medium">חזרה</th>
              <th className="p-3 text-center font-medium">{CHECK_LABELS[0]}</th>
              <th className="p-3 text-center font-medium">{CHECK_LABELS[1]}</th>
              <th className="p-3 text-center font-medium">{CHECK_LABELS[2]}</th>
            </tr>
          </thead>
          <tbody>
            {result.reps.map((rep) => (
              <tr key={rep.index} className="border-b border-black/5 last:border-0 dark:border-white/10">
                <td className="p-3">#{rep.index}</td>
                <td className="p-3 text-center">
                  <CheckBadge flagged={rep.kneeValgus.flagged} />
                </td>
                <td className="p-3 text-center">
                  <CheckBadge flagged={rep.backRounding.flagged} />
                </td>
                <td className="p-3 text-center">
                  <CheckBadge flagged={rep.depth.flagged} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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

function CheckBadge({ flagged }: { flagged: boolean }) {
  if (flagged) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-800 dark:bg-red-950 dark:text-red-300">
        סומן
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-800 dark:bg-green-950 dark:text-green-300">
      תקין
    </span>
  );
}
