/**
 * Runs once when the Next.js server process starts. We use it to periodically
 * check whether the Health Canada (LNHPD) index is due for an auto-refresh,
 * based on the admin's configured schedule.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Flag the first account as admin on instances created before the role column.
  const { backfillAdminRole } = await import("@/lib/session");
  await backfillAdminRole().catch(() => {
    // best-effort; the earliest-user fallback still resolves admin meanwhile
  });

  const { maybeAutoSyncLnhpd } = await import("@/lib/lookup/lnhpd");
  const check = () => {
    void maybeAutoSyncLnhpd().catch(() => {
      // best-effort; a failed check is retried on the next tick
    });
  };

  // Shortly after boot, then a few times a day.
  setTimeout(check, 30_000).unref?.();
  setInterval(check, 6 * 60 * 60_000).unref?.();
}
