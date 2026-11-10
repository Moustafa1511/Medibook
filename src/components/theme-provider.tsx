"use client";

// "use client": next-themes reads and writes localStorage and toggles a class on
// <html>, all of which are browser-only concerns.
import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

/**
 * Mounts the theme context that ThemeToggle's useTheme() depends on. Without
 * this provider, setTheme() has nowhere to write and the .dark class is never
 * applied, so dark mode silently does nothing.
 *
 * attribute="class" matches tailwind.config.ts's darkMode: "class" and the
 * `.dark` block in globals.css.
 */
export function ThemeProvider({ children, ...props }: ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
