import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { requireUser, getProfile } from "@/lib/session";
import { acceptConsent } from "@/lib/actions/profile";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = { title: "Before you start" };

export default async function ConsentPage() {
  const user = await requireUser();
  const profile = await getProfile(user.id);
  if (profile?.consentAcceptedAt) redirect("/dashboard");

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 p-4">
      <div className="flex items-center gap-2">
        <Image src="/icon-192.png" alt="" width={40} height={40} className="rounded-xl" />
        <span className="text-2xl font-semibold">VitaPlan</span>
      </div>
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Before you start</CardTitle>
          <CardDescription>
            A couple of things you should know about how VitaPlan works.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-sm leading-relaxed">
          <p>
            <strong>Your data stays on your server.</strong> VitaPlan stores
            your profile (age, sex, height, weight) and supplement list in a
            database on the machine that hosts this app — nothing is sent to a
            third party. Product lookups query public databases (NIH DSLD,
            Health Canada LNHPD, Open Food Facts) using only the barcode,
            licence number, or name you enter.
          </p>
          <p>
            <strong>Reference values, not prescriptions.</strong> Recommended
            amounts and upper limits come from published NIH (US) and Health
            Canada reference tables. They are population-level guidelines and
            do not account for your medical history, medications, or lab
            results.
          </p>
          <p>
            <strong>Not medical advice.</strong> VitaPlan is an informational
            planning tool. Always talk to a doctor, pharmacist, or dietitian
            before starting, stopping, or changing supplements — especially if
            you are pregnant, nursing, taking medication, or managing a health
            condition.
          </p>
          <form action={acceptConsent}>
            <Button type="submit" className="w-full">
              I understand — continue
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
