"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { requireUser } from "@/lib/session";

export async function acceptConsent() {
  const user = await requireUser();
  await db
    .insert(profiles)
    .values({ userId: user.id, consentAcceptedAt: new Date() })
    .onConflictDoUpdate({
      target: profiles.userId,
      set: { consentAcceptedAt: new Date() },
    });
  redirect("/profile");
}

export interface ProfileInput {
  dateOfBirth: string;
  sex: "male" | "female";
  heightCm: number;
  weightKg: number;
  activityLevel: "sedentary" | "low_active" | "active" | "very_active";
  pregnant: boolean;
  lactating: boolean;
  region: "CA" | "US";
  unitPreference: "metric" | "imperial";
}

export async function saveProfile(input: ProfileInput) {
  const user = await requireUser();

  const dob = new Date(input.dateOfBirth);
  if (Number.isNaN(dob.getTime()) || dob > new Date()) {
    return { error: "Enter a valid date of birth." };
  }
  if (!(input.heightCm > 50 && input.heightCm < 275)) {
    return { error: "Enter a valid height." };
  }
  if (!(input.weightKg > 20 && input.weightKg < 500)) {
    return { error: "Enter a valid weight." };
  }

  await db
    .update(profiles)
    .set({
      dateOfBirth: input.dateOfBirth,
      sex: input.sex,
      heightCm: input.heightCm,
      weightKg: input.weightKg,
      activityLevel: input.activityLevel,
      pregnant: input.sex === "female" && input.pregnant,
      lactating: input.sex === "female" && input.lactating,
      region: input.region,
      unitPreference: input.unitPreference,
      updatedAt: new Date(),
    })
    .where(eq(profiles.userId, user.id));

  revalidatePath("/profile");
  revalidatePath("/dashboard");
  return { ok: true };
}
