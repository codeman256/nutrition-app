"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Download, Loader2, RefreshCw, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const SCHEDULE_OPTIONS = [
  { value: "0", label: "Never (manual only)" },
  { value: "7", label: "Weekly" },
  { value: "30", label: "Monthly" },
  { value: "90", label: "Every 3 months" },
];

function formatDate(ts: number | null): string {
  if (!ts) return "never";
  return new Date(ts).toLocaleString();
}

export function AdminControls({
  lnhpd,
}: {
  lnhpd: {
    syncedAt: number | null;
    recordCount: number | null;
    autoSyncDays: number;
  };
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [restoring, setRestoring] = useState(false);
  const [autoSyncDays, setAutoSyncDays] = useState(String(lnhpd.autoSyncDays));
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncCount, setSyncCount] = useState(0);

  async function handleRestore(file: File) {
    if (
      !confirm(
        "Restore will REPLACE the current database with this backup. " +
          "All current data will be overwritten. Continue?",
      )
    ) {
      return;
    }
    setRestoring(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/admin/restore", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Restore failed");
        return;
      }
      toast.success("Database restored. Reloading…");
      // Give the connection a moment to settle, then reload everything.
      setTimeout(() => {
        router.refresh();
        window.location.reload();
      }, 800);
    } catch {
      toast.error("Restore failed — check the file and try again.");
    } finally {
      setRestoring(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function saveSchedule(days: string) {
    setAutoSyncDays(days);
    setSavingSchedule(true);
    try {
      const res = await fetch("/api/lnhpd/sync", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoSyncDays: Number(days) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Could not save schedule");
        return;
      }
      toast.success("Sync schedule saved");
    } finally {
      setSavingSchedule(false);
    }
  }

  async function runSync() {
    setSyncing(true);
    setSyncCount(0);
    try {
      const start = await fetch("/api/lnhpd/sync", { method: "POST" });
      if (!start.ok) {
        const data = await start.json().catch(() => ({}));
        toast.error(data.error ?? "Sync failed to start");
        setSyncing(false);
        return;
      }
      const poll = async (): Promise<void> => {
        const res = await fetch("/api/lnhpd/sync");
        const data = await res.json();
        setSyncCount(data.progress?.count ?? 0);
        if (data.syncing) {
          setTimeout(() => void poll(), 2000);
          return;
        }
        setSyncing(false);
        if (data.progress?.error) {
          toast.error(`Sync failed: ${data.progress.error}`);
          return;
        }
        toast.success(
          `Index refreshed — ${(data.recordCount ?? 0).toLocaleString()} products`,
        );
        router.refresh();
      };
      void poll();
    } catch {
      toast.error("Sync failed — check your connection.");
      setSyncing(false);
    }
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Database backup</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Download a complete copy of your VitaPlan database — every account,
            profile, product, and regimen. Keep it somewhere safe; you can
            restore it here or move it to another VitaPlan server.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline" className="gap-2">
              <a href="/api/admin/backup" download>
                <Download className="size-4" aria-hidden="true" />
                Download backup
              </a>
            </Button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".db,.sqlite,.sqlite3,application/x-sqlite3,application/octet-stream"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleRestore(file);
              }}
            />
            <Button
              variant="outline"
              className="gap-2"
              disabled={restoring}
              onClick={() => fileInputRef.current?.click()}
            >
              {restoring ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Upload className="size-4" aria-hidden="true" />
              )}
              Restore from backup…
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Restoring overwrites all current data with the contents of the
            uploaded file.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Health Canada (LNHPD) index</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Canadian product search uses a local copy of Health Canada&apos;s
            licensed natural health product database.
          </p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Last updated</dt>
            <dd>{formatDate(lnhpd.syncedAt)}</dd>
            <dt className="text-muted-foreground">Products indexed</dt>
            <dd>{(lnhpd.recordCount ?? 0).toLocaleString()}</dd>
          </dl>

          <div className="flex flex-col gap-2">
            <Label htmlFor="auto-sync">Auto-refresh schedule</Label>
            <div className="flex items-center gap-2">
              <Select
                value={autoSyncDays}
                onValueChange={saveSchedule}
                disabled={savingSchedule}
              >
                <SelectTrigger id="auto-sync" className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCHEDULE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {savingSchedule && (
                <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden="true" />
              )}
            </div>
          </div>

          <Button
            variant="outline"
            className="gap-2 self-start"
            disabled={syncing}
            onClick={() => void runSync()}
          >
            {syncing ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                {syncCount > 0
                  ? `Refreshing… ${syncCount.toLocaleString()} products`
                  : "Refreshing…"}
              </>
            ) : (
              <>
                <RefreshCw className="size-4" aria-hidden="true" />
                Refresh now
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
