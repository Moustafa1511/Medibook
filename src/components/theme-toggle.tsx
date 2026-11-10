"use client";

// "use client": reads/writes theme state via next-themes' `useTheme()` hook
// and handles a click event — neither is available to a Server Component.

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ThemeToggleProps {
  className?: string;
}

/**
 * Light/dark toggle built on next-themes. `next-themes` only knows the real
 * theme after it has read `localStorage` on the client, so the very first
 * render (both the server-rendered HTML and React's first client render,
 * before effects run) must match exactly or React logs a hydration
 * mismatch. We render a stable, disabled placeholder until a `useEffect`
 * confirms we are mounted on the client, then swap to the real control —
 * the standard next-themes pattern for avoiding that mismatch.
 */
export function ThemeToggle({ className }: ThemeToggleProps) {
  const [mounted, setMounted] = React.useState(false);
  const { resolvedTheme, setTheme } = useTheme();

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === "dark";
  const label = mounted
    ? isDark
      ? "التبديل إلى المظهر الفاتح"
      : "التبديل إلى المظهر الداكن"
    : "تبديل المظهر الفاتح والداكن";

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={label}
      disabled={!mounted}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn("shrink-0", className)}
    >
      {isDark ? (
        <Sun aria-hidden="true" className="h-5 w-5" />
      ) : (
        <Moon aria-hidden="true" className="h-5 w-5" />
      )}
    </Button>
  );
}
