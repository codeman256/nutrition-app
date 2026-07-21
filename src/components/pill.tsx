import {
  PILL_SIZES,
  pillColorHex,
  resolvePill,
  type PillAppearance,
} from "@/data/pills";

const STROKE = "rgba(0,0,0,0.18)";
const GLOSS = "rgba(255,255,255,0.35)";

function sizePx(sizeKey: string): number {
  return PILL_SIZES.find((s) => s.key === sizeKey)?.px ?? 48;
}

/**
 * Draws a pill from a resolved {@link PillAppearance}. Pure SVG, no clip paths
 * (so ids can't collide when several render on one page), theme-independent.
 */
export function Pill({
  appearance,
  className,
  title,
}: {
  appearance: PillAppearance;
  className?: string;
  title?: string;
}) {
  const px = sizePx(appearance.size);
  const a = pillColorHex(appearance.color);
  const b = pillColorHex(appearance.color2 ?? appearance.color);

  const common = {
    className,
    role: "img" as const,
    "aria-label": title ?? "pill",
  };

  switch (appearance.shape) {
    case "round": {
      const d = px;
      return (
        <svg viewBox="0 0 32 32" width={d} height={d} {...common}>
          <circle cx="16" cy="16" r="15" fill={a} stroke={STROKE} />
          <line x1="4" y1="16" x2="28" y2="16" stroke={STROKE} strokeWidth="1" />
          <ellipse cx="12" cy="11" rx="6" ry="3.5" fill={GLOSS} />
        </svg>
      );
    }
    case "softgel": {
      const w = px;
      const h = px * (26 / 40);
      return (
        <svg viewBox="0 0 40 26" width={w} height={h} {...common}>
          <ellipse cx="20" cy="13" rx="19" ry="12" fill={a} stroke={STROKE} />
          <ellipse cx="13" cy="8" rx="7" ry="3.5" fill={GLOSS} />
        </svg>
      );
    }
    case "caplet": {
      const w = px;
      const h = px * (22 / 48);
      return (
        <svg viewBox="0 0 48 22" width={w} height={h} {...common}>
          <rect x="1" y="1" width="46" height="20" rx="10" fill={a} stroke={STROKE} />
          <line x1="24" y1="4" x2="24" y2="18" stroke={STROKE} strokeWidth="1" />
          <rect x="6" y="4" width="18" height="4" rx="2" fill={GLOSS} />
        </svg>
      );
    }
    case "capsule":
    default: {
      const w = px;
      const h = px * (20 / 48);
      // two half-paths so the halves can differ without a clip path
      const left = "M24 1 L11 1 A10 10 0 0 0 1 11 A10 10 0 0 0 11 21 L24 21 Z";
      const right = "M24 1 L37 1 A10 10 0 0 1 47 11 A10 10 0 0 1 37 21 L24 21 Z";
      return (
        <svg viewBox="0 0 48 22" width={w} height={h} {...common}>
          <path d={left} fill={a} />
          <path d={right} fill={b} />
          <line x1="24" y1="1" x2="24" y2="21" stroke={STROKE} strokeWidth="1" />
          <path
            d="M1 11 A10 10 0 0 1 11 1 L37 1 A10 10 0 0 1 47 11 A10 10 0 0 1 37 21 L11 21 A10 10 0 0 1 1 11 Z"
            fill="none"
            stroke={STROKE}
          />
          <rect x="6" y="4" width="12" height="3.5" rx="1.75" fill={GLOSS} />
        </svg>
      );
    }
  }
}

/** Convenience for the common stored-value case. */
export function StoredPill({
  pillStyle,
  pillColor,
  className,
  title,
}: {
  pillStyle: string | null | undefined;
  pillColor?: string | null;
  className?: string;
  title?: string;
}) {
  return (
    <Pill
      appearance={resolvePill(pillStyle, pillColor)}
      className={className}
      title={title}
    />
  );
}
