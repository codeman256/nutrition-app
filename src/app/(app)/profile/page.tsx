import type { Metadata } from "next";
import { requireConsentedUser } from "@/lib/session";
import { ProfileForm, type ProfileFormValues } from "@/components/profile-form";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const { profile } = await requireConsentedUser();

  const initial: ProfileFormValues = {
    dateOfBirth: profile.dateOfBirth ?? "",
    sex: profile.sex ?? "",
    heightCm: profile.heightCm,
    weightKg: profile.weightKg,
    activityLevel: profile.activityLevel ?? "sedentary",
    pregnant: profile.pregnant,
    lactating: profile.lactating,
    region: profile.region,
    unitPreference: profile.unitPreference,
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold">Profile</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        These details pick the recommended amounts and safe upper limits used
        across the app.
      </p>
      <ProfileForm initial={initial} />
    </div>
  );
}
