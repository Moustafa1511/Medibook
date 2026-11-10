import type { Config } from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme";
import animate from "tailwindcss-animate";

/**
 * Every colour resolves through a CSS variable declared in src/app/globals.css,
 * using the `hsl(var(--x) / <alpha-value>)` form so opacity modifiers such as
 * `bg-primary/10` keep working (C18, Section 8.3.3).
 *
 * SPACING CONVENTION (C18): the 8px grid. Tailwind's default scale is 4px-based,
 * so "on the grid" means only even-numbered utilities are used in app code —
 * p-2 (8px), p-4 (16px), p-6 (24px), gap-8 (32px). Odd steps (p-1, p-3, p-5) are
 * off-grid. This is a review convention: no Tailwind class-name linter is
 * introduced by this plan, so it is enforced by code review, not by CI.
 */
const config: Config = {
  darkMode: "class",
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/features/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        border: "hsl(var(--border) / <alpha-value>)",
        input: "hsl(var(--input) / <alpha-value>)",
        ring: "hsl(var(--ring) / <alpha-value>)",
        success: "hsl(var(--success) / <alpha-value>)",
        warning: "hsl(var(--warning) / <alpha-value>)",
        info: "hsl(var(--info) / <alpha-value>)",
        card: {
          DEFAULT: "hsl(var(--card) / <alpha-value>)",
          foreground: "hsl(var(--card-foreground) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "hsl(var(--popover) / <alpha-value>)",
          foreground: "hsl(var(--popover-foreground) / <alpha-value>)",
        },
        primary: {
          DEFAULT: "hsl(var(--primary) / <alpha-value>)",
          foreground: "hsl(var(--primary-foreground) / <alpha-value>)",
          // Solid fills with normal-size labels must use these, not DEFAULT:
          // white on --primary measures ~3.4:1 and fails WCAG AA (C18).
          button: "hsl(var(--primary-button) / <alpha-value>)",
          "button-hover": "hsl(var(--primary-button-hover) / <alpha-value>)",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary) / <alpha-value>)",
          foreground: "hsl(var(--secondary-foreground) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "hsl(var(--accent) / <alpha-value>)",
          foreground: "hsl(var(--accent-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted) / <alpha-value>)",
          foreground: "hsl(var(--muted-foreground) / <alpha-value>)",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
        },
        chart: {
          "1": "hsl(var(--chart-1) / <alpha-value>)",
          "2": "hsl(var(--chart-2) / <alpha-value>)",
          "3": "hsl(var(--chart-3) / <alpha-value>)",
          "4": "hsl(var(--chart-4) / <alpha-value>)",
          "5": "hsl(var(--chart-5) / <alpha-value>)",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", ...defaultTheme.fontFamily.sans],
        display: ["var(--font-display)", ...defaultTheme.fontFamily.sans],
      },
      borderRadius: {
        // rounded-2xl cards, rounded-xl inputs and buttons (C18).
        "2xl": "var(--radius)",
        xl: "calc(var(--radius) - 0.25rem)",
        lg: "calc(var(--radius) - 0.5rem)",
      },
      boxShadow: {
        // Soft, low-contrast elevation; three levels only.
        soft: "0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 3px 0 rgb(15 23 42 / 0.06)",
        card: "0 2px 4px -1px rgb(15 23 42 / 0.05), 0 4px 12px -2px rgb(15 23 42 / 0.08)",
        lifted: "0 8px 16px -4px rgb(15 23 42 / 0.10), 0 16px 32px -8px rgb(15 23 42 / 0.10)",
      },
      transitionDuration: {
        // C18 caps transitions at 200ms.
        DEFAULT: "150ms",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 150ms ease-out",
        "slide-up": "slide-up 200ms ease-out",
      },
    },
  },
  plugins: [animate],
};

export default config;
