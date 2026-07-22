"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/schema";
import { requireUser } from "@/lib/session";

/**
 * Change the signed-in user's email directly. better-auth's own change-email
 * flow requires a verification email sender, which a self-hosted instance with
 * no mail configured doesn't have — so we update it here after checking the
 * address is free. Sessions are keyed by user id, so they stay valid.
 */
export async function updateEmail(newEmail: string) {
  const authUser = await requireUser();
  const email = newEmail.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { error: "Enter a valid email address." };
  }
  if (email === authUser.email.toLowerCase()) {
    return { ok: true };
  }

  const taken = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email))
    .limit(1);
  if (taken[0] && taken[0].id !== authUser.id) {
    return { error: "That email is already in use." };
  }

  await db
    .update(user)
    .set({ email, updatedAt: new Date() })
    .where(eq(user.id, authUser.id));
  return { ok: true };
}
