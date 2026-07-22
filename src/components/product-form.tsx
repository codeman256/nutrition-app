"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Trash2,
  Plus,
  Upload,
  Info,
  GripVertical,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Camera,
  Calculator,
  Loader2,
} from "lucide-react";
import { NUTRIENTS, NUTRIENT_BY_ID, guessForm, matchNutrient } from "@/data/nutrients";
import { iuEquivalent, parseUnit, toCanonicalAmount } from "@/lib/planner";
import { resolvePill, serializePill } from "@/data/pills";
import { PillDesigner } from "@/components/pill-designer";
import { saveProduct, type SaveProductInput } from "@/lib/actions/products";
import type { IngredientDraft, ProductDraft } from "@/lib/lookup/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const UNTRACKED = "__untracked__";
// Radix Select can't use an empty-string value, so a blank unit is a sentinel.
const NO_UNIT = "__no_unit__";

// Labels print IU as whole numbers; masses read cleanest at three significant
// figures ("300", "1.5"). Both go through the locale grouping so 1,000 reads
// like the bottle.
const fmtIu = (v: number) => new Intl.NumberFormat().format(Math.round(v));
const fmtMass = (v: number) =>
  new Intl.NumberFormat().format(Number(v.toPrecision(3)));

export function ProductForm({
  draft,
  productId,
  existingImagePath,
}: {
  draft: ProductDraft;
  productId?: number;
  existingImagePath?: string | null;
}) {
  const router = useRouter();
  const [name, setName] = useState(draft.name);
  // The alternate-name picker lists only the source's own names. It never feeds
  // the current typed value back in as an option — doing that churned the item
  // set on every keystroke and broke editing the field.
  const nameOptions = draft.nameOptions ?? [];
  const [brand, setBrand] = useState(draft.brand ?? "");
  const [servingSize, setServingSize] = useState(draft.servingSize ?? "");
  const [servingsPerContainer, setServingsPerContainer] = useState(
    draft.servingsPerContainer != null ? String(draft.servingsPerContainer) : "",
  );
  const [stockServings, setStockServings] = useState(
    draft.stockServings != null ? String(draft.stockServings) : "",
  );
  const [ingredients, setIngredients] = useState<IngredientDraft[]>(
    draft.ingredients.length > 0
      ? draft.ingredients
      : [{ label: "", nutrientId: null, amountPerServing: 0, unit: "mg" }],
  );
  const [imagePath, setImagePath] = useState<string | null>(existingImagePath ?? null);
  const [pill, setPill] = useState(() =>
    resolvePill(draft.pillStyle, draft.pillColor),
  );
  const [busy, setBusy] = useState(false);
  const [reordering, setReordering] = useState(false);
  const dragIndex = useRef<number | null>(null);

  function updateIngredient(index: number, patch: Partial<IngredientDraft>) {
    setIngredients((rows) =>
      rows.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }

  function moveIngredient(from: number, to: number) {
    setIngredients((rows) => {
      if (from === to || to < 0 || to >= rows.length) return rows;
      const next = rows.slice();
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  }

  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);

  async function addFromPhoto(file: File) {
    setOcrBusy(true);
    setOcrProgress(0);
    try {
      const { recognizeLabel } = await import("@/lib/ocr-run");
      const found = await recognizeLabel(file, setOcrProgress);
      if (found.length === 0) {
        toast.warning(
          "Couldn't read any ingredient lines. Try a sharper, well-lit photo of the Supplement Facts panel.",
        );
        return;
      }
      setIngredients((rows) => {
        // drop a single empty starter row so the photo's rows aren't buried
        const kept = rows.filter(
          (r) => r.label.trim() !== "" || r.amountPerServing > 0,
        );
        return [...kept, ...found];
      });
      toast.success(`Added ${found.length} ingredient line(s) — review and correct them.`);
    } catch {
      toast.error("Text recognition failed. Add the rows manually.");
    } finally {
      setOcrBusy(false);
    }
  }

  async function handleUpload(file: File) {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/uploads", { method: "POST", body: form });
    const body = await res.json();
    if (!res.ok) {
      toast.error(body.error ?? "Upload failed");
      return;
    }
    setImagePath(body.path);
    toast.success("Photo attached");
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    const input: SaveProductInput = {
      ...draft,
      id: productId,
      name,
      brand: brand || null,
      servingSize: servingSize || null,
      servingsPerContainer: servingsPerContainer.trim()
        ? Number(servingsPerContainer)
        : null,
      stockServings: stockServings.trim() ? Number(stockServings) : null,
      ingredients,
      imagePath,
      pillColor: null,
      pillStyle: serializePill(pill),
    };
    const result = await saveProduct(input);
    setBusy(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Product saved");
    router.push("/products");
    router.refresh();
  }

  const imageSrc = imagePath ? `/api/uploads/${imagePath}` : draft.imageUrl;

  // Count only rows the user has actually filled in, so the number lines up with
  // the ingredient lines printed on the bottle (the blank starter row doesn't).
  const filledCount = ingredients.filter(
    (r) => r.label.trim() !== "" || r.amountPerServing > 0,
  ).length;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="p-name">Product name</Label>
            <Input id="p-name" required value={name} onChange={(e) => setName(e.target.value)} />
            {nameOptions.length > 1 && (
              <div className="flex flex-col gap-1">
                <Label htmlFor="p-name-alt" className="text-xs font-normal text-muted-foreground">
                  This licence covers {nameOptions.length} names — pick the one
                  on your bottle, or edit the field above.
                </Label>
                {/* Picker only writes into the name field; it never reads back
                    from it, so typing in the field above is never overridden.
                    Shows the placeholder once the name no longer matches an
                    option (e.g. after a manual edit). */}
                <Select
                  value={nameOptions.includes(name) ? name : ""}
                  onValueChange={setName}
                >
                  <SelectTrigger id="p-name-alt" className="w-full">
                    <SelectValue placeholder="Choose a listed name…" />
                  </SelectTrigger>
                  <SelectContent>
                    {nameOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="p-brand">Brand</Label>
              <Input id="p-brand" value={brand} onChange={(e) => setBrand(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="p-serving">Serving size</Label>
              <Input
                id="p-serving"
                placeholder="e.g. 1 capsule"
                value={servingSize}
                onChange={(e) => setServingSize(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="p-per-container">Servings per container</Label>
              <Input
                id="p-per-container"
                type="number"
                min={0}
                step="any"
                placeholder="e.g. 90"
                value={servingsPerContainer}
                onChange={(e) => setServingsPerContainer(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="p-stock">Servings on hand</Label>
              <Input
                id="p-stock"
                type="number"
                min={0}
                step="any"
                placeholder="how many you have now"
                value={stockServings}
                onChange={(e) => setStockServings(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Used to estimate days remaining. Update it when you refill.
              </p>
            </div>
          </div>
      </div>

      {/* Appearance: your own bottle photo on the left, the pill designer on
          the right — pick either. A photo, if added, is shown instead. */}
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="p-photo">Photo of your container</Label>
          <p className="text-xs text-muted-foreground">
            Upload your own photo. If you add one it&apos;s shown instead of the
            pill.
          </p>
          {imageSrc && (
            <div className="flex items-start gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageSrc}
                alt=""
                className="size-24 rounded-lg border object-cover"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setImagePath(null)}
              >
                Remove
              </Button>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Input
              id="p-photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="max-w-xs"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleUpload(file);
              }}
            />
            <Upload className="size-4 text-muted-foreground" aria-hidden="true" />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label>Pill designer</Label>
          <p className="text-xs text-muted-foreground">
            Shown when there&apos;s no photo.
          </p>
          <PillDesigner value={pill} onChange={setPill} />
        </div>
      </div>

      <fieldset className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <legend className="flex items-center gap-2 text-sm font-medium">
            Ingredients per serving
            <span
              className="rounded-full border px-2 py-0.5 text-xs font-normal text-muted-foreground"
              title="Filled-in rows — compare this to the number of ingredient lines on your bottle."
            >
              {filledCount} {filledCount === 1 ? "ingredient" : "ingredients"}
            </span>
          </legend>
          {ingredients.length > 1 && (
            <Button
              type="button"
              variant={reordering ? "default" : "outline"}
              size="sm"
              className="gap-1"
              aria-pressed={reordering}
              onClick={() => setReordering((v) => !v)}
            >
              <ArrowUpDown className="size-4" aria-hidden="true" />
              {reordering ? "Done" : "Reorder"}
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {reordering
            ? "Drag the handle, use the arrows, or type a row's position to match your bottle's order."
            : "Rows matched to a tracked nutrient count toward your daily totals; set the nutrient to “Not tracked” for herbs and blends."}
        </p>
        {ingredients.map((row, i) => {
          const def = row.nutrientId ? NUTRIENT_BY_ID.get(row.nutrientId) : null;
          // For nutrients labelled in IU (A/D/E, and β-carotene as a vitamin-A
          // form) echo the conversion so the user can confirm the row matches
          // the bottle: a mass amount shows its IU, an IU amount shows its mass.
          const iuEcho =
            def?.iuFactors && row.amountPerServing > 0
              ? iuEquivalent(def, row.amountPerServing, row.unit ?? "", row.form)
              : null;
          const massEcho =
            def?.iuFactors &&
            row.amountPerServing > 0 &&
            parseUnit(row.unit ?? "") === "IU"
              ? toCanonicalAmount(def, row.amountPerServing, row.unit ?? "", row.form)
              : null;
          return (
          <div
            key={i}
            className="flex flex-col gap-1.5 rounded-md border p-2"
            draggable={reordering}
            onDragStart={reordering ? () => (dragIndex.current = i) : undefined}
            onDragOver={reordering ? (e) => e.preventDefault() : undefined}
            onDrop={
              reordering
                ? (e) => {
                    e.preventDefault();
                    if (dragIndex.current !== null) moveIngredient(dragIndex.current, i);
                    dragIndex.current = null;
                  }
                : undefined
            }
          >
          {reordering && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <GripVertical className="size-4 cursor-grab" aria-hidden="true" />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                disabled={i === 0}
                aria-label="Move up"
                onClick={() => moveIngredient(i, i - 1)}
              >
                <ArrowUp className="size-4" aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                disabled={i === ingredients.length - 1}
                aria-label="Move down"
                onClick={() => moveIngredient(i, i + 1)}
              >
                <ArrowDown className="size-4" aria-hidden="true" />
              </Button>
            </div>
          )}
          <div
            className="grid grid-cols-[1fr_5.5rem_5rem_auto] items-end gap-2 sm:grid-cols-[1fr_11rem_6rem_5.5rem_auto]"
          >
            <div className="col-span-full flex flex-col gap-1 sm:col-span-1">
              <Label htmlFor={`ing-label-${i}`} className="text-xs">
                Label name
              </Label>
              <Input
                id={`ing-label-${i}`}
                value={row.label}
                placeholder="Vitamin D3 (cholecalciferol)"
                onChange={(e) => {
                  const label = e.target.value;
                  const matched = matchNutrient(label);
                  updateIngredient(i, {
                    label,
                    nutrientId: matched?.id ?? row.nutrientId,
                    form: guessForm(label) ?? row.form,
                  });
                }}
              />
            </div>
            <div className="col-span-full flex flex-col gap-1 sm:col-span-1">
              <Label htmlFor={`ing-nutrient-${i}`} className="text-xs">
                Tracked nutrient
              </Label>
              <Select
                value={row.nutrientId ?? UNTRACKED}
                onValueChange={(v) =>
                  updateIngredient(i, { nutrientId: v === UNTRACKED ? null : v })
                }
              >
                <SelectTrigger id={`ing-nutrient-${i}`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNTRACKED}>Not tracked</SelectItem>
                  {NUTRIENTS.map((n) => (
                    <SelectItem key={n.id} value={n.id}>
                      {n.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor={`ing-amount-${i}`} className="text-xs">
                Amount
              </Label>
              <Input
                id={`ing-amount-${i}`}
                type="number"
                min={0}
                step="any"
                value={row.amountPerServing || ""}
                onChange={(e) =>
                  updateIngredient(i, { amountPerServing: Number(e.target.value) })
                }
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor={`ing-unit-${i}`} className="text-xs">
                Unit
              </Label>
              <Select
                value={row.unit || NO_UNIT}
                onValueChange={(unit) =>
                  updateIngredient(i, { unit: unit === NO_UNIT ? "" : unit })
                }
              >
                <SelectTrigger id={`ing-unit-${i}`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mcg">mcg</SelectItem>
                  <SelectItem value="mg">mg</SelectItem>
                  <SelectItem value="g">g</SelectItem>
                  <SelectItem value="IU">IU</SelectItem>
                  <SelectItem value={NO_UNIT}>—</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Remove ${row.label || "ingredient"} row`}
              onClick={() => setIngredients((rows) => rows.filter((_, j) => j !== i))}
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </Button>
          </div>

          {def?.forms && (
            <div className="flex flex-col gap-1 sm:max-w-xs">
              <Label htmlFor={`ing-form-${i}`} className="text-xs">
                Form
              </Label>
              <Select
                value={row.form ?? def.forms[0].value}
                onValueChange={(form) => updateIngredient(i, { form })}
              >
                <SelectTrigger id={`ing-form-${i}`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {def.forms.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {def?.note && (
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              <span>{def.note}</span>
            </p>
          )}
          {iuEcho !== null && (
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <Calculator className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              <span>
                ={" "}
                <span className="font-medium text-foreground">{fmtIu(iuEcho)} IU</span>{" "}
                — should match the IU printed on your label.
              </span>
            </p>
          )}
          {massEcho !== null && (
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <Calculator className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              <span>
                ={" "}
                <span className="font-medium text-foreground">
                  {fmtMass(massEcho)} {def!.unit}
                </span>{" "}
                — the mass equivalent VitaPlan tracks for this row.
              </span>
            </p>
          )}
          </div>
          );
        })}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={() =>
              setIngredients((rows) => [
                ...rows,
                { label: "", nutrientId: null, amountPerServing: 0, unit: "mg" },
              ])
            }
          >
            <Plus className="size-4" aria-hidden="true" /> Add ingredient
          </Button>

          {/* In-form OCR: read a label photo and append its rows. Handy for
              products (e.g. enzyme blends) whose ingredients don't come from a
              database lookup. Runs locally; the photo never leaves the device. */}
          <Button asChild variant="outline" size="sm" className="gap-1" disabled={ocrBusy}>
            <label className="cursor-pointer">
              {ocrBusy ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Reading… {ocrProgress}%
                </>
              ) : (
                <>
                  <Camera className="size-4" aria-hidden="true" /> Add ingredients from photo
                </>
              )}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                disabled={ocrBusy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void addFromPhoto(file);
                  e.target.value = "";
                }}
              />
            </label>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          &quot;Add ingredients from photo&quot; reads the Supplement Facts panel
          on your device and appends what it finds — useful when a lookup misses
          ingredients like digestive enzymes.
        </p>
      </fieldset>

      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : productId ? "Save changes" : "Add product"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
