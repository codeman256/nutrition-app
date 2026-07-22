import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { profiles, user } from "@/db/schema";

export const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

/** Redirects to sign-in when unauthenticated. */
export async function requireUser() {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  return session.user;
}

export const getProfile = cache(async (userId: string) => {
  const rows = await db
    .select()
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);
  return rows[0] ?? null;
});

/**
 * For app pages: requires a signed-in user who has accepted the consent
 * notice; otherwise sends them to the consent screen first.
 */
export async function requireConsentedUser() {
  const authUser = await requireUser();
  const profile = await getProfile(authUser.id);
  if (!profile?.consentAcceptedAt) redirect("/consent");
  return { user: authUser, profile };
}

/**
 * The instance admin is the first account created on this server (single-tenant
 * self-hosted app). New signups get `role = "admin"` stamped on the first
 * account; for installs that predate that column, we fall back to the
 * earliest-created user. {@link backfillAdminRole} persists that fallback.
 */
export const getAdminUserId = cache(async (): Promise<string | null> => {
  const flagged = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.role, "admin"))
    .orderBy(asc(user.createdAt), asc(user.id))
    .limit(1);
  if (flagged[0]) return flagged[0].id;

  const earliest = await db
    .select({ id: user.id })
    .from(user)
    .orderBy(asc(user.createdAt), asc(user.id))
    .limit(1);
  return earliest[0]?.id ?? null;
});

/**
 * One-time backfill for instances created before the `role` column: if nobody
 * is flagged admin yet but users exist, stamp the earliest account. Safe to
 * call repeatedly; does nothing once an admin is set.
 */
export async function backfillAdminRole(): Promise<void> {
  const flagged = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.role, "admin"))
    .limit(1);
  if (flagged[0]) return;

  const earliest = await db
    .select({ id: user.id })
    .from(user)
    .orderBy(asc(user.createdAt), asc(user.id))
    .limit(1);
  if (earliest[0]) {
    await db.update(user).set({ role: "admin" }).where(eq(user.id, earliest[0].id));
  }
}

export const isAdmin = cache(async (userId: string): Promise<boolean> => {
  return (await getAdminUserId()) === userId;
});

/** Redirects non-admins away; returns the admin user when allowed. */
export async function requireAdmin() {
  const authUser = await requireUser();
  if (!(await isAdmin(authUser.id))) redirect("/dashboard");
  return authUser;
}
