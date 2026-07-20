"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import type { ProductDraft, SearchHit } from "@/lib/lookup/types";
import { parseLabelText } from "@/lib/ocr-parse";
import { ProductForm } from "@/components/product-form";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const EMPTY_DRAFT: ProductDraft = {
  name: "",
  source: "manual",
  ingredients: [],
};

export function AddProductFlow({
  region,
  lnhpdSynced,
}: {
  region: "CA" | "US";
  lnhpdSynced: boolean;
}) {
  const [draft, setDraft] = useState<ProductDraft | null>(null);

  if (draft) {
    return (
      <div className="flex flex-col gap-4">
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={() => setDraft(null)}
        >
          ← Start over
        </Button>
        <ProductForm draft={draft} />
      </div>
    );
  }

  return (
    <Tabs defaultValue="upc" className="max-w-2xl">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="upc">Barcode</TabsTrigger>
        <TabsTrigger value="search">Search</TabsTrigger>
        <TabsTrigger value="photo">Label photo</TabsTrigger>
        <TabsTrigger value="manual">Manual</TabsTrigger>
      </TabsList>
      <TabsContent value="upc" className="pt-4">
        <UpcTab onDraft={setDraft} />
      </TabsContent>
      <TabsContent value="search" className="pt-4">
        <SearchTab region={region} lnhpdSynced={lnhpdSynced} onDraft={setDraft} />
      </TabsContent>
      <TabsContent value="photo" className="pt-4">
        <PhotoTab onDraft={setDraft} />
      </TabsContent>
      <TabsContent value="manual" className="pt-4">
        <p className="mb-4 text-sm text-muted-foreground">
          Type the label in yourself — ingredient names auto-match to tracked
          nutrients as you type.
        </p>
        <Button onClick={() => setDraft(EMPTY_DRAFT)}>Start blank product</Button>
      </TabsContent>
    </Tabs>
  );
}

function UpcTab({ onDraft }: { onDraft: (d: ProductDraft) => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function lookup(value: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/lookup/upc?code=${encodeURIComponent(value)}`);
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.error ?? "Lookup failed");
        return;
      }
      const draft = body.draft as ProductDraft;
      // P2: some sources (Open Food Facts) return a product with no usable
      // ingredient amounts — tell the user rather than silently opening a
      // blank ingredient list.
      if (draft.ingredients.length === 0) {
        toast.warning(
          "Found the product, but this barcode had no ingredient amounts. Try searching by NPN, a label photo, or fill it in manually.",
        );
      }
      onDraft(draft);
    } catch {
      toast.error("Lookup failed — check your connection.");
    } finally {
      setBusy(false);
    }
  }

  // B4: when the camera detects a code, drop it into the field so the user can
  // see and confirm the number, then look it up.
  function handleDetected(detected: string) {
    const digits = detected.replace(/\D/g, "");
    setCode(digits);
    toast.info(`Captured barcode ${digits} — looking it up…`);
    void lookup(digits);
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Scan the barcode or type its number. Looked up in the NIH supplement
        label database first, then Open Food Facts. The scanned number appears
        in the box below so you can check it.
      </p>
      <BarcodeScanner onDetected={handleDetected} onError={(m) => toast.error(m)} />
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (code.trim()) void lookup(code);
        }}
      >
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="upc-code">Barcode number</Label>
          <Input
            id="upc-code"
            inputMode="numeric"
            placeholder="e.g. 027917021522"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={busy || !code.trim()}>
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : "Look up"}
        </Button>
      </form>
    </div>
  );
}

function SearchTab({
  region,
  lnhpdSynced,
  onDraft,
}: {
  region: "CA" | "US";
  lnhpdSynced: boolean;
  onDraft: (d: ProductDraft) => void;
}) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncCount, setSyncCount] = useState(0);
  const [synced, setSynced] = useState(lnhpdSynced);

  async function search() {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/lookup/search?q=${encodeURIComponent(q)}&region=${region}`,
      );
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.error ?? "Search failed");
        return;
      }
      setHits(body.hits as SearchHit[]);
    } catch {
      toast.error("Search failed — check your connection.");
    } finally {
      setBusy(false);
    }
  }

  async function pick(hit: SearchHit) {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/lookup/product?source=${hit.source}&id=${encodeURIComponent(hit.sourceId)}`,
      );
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.error ?? "Lookup failed");
        return;
      }
      onDraft(body.draft as ProductDraft);
    } finally {
      setBusy(false);
    }
  }

  async function runSync() {
    setSyncing(true);
    setSyncCount(0);
    toast.info("Downloading the Health Canada index — this takes a few minutes…");
    try {
      const start = await fetch("/api/lnhpd/sync", { method: "POST" });
      if (!start.ok) {
        const body = await start.json().catch(() => ({}));
        toast.error(body.error ?? "Sync failed");
        setSyncing(false);
        return;
      }
      // Poll for progress until the background job finishes.
      const poll = async (): Promise<void> => {
        const res = await fetch("/api/lnhpd/sync");
        const body = await res.json();
        setSyncCount(body.progress?.count ?? 0);
        if (body.syncing) {
          setTimeout(() => void poll(), 2000);
          return;
        }
        setSyncing(false);
        if (body.progress?.error) {
          toast.error(`Sync failed: ${body.progress.error}`);
          return;
        }
        setSynced(true);
        toast.success(
          `Index ready — ${(body.recordCount ?? 0).toLocaleString()} products`,
        );
      };
      void poll();
    } catch {
      toast.error("Sync failed — check your connection.");
      setSyncing(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {region === "CA"
          ? "Search by NPN licence number (8 digits on Canadian bottles) or product name. Canadian results come first, then the US NIH database."
          : "Search the NIH supplement label database by product name."}
      </p>

      {region === "CA" && !synced && (
        <Alert>
          <AlertTitle>Canadian database not downloaded yet</AlertTitle>
          <AlertDescription className="flex flex-col gap-2">
            <span>
              Health Canada&apos;s API has no search, so VitaPlan keeps a local
              copy (~150 MB download, one time). Until then, searches use the
              US database only.
            </span>
            <Button
              size="sm"
              className="self-start"
              disabled={syncing}
              onClick={() => void runSync()}
            >
              {syncing ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  {syncCount > 0
                    ? `Downloading… ${syncCount.toLocaleString()} products`
                    : "Downloading…"}
                </>
              ) : (
                "Download now"
              )}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim().length >= 2) void search();
        }}
      >
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="search-q">NPN or product name</Label>
          <Input
            id="search-q"
            placeholder={region === "CA" ? "80012345 or vitamin d" : "vitamin d"}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={busy || q.trim().length < 2}>
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : "Search"}
        </Button>
      </form>

      {hits !== null && (
        <ul className="flex flex-col divide-y rounded-lg border">
          {hits.length === 0 && (
            <li className="p-4 text-sm text-muted-foreground">
              No matches. Try the label photo or manual entry.
            </li>
          )}
          {hits.map((hit) => (
            <li key={`${hit.source}-${hit.sourceId}`}>
              <button
                type="button"
                className="flex w-full flex-col items-start gap-0.5 p-3 text-left hover:bg-muted"
                onClick={() => void pick(hit)}
              >
                <span className="font-medium">{hit.name}</span>
                <span className="text-xs text-muted-foreground">
                  {[
                    hit.brand,
                    hit.npn ? `NPN ${hit.npn}` : null,
                    hit.source === "lnhpd" ? "Health Canada" : "NIH DSLD",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Preprocess a label photo for OCR: downscale very large images, convert to
 * grayscale, and apply a light contrast stretch so the Supplement Facts text
 * separates from the background. Runs entirely in the browser.
 */
async function preprocessForOcr(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const maxDim = 2000;
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  // grayscale + find min/max for a contrast stretch
  let min = 255;
  let max = 0;
  for (let i = 0; i < d.length; i += 4) {
    const g = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
    d[i] = d[i + 1] = d[i + 2] = g;
    if (g < min) min = g;
    if (g > max) max = g;
  }
  const range = Math.max(1, max - min);
  for (let i = 0; i < d.length; i += 4) {
    const v = ((d[i] - min) / range) * 255;
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);

  return new Promise<Blob>((resolve) =>
    canvas.toBlob((b) => resolve(b ?? file), "image/png"),
  );
}

function PhotoTab({ onDraft }: { onDraft: (d: ProductDraft) => void }) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  async function handleFile(file: File) {
    setBusy(true);
    setProgress(0);
    try {
      const prepared = await preprocessForOcr(file).catch(() => file);
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng", 1, {
        logger: (m) => {
          if (m.status === "recognizing text") setProgress(Math.round(m.progress * 100));
        },
      });
      const {
        data: { text },
      } = await worker.recognize(prepared);
      await worker.terminate();

      const ingredients = parseLabelText(text);
      if (ingredients.length === 0) {
        toast.warning(
          "Couldn't read any ingredient lines — opening a blank form. Try a sharper, well-lit photo of the Supplement Facts panel.",
        );
      } else {
        toast.success(`Found ${ingredients.length} ingredient line(s) — review and correct them.`);
      }
      onDraft({ name: "", source: "ocr", ingredients });
    } catch {
      toast.error("Text recognition failed. Try manual entry.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Take a clear photo of the Supplement Facts panel. Text is read locally
        in your browser — the photo never leaves your device — and prefills the
        form for you to correct.
      </p>
      <div className="flex flex-col gap-2">
        <Label htmlFor="ocr-file">Label photo</Label>
        <Input
          id="ocr-file"
          type="file"
          accept="image/*"
          capture="environment"
          className="max-w-xs"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
      </div>
      {busy && (
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Reading label… {progress}%
        </p>
      )}
    </div>
  );
}
