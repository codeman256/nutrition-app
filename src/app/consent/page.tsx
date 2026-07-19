import type { Metadata } from "next";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Consent" };

// Placeholder — the full consent flow is built in the schema/consent step.
export default async function ConsentPage() {
  await requireUser();
  return (
    <div className="mx-auto max-w-lg p-6">
      <h1 className="text-2xl font-semibold">Before you start</h1>
      <p className="mt-2 text-muted-foreground">
        The consent screen is coming in the next build step.
      </p>
    </div>
  );
}
