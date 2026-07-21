/**
 * Pill appearance for products without a photo. A pill has a shape, a size, a
 * primary colour and — for capsules — an optional second colour so the two
 * halves can differ, matching how real capsules look.
 */

export interface PillColor {
  key: string;
  label: string;
  /** solid fill; pills are physical objects, so colours are theme-independent */
  hex: string;
}

export const PILL_COLORS: PillColor[] = [
  { key: "white", label: "White", hex: "#eef2f6" },
  { key: "grey", label: "Grey", hex: "#c2ccd8" },
  { key: "red", label: "Red", hex: "#e8523f" },
  { key: "orange", label: "Orange", hex: "#f08a2e" },
  { key: "yellow", label: "Yellow", hex: "#f3c53b" },
  { key: "green", label: "Green", hex: "#3fb862" },
  { key: "teal", label: "Teal", hex: "#20b2a6" },
  { key: "blue", label: "Blue", hex: "#3f83e8" },
  { key: "purple", label: "Purple", hex: "#9a5ce0" },
  { key: "pink", label: "Pink", hex: "#e364a6" },
  { key: "brown", label: "Brown", hex: "#a5722f" },
];

const COLOR_BY_KEY = new Map(PILL_COLORS.map((c) => [c.key, c]));

// Colours from the previous background-tile palette, mapped onto the new set.
const LEGACY_COLOR: Record<string, string> = {
  slate: "grey",
  amber: "yellow",
  emerald: "green",
};

export interface PillShape {
  key: string;
  label: string;
  /** true when the shape supports a two-tone split (left/right halves) */
  split: boolean;
}

export const PILL_SHAPES: PillShape[] = [
  { key: "capsule", label: "Capsule", split: true },
  { key: "caplet", label: "Caplet", split: false },
  { key: "round", label: "Round tablet", split: false },
  { key: "softgel", label: "Softgel", split: false },
];

const SHAPE_KEYS = new Set(PILL_SHAPES.map((s) => s.key));

export interface PillSize {
  key: string;
  label: string;
  /** longest on-screen dimension in px */
  px: number;
}

export const PILL_SIZES: PillSize[] = [
  { key: "sm", label: "Small", px: 34 },
  { key: "md", label: "Medium", px: 48 },
  { key: "lg", label: "Large", px: 64 },
];

const SIZE_KEYS = new Set(PILL_SIZES.map((s) => s.key));

export interface PillAppearance {
  shape: string;
  size: string;
  color: string;
  /** second half colour for capsules; null = same as `color` */
  color2: string | null;
}

export const DEFAULT_PILL: PillAppearance = {
  shape: "capsule",
  size: "md",
  color: "grey",
  color2: "blue",
};

export function pillColorHex(key: string | null | undefined): string {
  return (key && COLOR_BY_KEY.get(key)?.hex) || COLOR_BY_KEY.get("grey")!.hex;
}

/** Serialize an appearance for the `pill_style` column. */
export function serializePill(pill: PillAppearance): string {
  return JSON.stringify(pill);
}

function sanitize(raw: Partial<PillAppearance> | null | undefined): PillAppearance {
  const shape = raw?.shape && SHAPE_KEYS.has(raw.shape) ? raw.shape : DEFAULT_PILL.shape;
  const size = raw?.size && SIZE_KEYS.has(raw.size) ? raw.size : DEFAULT_PILL.size;
  const color = raw?.color && COLOR_BY_KEY.has(raw.color) ? raw.color : DEFAULT_PILL.color;
  const color2 =
    raw?.color2 && COLOR_BY_KEY.has(raw.color2) ? raw.color2 : null;
  return { shape, size, color, color2 };
}

/**
 * Resolve a product's stored appearance. Prefers the structured `pillStyle`
 * JSON; falls back to the legacy single `pillColor` key; otherwise the default.
 */
export function resolvePill(
  pillStyle: string | null | undefined,
  legacyColor?: string | null,
): PillAppearance {
  if (pillStyle) {
    try {
      return sanitize(JSON.parse(pillStyle) as Partial<PillAppearance>);
    } catch {
      // fall through to legacy / default
    }
  }
  if (legacyColor) {
    const mapped = LEGACY_COLOR[legacyColor] ?? legacyColor;
    const color = COLOR_BY_KEY.has(mapped) ? mapped : DEFAULT_PILL.color;
    return { shape: "capsule", size: "md", color, color2: null };
  }
  return DEFAULT_PILL;
}
