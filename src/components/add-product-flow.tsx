"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import type { ProductDraft, SearchHit } from "@/lib/lookup/types";
import { recognizeLabel } from "@/lib/ocr-run";
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
  const [tab, setTab] = useState("search");
  const [searchSeed, setSearchSeed] = useState("");

  /**
   * A barcode that resolves to a product with no ingredient amounts is a dead
   * end, so hand whatever name it did give us to the search tab rather than
   * dropping the user into an empty form.
   */
  function handoffToSearch(query: string) {
    setSearchSeed(query);
    setTab("search");
  }

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
    <Tabs value={tab} onValueChange={setTab} className="max-w-2xl">
      <TabsList className="grid w-full grid-cols-4">
        {/* Search leads: an NPN is legally required on every Canadian bottle,
            whereas barcode data is crowd-sourced and often empty. */}
        <TabsTrigger value="search">
          {region === "CA" ? "NPN / name" : "Search"}
        </TabsTrigger>
        <TabsTrigger value="upc">Barcode</TabsTrigger>
        <TabsTrigger value="photo">Label photo</TabsTrigger>
        <TabsTrigger value="manual">Manual</TabsTrigger>
      </TabsList>
      <TabsContent value="search" className="pt-4">
        <SearchTab
          region={region}
          lnhpdSynced={lnhpdSynced}
          onDraft={setDraft}
          seed={searchSeed}
        />
      </TabsContent>
      <TabsContent value="upc" className="pt-4">
        <UpcTab onDraft={setDraft} onSearchInstead={handoffToSearch} />
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

function UpcTab({
  onDraft,
  onSearchInstead,
}: {
  onDraft: (d: ProductDraft) => void;
  onSearchInstead: (query: string) => void;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [thin, setThin] = useState<ProductDraft | null>(null);

  async function lookup(value: string) {
    setBusy(true);
    setThin(null);
    try {
      const res = await fetch(`/api/lookup/upc?code=${encodeURIComponent(value)}`);
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.error ?? "Lookup failed");
        return;
      }
      const draft = body.draft as ProductDraft;
      // P2: barcode databases are crowd-sourced and for supplements the entry
      // is often just a name with no amounts. Offer the search route instead of
      // dropping the user into an empty ingredient list.
      if (draft.ingredients.length === 0) {
        setThin(draft);
        return;
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
        in the box below so you can check it. Barcode entries are crowd-sourced
        — for supplements they often list a name but no amounts, in which case
        searching by NPN or name works better.
      </p>

      {thin && (
        <Alert>
          <AlertTitle>
            Found {thin.name ? `“${thin.name}”` : "the product"}, but no
            ingredient amounts
          </AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-2">
            <span>
              This barcode has no nutrient data behind it, so there is nothing
              to import. Searching Health Canada by name or NPN usually finds
              the full ingredient list.
            </span>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => onSearchInstead(thin.name ?? "")}
              >
                Search for it instead
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onDraft(thin)}
              >
                Enter amounts myself
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

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
  seed,
}: {
  region: "CA" | "US";
  lnhpdSynced: boolean;
  onDraft: (d: ProductDraft) => void;
  /** query handed over from a barcode that had no usable data */
  seed?: string;
}) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncCount, setSyncCount] = useState(0);
  const [synced, setSynced] = useState(lnhpdSynced);

  // Prefill and run whatever name the barcode lookup managed to find.
  useEffect(() => {
    if (!seed) return;
    setQ(seed);
    void runSearch(seed);
    // runSearch is stable enough for this one-shot handoff
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed]);

  async function runSearch(term: string) {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/lookup/search?q=${encodeURIComponent(term)}&region=${region}`,
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
          ? "Search by NPN licence number or product name. Canadian results come first, then the US NIH database. Searching by NPN is the most reliable — it identifies exactly one licence."
          : "Search the NIH supplement label database by product name."}
      </p>

      {region === "CA" && (
        <details className="rounded-lg border p-3 text-sm">
          <summary className="cursor-pointer font-medium">
            Where do I find the NPN on my bottle?
          </summary>
          <div className="mt-2 flex flex-col gap-2 text-muted-foreground">
            <p>
              Canadian law requires every natural health product to show its
              licence number on the <strong>front of the label</strong> (the
              &ldquo;principal display panel&rdquo;), written as{" "}
              <strong>NPN</strong> followed by 8 digits — for example{" "}
              <code className="rounded bg-muted px-1 py-0.5">NPN 80012345</code>.
              Homeopathic products use <strong>DIN-HM</strong> instead.
            </p>
            <p>
              There is no rule about how <em>prominent</em> it has to be, so it
              is often tiny and printed sideways near a bottom corner of the
              front label. On Jamieson bottles it sits in the lower right of the
              red band. Tilt the bottle under good light — it is always there.
            </p>
            <p>
              You can type just the digits; the leading zeros matter, so enter
              all 8.
            </p>
          </div>
        </details>
      )}

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
          if (q.trim().length >= 2) void runSearch(q);
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
                    hit.source === "lnhpd"
                      ? "Health Canada"
                      : `NIH DSLD #${hit.sourceId}`,
                    hit.discontinued
                      ? hit.source === "lnhpd"
                        ? "no longer active"
                        : "no longer on the market"
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                {/* DSLD carries several near-identical rows per product; this
                    line — count/form, category, UPC when present — is what tells
                    them apart. */}
                {(hit.netContents || hit.form || hit.productType || hit.upc) && (
                  <span className="text-xs text-muted-foreground">
                    {[
                      hit.upc ? `UPC ${hit.upc}` : null,
                      hit.netContents ?? hit.form,
                      hit.productType,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                )}
                {hit.names && hit.names.length > 1 && (
                  <span className="text-xs text-muted-foreground">
                    Also sold as {hit.names[1]}
                    {hit.names.length > 2
                      ? ` and ${hit.names.length - 2} other name${hit.names.length > 3 ? "s" : ""}`
                      : ""}
                  </span>
                )}
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
      const ingredients = await recognizeLabel(file, setProgress);
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
