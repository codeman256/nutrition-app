"use client";

import {
  PILL_COLORS,
  PILL_SHAPES,
  PILL_SIZES,
  pillColorHex,
  type PillAppearance,
} from "@/data/pills";
import { Pill } from "@/components/pill";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const splitShape = (shape: string) =>
  PILL_SHAPES.find((s) => s.key === shape)?.split ?? false;

function Swatch({
  color,
  active,
  onClick,
  label,
}: {
  color: string;
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      onClick={onClick}
      style={{ backgroundColor: pillColorHex(color) }}
      className={cn(
        "size-7 rounded-full border-2 transition",
        active ? "border-foreground ring-2 ring-foreground/20" : "border-black/10",
      )}
    />
  );
}

/**
 * Interactive designer for the placeholder pill: shape, size, primary colour,
 * and — for capsules — a second colour for the other half.
 */
export function PillDesigner({
  value,
  onChange,
}: {
  value: PillAppearance;
  onChange: (next: PillAppearance) => void;
}) {
  const set = (patch: Partial<PillAppearance>) => onChange({ ...value, ...patch });
  const canSplit = splitShape(value.shape);

  return (
    <div className="flex flex-col gap-4 rounded-lg border p-4">
      <div className="flex items-center gap-4">
        <div className="flex size-20 shrink-0 items-center justify-center rounded-md border bg-muted/40">
          <Pill appearance={value} />
        </div>
        <p className="text-sm text-muted-foreground">
          Shown in place of a photo. Pick a shape, size and colour so you can
          spot each product at a glance.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label className="text-xs">Shape</Label>
        <div className="flex flex-wrap gap-2">
          {PILL_SHAPES.map((s) => (
            <button
              key={s.key}
              type="button"
              aria-pressed={value.shape === s.key}
              onClick={() => set({ shape: s.key })}
              className={cn(
                "flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm transition",
                value.shape === s.key
                  ? "border-primary bg-primary/10 text-primary"
                  : "hover:bg-muted",
              )}
            >
              <Pill
                appearance={{ ...value, shape: s.key, size: "sm" }}
                title={s.label}
              />
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label className="text-xs">Size</Label>
        <div className="flex gap-2">
          {PILL_SIZES.map((s) => (
            <button
              key={s.key}
              type="button"
              aria-pressed={value.size === s.key}
              onClick={() => set({ size: s.key })}
              className={cn(
                "rounded-md border px-3 py-1.5 text-sm transition",
                value.size === s.key
                  ? "border-primary bg-primary/10 text-primary"
                  : "hover:bg-muted",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* For a capsule the two halves sit side by side — left colours on the
          left, right-half colours on the right — to mirror the pill itself. */}
      <div className={cn("grid gap-4", canSplit && "sm:grid-cols-2")}>
        <div className="flex flex-col gap-2">
          <Label className="text-xs">{canSplit ? "Left half" : "Colour"}</Label>
          <div className="flex flex-wrap gap-2">
            {PILL_COLORS.map((c) => (
              <Swatch
                key={c.key}
                color={c.key}
                label={c.label}
                active={value.color === c.key}
                onClick={() => set({ color: c.key })}
              />
            ))}
          </div>
        </div>

        {canSplit && (
          <div className="flex flex-col gap-2">
            <Label className="text-xs">Right half</Label>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                aria-pressed={value.color2 === null}
                title="Same as the left half"
                onClick={() => set({ color2: null })}
                className={cn(
                  "rounded-md border px-2.5 py-1 text-xs transition",
                  value.color2 === null
                    ? "border-primary bg-primary/10 text-primary"
                    : "hover:bg-muted",
                )}
              >
                Same
              </button>
              {PILL_COLORS.map((c) => (
                <Swatch
                  key={c.key}
                  color={c.key}
                  label={c.label}
                  active={value.color2 === c.key}
                  onClick={() => set({ color2: c.key })}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
