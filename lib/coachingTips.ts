/**
 * One short, careful coaching sentence per check type, shown when that
 * check was flagged in at least one rep. Plain fixed mapping - not
 * generated per-user or per-rep, since the direction of action is the same
 * regardless of which rep triggered it.
 */
export const COACHING_TIPS = {
  kneeValgus:
    "נסו להרגיש שאתם דוחפים את הברכיים החוצה, לכיוון קצות כפות הרגליים, לאורך כל התנועה.",
  backRounding:
    "נסו לשמור על גב תחתון יציב וחזה פתוח לאורך כל הירידה, בלי להרשות לגב להתעגל בתחתית.",
  depth:
    "נסו לרדת מעט יותר, בשליטה, עד שקפל הירך יורד מתחת לגובה הברך.",
} as const;

export const COACHING_TIPS_DISCLAIMER =
  "העצות כלליות בלבד ואינן מהוות אבחון אישי או תחליף לליווי מקצועי.";
