"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { saveProfile, type ProfileInput } from "@/lib/actions/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const ACTIVITY_FACTORS = {
  sedentary: 1.2,
  low_active: 1.375,
  active: 1.55,
  very_active: 1.725,
} as const;

export interface ProfileFormValues {
  dateOfBirth: string;
  sex: "male" | "female" | "";
  heightCm: number | null;
  weightKg: number | null;
  activityLevel: keyof typeof ACTIVITY_FACTORS;
  pregnant: boolean;
  lactating: boolean;
  region: "CA" | "US";
  unitPreference: "metric" | "imperial";
}

function cmToFtIn(cm: number) {
  const totalIn = cm / 2.54;
  const ft = Math.floor(totalIn / 12);
  const inches = Math.round(totalIn - ft * 12);
  return inches === 12 ? { ft: ft + 1, inches: 0 } : { ft, inches };
}

export function ProfileForm({ initial }: { initial: ProfileFormValues }) {
  const [values, setValues] = useState(initial);
  const [busy, setBusy] = useState(false);

  // Imperial input fields are derived from the metric source of truth.
  const ftIn = values.heightCm ? cmToFtIn(values.heightCm) : { ft: null, inches: null };
  const lbs = values.weightKg ? Math.round(values.weightKg * 2.20462 * 10) / 10 : null;

  const age = useMemo(() => {
    if (!values.dateOfBirth) return null;
    const dob = new Date(values.dateOfBirth);
    if (Number.isNaN(dob.getTime())) return null;
    const now = new Date();
    let years = now.getFullYear() - dob.getFullYear();
    const beforeBirthday =
      now.getMonth() < dob.getMonth() ||
      (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate());
    if (beforeBirthday) years -= 1;
    return years;
  }, [values.dateOfBirth]);

  const bmi =
    values.heightCm && values.weightKg
      ? values.weightKg / (values.heightCm / 100) ** 2
      : null;

  // Mifflin-St Jeor basal metabolic rate × activity factor
  const calories =
    values.heightCm && values.weightKg && age !== null && values.sex
      ? Math.round(
          (10 * values.weightKg +
            6.25 * values.heightCm -
            5 * age +
            (values.sex === "male" ? 5 : -161)) *
            ACTIVITY_FACTORS[values.activityLevel],
        )
      : null;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!values.sex || !values.heightCm || !values.weightKg || !values.dateOfBirth) {
      toast.error("Please fill in every field.");
      return;
    }
    setBusy(true);
    const result = await saveProfile(values as ProfileInput);
    setBusy(false);
    if (result?.error) toast.error(result.error);
    else toast.success("Profile saved");
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-xl flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="dob">Date of birth</Label>
          <Input
            id="dob"
            type="date"
            required
            value={values.dateOfBirth}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setValues({ ...values, dateOfBirth: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="sex">Sex</Label>
          <Select
            value={values.sex || undefined}
            onValueChange={(sex: "male" | "female") => setValues({ ...values, sex })}
          >
            <SelectTrigger id="sex" className="w-full">
              <SelectValue placeholder="Select…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="female">Female</SelectItem>
              <SelectItem value="male">Male</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Used to pick the right reference values (same inputs as the USDA
            DRI calculator).
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <Label>Height &amp; weight</Label>
          <Tabs
            value={values.unitPreference}
            onValueChange={(v) =>
              setValues({ ...values, unitPreference: v as "metric" | "imperial" })
            }
          >
            <TabsList>
              <TabsTrigger value="imperial">ft/lbs</TabsTrigger>
              <TabsTrigger value="metric">cm/kg</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {values.unitPreference === "imperial" ? (
          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="height-ft">Height (ft)</Label>
              <Input
                id="height-ft"
                type="number"
                min={1}
                max={8}
                required
                value={ftIn.ft ?? ""}
                onChange={(e) => {
                  const ft = Number(e.target.value);
                  const inches = ftIn.inches ?? 0;
                  setValues({
                    ...values,
                    heightCm: ft ? Math.round((ft * 12 + inches) * 2.54 * 10) / 10 : null,
                  });
                }}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="height-in">Height (in)</Label>
              <Input
                id="height-in"
                type="number"
                min={0}
                max={11}
                required
                value={ftIn.inches ?? ""}
                onChange={(e) => {
                  const inches = Number(e.target.value);
                  const ft = ftIn.ft ?? 0;
                  setValues({
                    ...values,
                    heightCm: Math.round((ft * 12 + inches) * 2.54 * 10) / 10 || null,
                  });
                }}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="weight-lbs">Weight (lbs)</Label>
              <Input
                id="weight-lbs"
                type="number"
                min={40}
                max={1100}
                step="0.1"
                required
                value={lbs ?? ""}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setValues({
                    ...values,
                    weightKg: v ? Math.round((v / 2.20462) * 10) / 10 : null,
                  });
                }}
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="height-cm">Height (cm)</Label>
              <Input
                id="height-cm"
                type="number"
                min={50}
                max={275}
                step="0.1"
                required
                value={values.heightCm ?? ""}
                onChange={(e) =>
                  setValues({ ...values, heightCm: Number(e.target.value) || null })
                }
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="weight-kg">Weight (kg)</Label>
              <Input
                id="weight-kg"
                type="number"
                min={20}
                max={500}
                step="0.1"
                required
                value={values.weightKg ?? ""}
                onChange={(e) =>
                  setValues({ ...values, weightKg: Number(e.target.value) || null })
                }
              />
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="activity">Activity level</Label>
          <Select
            value={values.activityLevel}
            onValueChange={(activityLevel: keyof typeof ACTIVITY_FACTORS) =>
              setValues({ ...values, activityLevel })
            }
          >
            <SelectTrigger id="activity" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sedentary">Sedentary</SelectItem>
              <SelectItem value="low_active">Lightly active</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="very_active">Very active</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="region">Region</Label>
          <Select
            value={values.region}
            onValueChange={(region: "CA" | "US") => setValues({ ...values, region })}
          >
            <SelectTrigger id="region" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="CA">Canada</SelectItem>
              <SelectItem value="US">United States</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Canada searches Health Canada&apos;s licensed product database first.
          </p>
        </div>
      </div>

      {values.sex === "female" && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Checkbox
              id="pregnant"
              checked={values.pregnant}
              onCheckedChange={(c) => setValues({ ...values, pregnant: c === true })}
            />
            <Label htmlFor="pregnant">Pregnant</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="lactating"
              checked={values.lactating}
              onCheckedChange={(c) => setValues({ ...values, lactating: c === true })}
            />
            <Label htmlFor="lactating">Breastfeeding</Label>
          </div>
        </div>
      )}

      {(bmi !== null || calories !== null) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your numbers</CardTitle>
            <CardDescription>
              Standard estimates from your profile — shown for reference only.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-8 text-sm">
            {bmi !== null && (
              <div>
                <p className="text-2xl font-semibold">{bmi.toFixed(1)}</p>
                <p className="text-muted-foreground">BMI</p>
              </div>
            )}
            {calories !== null && (
              <div>
                <p className="text-2xl font-semibold">{calories.toLocaleString()}</p>
                <p className="text-muted-foreground">
                  est. daily calories (Mifflin-St Jeor)
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Button type="submit" disabled={busy} className="self-start">
        {busy ? "Saving…" : "Save profile"}
      </Button>
    </form>
  );
}
