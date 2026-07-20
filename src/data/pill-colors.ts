/** Preset placeholder pill colours (Tailwind classes) for products without a photo. */
export interface PillColor {
  key: string;
  label: string;
  /** background + text classes for the placeholder tile */
  className: string;
}

export const PILL_COLORS: PillColor[] = [
  { key: "slate", label: "Grey", className: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-100" },
  { key: "red", label: "Red", className: "bg-red-200 text-red-800 dark:bg-red-800 dark:text-red-100" },
  { key: "orange", label: "Orange", className: "bg-orange-200 text-orange-800 dark:bg-orange-800 dark:text-orange-100" },
  { key: "amber", label: "Yellow", className: "bg-amber-200 text-amber-900 dark:bg-amber-700 dark:text-amber-50" },
  { key: "green", label: "Green", className: "bg-emerald-200 text-emerald-800 dark:bg-emerald-800 dark:text-emerald-100" },
  { key: "blue", label: "Blue", className: "bg-blue-200 text-blue-800 dark:bg-blue-800 dark:text-blue-100" },
  { key: "purple", label: "Purple", className: "bg-purple-200 text-purple-800 dark:bg-purple-800 dark:text-purple-100" },
  { key: "pink", label: "Pink", className: "bg-pink-200 text-pink-800 dark:bg-pink-800 dark:text-pink-100" },
];

const PILL_COLOR_BY_KEY = new Map(PILL_COLORS.map((c) => [c.key, c]));

export function pillColorClass(key: string | null | undefined): string {
  return (
    (key && PILL_COLOR_BY_KEY.get(key)?.className) ??
    "bg-muted text-foreground"
  );
}
