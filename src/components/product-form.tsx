"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, Plus, Upload } from "lucide-react";
import { NUTRIENTS, matchNutrient } from "@/data/nutrients";
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
  const [brand, setBrand] = useState(draft.brand ?? "");
  const [servingSize, setServingSize] = useState(draft.servingSize ?? "");
  const [ingredients, setIngredients] = useState<IngredientDraft[]>(
    draft.ingredients.length > 0
      ? draft.ingredients
      : [{ label: "", nutrientId: null, amountPerServing: 0, unit: "mg" }],
  );
  const [imagePath, setImagePath] = useState<string | null>(existingImagePath ?? null);
  const [busy, setBusy] = useState(false);

  function updateIngredient(index: number, patch: Partial<IngredientDraft>) {
    setIngredients((rows) =>
      rows.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
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
      ingredients,
      imagePath,
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

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="flex items-start gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {imageSrc ? (
          <img
            src={imageSrc}
            alt=""
            className="size-24 shrink-0 rounded-lg border object-cover"
          />
        ) : (
          <div
            aria-hidden="true"
            className="flex size-24 shrink-0 items-center justify-center rounded-lg border text-3xl"
          >
            💊
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="p-name">Product name</Label>
            <Input id="p-name" required value={name} onChange={(e) => setName(e.target.value)} />
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
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="p-photo">Your photo of the bottle (optional)</Label>
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

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-medium">
          Ingredients per serving
        </legend>
        <p className="text-xs text-muted-foreground">
          Rows matched to a tracked nutrient count toward your daily totals;
          set the nutrient to &quot;Not tracked&quot; for herbs and blends.
        </p>
        {ingredients.map((row, i) => (
          <div
            key={i}
            className="grid grid-cols-[1fr_5.5rem_5rem_auto] items-end gap-2 sm:grid-cols-[1fr_11rem_6rem_5.5rem_auto]"
          >
            <div className="flex flex-col gap-1">
              <Label htmlFor={`ing-label-${i}`} className="text-xs">
                Label name
              </Label>
              <Input
                id={`ing-label-${i}`}
                value={row.label}
                placeholder="Vitamin D3 (cholecalciferol)"
                onChange={(e) => {
                  const label = e.target.value;
                  updateIngredient(i, {
                    label,
                    nutrientId: matchNutrient(label)?.id ?? row.nutrientId,
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
                value={row.unit}
                onValueChange={(unit) => updateIngredient(i, { unit })}
              >
                <SelectTrigger id={`ing-unit-${i}`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mcg">mcg</SelectItem>
                  <SelectItem value="mg">mg</SelectItem>
                  <SelectItem value="g">g</SelectItem>
                  <SelectItem value="IU">IU</SelectItem>
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
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start gap-1"
          onClick={() =>
            setIngredients((rows) => [
              ...rows,
              { label: "", nutrientId: null, amountPerServing: 0, unit: "mg" },
            ])
          }
        >
          <Plus className="size-4" aria-hidden="true" /> Add ingredient
        </Button>
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
