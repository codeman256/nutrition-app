import type { Metadata } from "next";
import { requireConsentedUser } from "@/lib/session";
import { ProfileForm, type ProfileFormValues } from "@/components/profile-form";
import { AccountSettings } from "@/components/account-settings";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const { user, profile } = await requireConsentedUser();

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

      <div className="mt-8 border-t pt-6">
        <h2 className="mb-1 text-lg font-semibold">Account</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Update the name, sign-in email, and password for your account.
        </p>
        <AccountSettings initialName={user.name} initialEmail={user.email} />
      </div>

      <div className="mt-8 border-t pt-6">
        <h2 className="mb-1 text-lg font-semibold">Appearance</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          VitaPlan follows your device&apos;s light/dark mode by default. Override
          it here for this browser.
        </p>
        <ThemeToggle />
      </div>
    </div>
  );
}
