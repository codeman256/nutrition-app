"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { EVERY_DAY, activeDayCount } from "@/lib/planner";
import { saveRegimen, type RegimenItemUpdate } from "@/lib/actions/regimen";
import { pillColorClass } from "@/data/pill-colors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const DAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];
const DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export interface RegimenProductRow {
  productId: number;
  name: string;
  brand: string | null;
  servingSize: string | null;
  imageSrc: string | null;
  pillColor: string | null;
  /** null when the product isn't in the regimen */
  servingsPerDay: number | null;
  daysOfWeek: number;
}

export function RegimenEditor({ initial }: { initial: RegimenProductRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [busy, setBusy] = useState(false);

  function update(productId: number, patch: Partial<RegimenProductRow>) {
    setRows((all) =>
      all.map((row) => (row.productId === productId ? { ...row, ...patch } : row)),
    );
  }

  async function handleSave() {
    setBusy(true);
    const items: RegimenItemUpdate[] = rows
      .filter((row) => row.servingsPerDay !== null && row.daysOfWeek > 0)
      .map((row) => ({
        productId: row.productId,
        servingsPerDay: row.servingsPerDay!,
        daysOfWeek: row.daysOfWeek,
      }));
    const result = await saveRegimen(items);
    setBusy(false);
    if (result.ok) {
      toast.success("Regimen saved");
      router.refresh();
    }
  }

  return (
    <div className="flex max-w-3xl flex-col gap-3">
      {rows.map((row) => {
        const active = row.servingsPerDay !== null;
        return (
          <Card key={row.productId} className={cn("py-0", !active && "opacity-70")}>
            <CardContent className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <Switch
                  id={`active-${row.productId}`}
                  checked={active}
                  onCheckedChange={(checked) =>
                    update(row.productId, {
                      servingsPerDay: checked ? 1 : null,
                      daysOfWeek: checked ? row.daysOfWeek || EVERY_DAY : row.daysOfWeek,
                    })
                  }
                  aria-label={`Include ${row.name} in regimen`}
                />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {row.imageSrc ? (
                  <img
                    src={row.imageSrc}
                    alt=""
                    className="size-12 shrink-0 rounded-md border object-cover"
                  />
                ) : (
                  <div
                    aria-hidden="true"
                    className={cn(
                      "flex size-12 shrink-0 items-center justify-center rounded-md border",
                      pillColorClass(row.pillColor),
                    )}
                  >
                    💊
                  </div>
                )}
                <div className="min-w-0">
                  <Label htmlFor={`active-${row.productId}`} className="block truncate">
                    {row.name}
                  </Label>
                  <p className="truncate text-xs text-muted-foreground">
                    {[row.brand, row.servingSize].filter(Boolean).join(" · ") || " "}
                  </p>
                </div>
              </div>

              {active && (
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`servings-${row.productId}`} className="text-xs">
                      Servings/day
                    </Label>
                    <Input
                      id={`servings-${row.productId}`}
                      type="number"
                      min={0.5}
                      max={20}
                      step={0.5}
                      value={row.servingsPerDay ?? 1}
                      onChange={(e) =>
                        update(row.productId, {
                          servingsPerDay: Number(e.target.value) || 1,
                        })
                      }
                      className="w-20"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium">
                        {activeDayCount(row.daysOfWeek) === 7
                          ? "Every day"
                          : activeDayCount(row.daysOfWeek) === 0
                            ? "No days selected"
                            : `${activeDayCount(row.daysOfWeek)} days`}
                      </span>
                      {activeDayCount(row.daysOfWeek) !== 7 && (
                        <button
                          type="button"
                          className="text-xs text-primary underline-offset-2 hover:underline"
                          onClick={() => update(row.productId, { daysOfWeek: EVERY_DAY })}
                        >
                          Select all
                        </button>
                      )}
                    </div>
                    <div
                      role="group"
                      aria-label={`Days of week for ${row.name} — highlighted days are on. Tap to skip a day.`}
                      className="flex gap-1"
                    >
                      {DAY_LETTERS.map((letter, day) => {
                        const on = ((row.daysOfWeek >> day) & 1) === 1;
                        return (
                          <button
                            key={day}
                            type="button"
                            aria-pressed={on}
                            aria-label={`${DAY_NAMES[day]}${on ? " (on)" : " (off)"}`}
                            title={`${DAY_NAMES[day]} — ${on ? "on, tap to skip" : "off, tap to add"}`}
                            onClick={() =>
                              update(row.productId, {
                                daysOfWeek: row.daysOfWeek ^ (1 << day),
                              })
                            }
                            className={cn(
                              "flex size-8 items-center justify-center rounded-full border text-xs font-medium transition-colors",
                              on
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-dashed bg-background text-muted-foreground hover:bg-muted",
                            )}
                          >
                            {letter}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      <Button onClick={() => void handleSave()} disabled={busy} className="self-start">
        {busy ? "Saving…" : "Save regimen"}
      </Button>
    </div>
  );
}
