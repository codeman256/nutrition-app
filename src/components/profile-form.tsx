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

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

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

function round1(n: number): string {
  return String(Math.round(n * 10) / 10);
}

export function ProfileForm({ initial }: { initial: ProfileFormValues }) {
  const [sex, setSex] = useState(initial.sex);
  const [activityLevel, setActivityLevel] = useState(initial.activityLevel);
  const [region, setRegion] = useState(initial.region);
  const [unit, setUnit] = useState(initial.unitPreference);
  const [pregnant, setPregnant] = useState(initial.pregnant);
  const [lactating, setLactating] = useState(initial.lactating);
  const [busy, setBusy] = useState(false);

  // Date of birth as explicit parts — no native date-picker confusion.
  const dob0 = initial.dateOfBirth ? initial.dateOfBirth.split("-") : [];
  const [dobYear, setDobYear] = useState(dob0[0] ?? "");
  const [dobMonth, setDobMonth] = useState(dob0[1] ? String(Number(dob0[1])) : "");
  const [dobDay, setDobDay] = useState(dob0[2] ? String(Number(dob0[2])) : "");

  // Each physical field owns its own raw string; conversion never rewrites
  // what the user is typing. Canonical metric values are derived on demand.
  const [heightCmStr, setHeightCmStr] = useState(
    initial.heightCm ? round1(initial.heightCm) : "",
  );
  const [weightKgStr, setWeightKgStr] = useState(
    initial.weightKg ? round1(initial.weightKg) : "",
  );
  const initFtIn = initial.heightCm
    ? (() => {
        const totalIn = initial.heightCm / 2.54;
        const ft = Math.floor(totalIn / 12);
        return { ft: String(ft), inches: String(Math.round(totalIn - ft * 12)) };
      })()
    : { ft: "", inches: "" };
  const [heightFtStr, setHeightFtStr] = useState(initFtIn.ft);
  const [heightInStr, setHeightInStr] = useState(initFtIn.inches);
  const [weightLbsStr, setWeightLbsStr] = useState(
    initial.weightKg ? round1(initial.weightKg * 2.20462) : "",
  );

  // Canonical metric values from whichever unit system is active.
  const heightCm = useMemo(() => {
    if (unit === "metric") return Number(heightCmStr) || null;
    const ft = Number(heightFtStr) || 0;
    const inches = Number(heightInStr) || 0;
    const cm = (ft * 12 + inches) * 2.54;
    return cm > 0 ? Math.round(cm * 10) / 10 : null;
  }, [unit, heightCmStr, heightFtStr, heightInStr]);

  const weightKg = useMemo(() => {
    if (unit === "metric") return Number(weightKgStr) || null;
    const lbs = Number(weightLbsStr) || 0;
    return lbs > 0 ? Math.round((lbs / 2.20462) * 10) / 10 : null;
  }, [unit, weightKgStr, weightLbsStr]);

  const dateOfBirth =
    dobYear && dobMonth && dobDay
      ? `${dobYear}-${dobMonth.padStart(2, "0")}-${dobDay.padStart(2, "0")}`
      : "";

  const age = useMemo(() => {
    if (!dateOfBirth) return null;
    const dob = new Date(dateOfBirth);
    if (Number.isNaN(dob.getTime())) return null;
    const now = new Date();
    let years = now.getFullYear() - dob.getFullYear();
    const beforeBirthday =
      now.getMonth() < dob.getMonth() ||
      (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate());
    if (beforeBirthday) years -= 1;
    return years;
  }, [dateOfBirth]);

  const bmi =
    heightCm && weightKg ? weightKg / (heightCm / 100) ** 2 : null;

  const calories =
    heightCm && weightKg && age !== null && sex
      ? Math.round(
          (10 * weightKg +
            6.25 * heightCm -
            5 * age +
            (sex === "male" ? 5 : -161)) *
            ACTIVITY_FACTORS[activityLevel],
        )
      : null;

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 120 }, (_, i) => currentYear - i);
  const daysInMonth =
    dobYear && dobMonth
      ? new Date(Number(dobYear), Number(dobMonth), 0).getDate()
      : 31;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!sex || !heightCm || !weightKg || !dateOfBirth) {
      toast.error("Please fill in every field.");
      return;
    }
    setBusy(true);
    const input: ProfileInput = {
      dateOfBirth,
      sex,
      heightCm,
      weightKg,
      activityLevel,
      pregnant,
      lactating,
      region,
      unitPreference: unit,
    };
    const result = await saveProfile(input);
    setBusy(false);
    if (result?.error) toast.error(result.error);
    else toast.success("Profile saved");
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-xl flex-col gap-6">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Date of birth</legend>
        <div className="grid grid-cols-3 gap-2">
          <Select value={dobMonth} onValueChange={setDobMonth}>
            <SelectTrigger aria-label="Birth month" className="w-full">
              <SelectValue placeholder="Month" />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => (
                <SelectItem key={m} value={String(i + 1)}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={dobDay} onValueChange={setDobDay}>
            <SelectTrigger aria-label="Birth day" className="w-full">
              <SelectValue placeholder="Day" />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => (
                <SelectItem key={d} value={String(d)}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={dobYear} onValueChange={setDobYear}>
            <SelectTrigger aria-label="Birth year" className="w-full">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {age !== null && (
          <p className="text-xs text-muted-foreground">Age: {age}</p>
        )}
      </fieldset>

      <div className="flex flex-col gap-2">
        <Label htmlFor="sex">Sex</Label>
        <Select
          value={sex || undefined}
          onValueChange={(v: "male" | "female") => setSex(v)}
        >
          <SelectTrigger id="sex" className="w-full sm:w-56">
            <SelectValue placeholder="Select…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="female">Female</SelectItem>
            <SelectItem value="male">Male</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Used to pick the right reference values (same inputs as the USDA DRI
          calculator).
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <Label>Height &amp; weight</Label>
          <Tabs value={unit} onValueChange={(v) => setUnit(v as "metric" | "imperial")}>
            <TabsList>
              <TabsTrigger value="imperial">ft/lbs</TabsTrigger>
              <TabsTrigger value="metric">cm/kg</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {unit === "imperial" ? (
          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="height-ft">Height (ft)</Label>
              <Input
                id="height-ft"
                type="number"
                inputMode="numeric"
                min={1}
                max={8}
                value={heightFtStr}
                onChange={(e) => setHeightFtStr(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="height-in">Height (in)</Label>
              <Input
                id="height-in"
                type="number"
                inputMode="numeric"
                min={0}
                max={11}
                value={heightInStr}
                onChange={(e) => setHeightInStr(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="weight-lbs">Weight (lbs)</Label>
              <Input
                id="weight-lbs"
                type="number"
                inputMode="decimal"
                min={40}
                max={1100}
                step="0.1"
                value={weightLbsStr}
                onChange={(e) => setWeightLbsStr(e.target.value)}
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
                inputMode="decimal"
                min={50}
                max={275}
                step="0.1"
                value={heightCmStr}
                onChange={(e) => setHeightCmStr(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="weight-kg">Weight (kg)</Label>
              <Input
                id="weight-kg"
                type="number"
                inputMode="decimal"
                min={20}
                max={500}
                step="0.1"
                value={weightKgStr}
                onChange={(e) => setWeightKgStr(e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="activity">Activity level</Label>
          <Select
            value={activityLevel}
            onValueChange={(v: keyof typeof ACTIVITY_FACTORS) => setActivityLevel(v)}
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
          <Select value={region} onValueChange={(v: "CA" | "US") => setRegion(v)}>
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

      {sex === "female" && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Checkbox
              id="pregnant"
              checked={pregnant}
              onCheckedChange={(c) => setPregnant(c === true)}
            />
            <Label htmlFor="pregnant">Pregnant</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="lactating"
              checked={lactating}
              onCheckedChange={(c) => setLactating(c === true)}
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
