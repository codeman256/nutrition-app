"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

/**
 * Appearance override. Defaults to "system" (follows the OS), but lets the user
 * pin light or dark in the browser regardless of the OS setting. next-themes
 * persists the choice to localStorage.
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  // Theme is only known on the client; render a stable value until mounted to
  // avoid a hydration mismatch.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const current = mounted ? (theme ?? "system") : "system";

  return (
    <div className="flex flex-col gap-2">
      <Label>Appearance</Label>
      <div
        role="radiogroup"
        aria-label="Appearance"
        className="inline-flex w-fit rounded-lg border p-1"
      >
        {OPTIONS.map(({ value, label, icon: Icon }) => {
          const active = current === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setTheme(value)}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
              {label}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        System follows your device&apos;s light/dark setting. Light or dark pins
        it in this browser.
      </p>
    </div>
  );
}
