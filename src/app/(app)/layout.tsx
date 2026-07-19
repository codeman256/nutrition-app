import { AppShell } from "@/components/app-shell";
import { requireConsentedUser } from "@/lib/session";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await requireConsentedUser();

  return <AppShell userName={user.name}>{children}</AppShell>;
}
