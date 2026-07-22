"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AccountSettings({
  initialName,
  initialEmail,
}: {
  initialName: string;
  initialEmail: string;
}) {
  const router = useRouter();

  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState<null | "name" | "email" | "password">(null);

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim() === initialName || !name.trim()) return;
    setBusy("name");
    const { error } = await authClient.updateUser({ name: name.trim() });
    setBusy(null);
    if (error) {
      toast.error(error.message ?? "Couldn't update your name");
      return;
    }
    toast.success("Name updated");
    router.refresh();
  }

  async function saveEmail(e: React.FormEvent) {
    e.preventDefault();
    if (email.trim() === initialEmail || !email.trim()) return;
    setBusy("email");
    const { error } = await authClient.changeEmail({ newEmail: email.trim() });
    setBusy(null);
    if (error) {
      toast.error(error.message ?? "Couldn't change your email");
      return;
    }
    toast.success("Email updated");
    router.refresh();
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!currentPassword || newPassword.length < 8) return;
    setBusy("password");
    const { error } = await authClient.changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions: true,
    });
    setBusy(null);
    if (error) {
      toast.error(error.message ?? "Couldn't change your password");
      return;
    }
    setCurrentPassword("");
    setNewPassword("");
    toast.success("Password changed — other sessions signed out");
  }

  return (
    <div className="flex max-w-md flex-col gap-6">
      <form onSubmit={saveName} className="flex flex-col gap-2">
        <Label htmlFor="acct-name">Name</Label>
        <div className="flex gap-2">
          <Input
            id="acct-name"
            value={name}
            autoComplete="name"
            onChange={(e) => setName(e.target.value)}
          />
          <Button
            type="submit"
            variant="outline"
            disabled={busy !== null || name.trim() === initialName || !name.trim()}
          >
            {busy === "name" ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>

      <form onSubmit={saveEmail} className="flex flex-col gap-2">
        <Label htmlFor="acct-email">Email</Label>
        <div className="flex gap-2">
          <Input
            id="acct-email"
            type="email"
            value={email}
            autoComplete="email"
            onChange={(e) => setEmail(e.target.value)}
          />
          <Button
            type="submit"
            variant="outline"
            disabled={busy !== null || email.trim() === initialEmail || !email.trim()}
          >
            {busy === "email" ? "Saving…" : "Save"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          You sign in with this email. Changing it takes effect immediately.
        </p>
      </form>

      <form onSubmit={savePassword} className="flex flex-col gap-2">
        <Label htmlFor="acct-current">Change password</Label>
        <Input
          id="acct-current"
          type="password"
          placeholder="Current password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
        />
        <Input
          id="acct-new"
          type="password"
          placeholder="New password (min 8 characters)"
          autoComplete="new-password"
          minLength={8}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        <Button
          type="submit"
          variant="outline"
          className="self-start"
          disabled={busy !== null || !currentPassword || newPassword.length < 8}
        >
          {busy === "password" ? "Changing…" : "Change password"}
        </Button>
      </form>
    </div>
  );
}
