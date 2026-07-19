import type { Metadata } from "next";

export const metadata: Metadata = { title: "Regimen" };

export default function RegimenPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">My Regimen</h1>
      <p className="mt-2 text-muted-foreground">
        Your weekly supplement schedule will appear here.
      </p>
    </div>
  );
}
