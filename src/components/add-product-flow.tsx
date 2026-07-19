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
      onDraft(body.draft as ProductDraft);
    } catch {
      toast.error("Lookup failed — check your connection.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Scan the barcode or type its number. Looked up in the NIH supplement
        label database first, then Open Food Facts.
      </p>
      <BarcodeScanner onDetected={(c) => void lookup(c)} onError={(m) => toast.error(m)} />
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
    toast.info("Downloading the Health Canada index — this takes a few minutes…");
    try {
      const res = await fetch("/api/lnhpd/sync", { method: "POST" });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.error ?? "Sync failed");
        return;
      }
      setSynced(true);
      toast.success(`Index ready — ${body.recordCount.toLocaleString()} products`);
    } catch {
      toast.error("Sync failed — check your connection.");
    } finally {
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
                  Downloading…
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

function PhotoTab({ onDraft }: { onDraft: (d: ProductDraft) => void }) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  async function handleFile(file: File) {
    setBusy(true);
    setProgress(0);
    try {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng", 1, {
        logger: (m) => {
          if (m.status === "recognizing text") setProgress(Math.round(m.progress * 100));
        },
      });
      const {
        data: { text },
      } = await worker.recognize(file);
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
