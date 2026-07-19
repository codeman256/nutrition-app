import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { profiles } from "@/db/schema";

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
  const user = await requireUser();
  const profile = await getProfile(user.id);
  if (!profile?.consentAcceptedAt) redirect("/consent");
  return { user, profile };
}
