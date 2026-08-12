interface DisclaimerProps {
  variant?: "full" | "compact";
}

/**
 * Required from day one, per the product spec: a persistent disclaimer that
 * this is an aid tool only (not a professional diagnosis substitute), and a
 * warning that single-camera analysis is not lab-accurate.
 */
export default function Disclaimer({ variant = "full" }: DisclaimerProps) {
  if (variant === "compact") {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
        <p>
          <strong>תזכורת:</strong> זהו כלי עזר בלבד ואינו תחליף לאבחון מקצועי.
          הניתוח מבוסס על מצלמה בודדת ולכן אינו מדויק כמו בדיקה במעבדה.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border-2 border-amber-400 bg-amber-50 p-5 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
      <h2 className="mb-2 flex items-center gap-2 text-base font-bold">
        <span aria-hidden>⚠️</span>
        לפני שמתחילים
      </h2>
      <ul className="list-disc space-y-1.5 pr-5 text-sm leading-relaxed">
        <li>
          האפליקציה היא <strong>כלי עזר בלבד</strong> ואינה תחליף לאבחון,
          ייעוץ או ליווי מקצועי של מאמן, פיזיותרפיסט או רופא.
        </li>
        <li>
          הניתוח מבוסס על <strong>מצלמה בודדת</strong> ואלגוריתם זיהוי שלד
          אוטומטי, ולכן הוא מוגבל ואינו מדויק כמו בדיקה במעבדת תנועה.
        </li>
        <li>
          כל העיבוד מתבצע <strong>על המכשיר שלך בלבד</strong> — הווידאו לא
          נשלח ולא נשמר בשום שרת.
        </li>
        <li>
          אם המערכת לא תזהה שלד ברור בווידאו, תקבלו על כך הודעה מפורשת במקום
          תוצאה שגויה.
        </li>
      </ul>
    </div>
  );
}
