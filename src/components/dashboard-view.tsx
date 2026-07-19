"use client";

import { useMemo, useState } from "react";
import {
  Check,
  CircleAlert,
  Download,
  FlaskConical,
  Minus,
  TriangleAlert,
} from "lucide-react";
import {
  EVERY_DAY,
  WEEKDAY_LABELS,
  computeDay,
  whatIf,
  type DriQuery,
  type NutrientRow,
  type ProductInput,
  type RegimenItemInput,
  type Weekday,
} from "@/lib/planner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

function formatAmount(n: number): string {
  if (n >= 100) return Math.round(n).toLocaleString();
  if (n >= 10) return n.toFixed(1).replace(/\.0$/, "");
  return n.toFixed(2).replace(/\.?0+$/, "");
}

const STATUS_META = {
  "below-rda": { label: "Below target", icon: Minus, className: "text-muted-foreground" },
  "meets-rda": { label: "Target met", icon: Check, className: "text-emerald-600 dark:text-emerald-400" },
  "near-ul": { label: "Near limit", icon: TriangleAlert, className: "text-amber-600 dark:text-amber-400" },
  "over-ul": { label: "Over limit", icon: CircleAlert, className: "text-red-600 dark:text-red-400" },
} as const;

const NONE = "__none__";

export function DashboardView({
  products,
  regimen,
  profile,
  today,
}: {
  products: ProductInput[];
  regimen: RegimenItemInput[];
  profile: DriQuery;
  today: Weekday;
}) {
  const [day, setDay] = useState<Weekday>(today);
  const [whatIfId, setWhatIfId] = useState<string>(NONE);
  const [whatIfServings, setWhatIfServings] = useState(1);

  const inRegimen = new Set(regimen.map((r) => r.productId));

  const result = useMemo(() => {
    if (whatIfId !== NONE) {
      const candidate = products.find((p) => p.id === Number(whatIfId));
      if (candidate) {
        return whatIf(products, regimen, candidate, whatIfServings, day, profile);
      }
    }
    return null;
  }, [whatIfId, whatIfServings, products, regimen, day, profile]);

  const basePlan = useMemo(
    () => computeDay(products, regimen, day, profile),
    [products, regimen, day, profile],
  );
  const plan = result ? result.after : basePlan;

  function exportCsv() {
    const cols = plan.products.map((p) => p.name);
    const header = ["Nutrient", "Unit", ...cols, "Total", "Recommended", "% Recommended", "Upper limit", "% Upper limit", "Status"];
    const lines = [header];
    for (const row of plan.rows) {
      lines.push([
        row.nutrient.name,
        row.nutrient.unit,
        ...plan.products.map((p) =>
          row.contributions[p.id] ? formatAmount(row.contributions[p.id]) : "0",
        ),
        formatAmount(row.total),
        row.recommended !== null ? formatAmount(row.recommended) : "",
        row.pctRecommended !== null ? Math.round(row.pctRecommended) + "%" : "",
        row.ul !== null ? formatAmount(row.ul) : "",
        row.pctUl !== null ? Math.round(row.pctUl) + "%" : "",
        STATUS_META[row.status].label,
      ]);
    }
    const csv = lines
      .map((cells) =>
        cells.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(","),
      )
      .join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vitaplan-${WEEKDAY_LABELS[day].toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={String(day)} onValueChange={(v) => setDay(Number(v) as Weekday)}>
          <TabsList aria-label="Day of week">
            {WEEKDAY_LABELS.map((label, i) => (
              <TabsTrigger key={label} value={String(i)} title={label}>
                <span aria-hidden="true">{label.slice(0, 3)}</span>
                <span className="sr-only">{label}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Button variant="outline" size="sm" className="gap-1" onClick={exportCsv}>
          <Download className="size-4" aria-hidden="true" /> Export CSV
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-2 rounded-lg border p-3">
        <FlaskConical className="mb-2 size-4 text-muted-foreground" aria-hidden="true" />
        <div className="flex flex-col gap-1">
          <Label htmlFor="whatif-product" className="text-xs">
            What if I add…
          </Label>
          <Select value={whatIfId} onValueChange={setWhatIfId}>
            <SelectTrigger id="whatif-product" className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Nothing — show my plan</SelectItem>
              {products.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>
                  {p.name}
                  {inRegimen.has(p.id) ? " (more of it)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {whatIfId !== NONE && (
          <div className="flex flex-col gap-1">
            <Label htmlFor="whatif-servings" className="text-xs">
              Servings/day
            </Label>
            <Input
              id="whatif-servings"
              type="number"
              min={0.5}
              max={20}
              step={0.5}
              className="w-20"
              value={whatIfServings}
              onChange={(e) => setWhatIfServings(Number(e.target.value) || 1)}
            />
          </div>
        )}
      </div>

      {result && result.newlyOverUl.length > 0 && (
        <Alert variant="destructive">
          <CircleAlert aria-hidden="true" />
          <AlertTitle>This addition would go over safe limits</AlertTitle>
          <AlertDescription>
            {result.newlyOverUl
              .map(
                (row) =>
                  `${row.nutrient.name}: ${formatAmount(row.total)} ${row.nutrient.unit} vs limit ${formatAmount(row.ul!)} ${row.nutrient.unit}`,
              )
              .join(" · ")}
          </AlertDescription>
        </Alert>
      )}
      {result && result.newlyOverUl.length === 0 && (
        <Alert>
          <Check aria-hidden="true" />
          <AlertTitle>Nothing new goes over its limit</AlertTitle>
          <AlertDescription>
            The grid below shows your {WEEKDAY_LABELS[day]} totals with the
            addition included.
          </AlertDescription>
        </Alert>
      )}

      {!result && plan.overUl.length > 0 && (
        <Alert variant="destructive">
          <CircleAlert aria-hidden="true" />
          <AlertTitle>
            Over the safe upper limit on {WEEKDAY_LABELS[day]}
          </AlertTitle>
          <AlertDescription>
            {plan.overUl
              .map(
                (row) =>
                  `${row.nutrient.name}: ${formatAmount(row.total)} ${row.nutrient.unit} vs limit ${formatAmount(row.ul!)} ${row.nutrient.unit}`,
              )
              .join(" · ")}
          </AlertDescription>
        </Alert>
      )}

      {plan.rows.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nothing scheduled for {WEEKDAY_LABELS[day]}. Set up your regimen to
          see totals here.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead scope="col" className="min-w-40">
                  Nutrient
                </TableHead>
                {plan.products.map((p) => (
                  <TableHead scope="col" key={p.id} className="min-w-24">
                    {p.name}
                  </TableHead>
                ))}
                <TableHead scope="col" className="font-semibold">
                  Total
                </TableHead>
                <TableHead scope="col">Target</TableHead>
                <TableHead scope="col">% Target</TableHead>
                <TableHead scope="col">Limit</TableHead>
                <TableHead scope="col">% Limit</TableHead>
                <TableHead scope="col">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plan.rows.map((row: NutrientRow) => {
                const meta = STATUS_META[row.status];
                const Icon = meta.icon;
                return (
                  <TableRow key={row.nutrient.id}>
                    <TableCell className="font-medium">
                      {row.nutrient.name}
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({row.nutrient.unit})
                      </span>
                    </TableCell>
                    {plan.products.map((p) => (
                      <TableCell key={p.id} className="tabular-nums">
                        {row.contributions[p.id]
                          ? formatAmount(row.contributions[p.id])
                          : "—"}
                      </TableCell>
                    ))}
                    <TableCell className="font-semibold tabular-nums">
                      {formatAmount(row.total)}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {row.recommended !== null ? (
                        <>
                          {formatAmount(row.recommended)}
                          {row.isAI && (
                            <span className="text-xs text-muted-foreground" title="Adequate Intake (no RDA established)">
                              *
                            </span>
                          )}
                        </>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {row.pctRecommended !== null
                        ? `${Math.round(row.pctRecommended)}%`
                        : "—"}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {row.ul !== null ? formatAmount(row.ul) : "none set"}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {row.pctUl !== null ? `${Math.round(row.pctUl)}%` : "—"}
                    </TableCell>
                    <TableCell>
                      <span className={cn("flex items-center gap-1 text-xs font-medium", meta.className)}>
                        <Icon className="size-3.5" aria-hidden="true" />
                        {meta.label}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        * Adequate Intake (AI) — used when no RDA has been established. Targets
        and limits are the NIH/NASEM values for your profile. Magnesium&apos;s
        limit applies to supplements only, and sodium&apos;s is the CDRR
        guideline.
      </p>
    </div>
  );
}
