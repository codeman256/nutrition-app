import { AppShell } from "@/components/app-shell";
import { isAdmin, requireConsentedUser } from "@/lib/session";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await requireConsentedUser();
  const admin = await isAdmin(user.id);

  return (
    <AppShell userName={user.name} isAdmin={admin}>
      {children}
    </AppShell>
  );
}
