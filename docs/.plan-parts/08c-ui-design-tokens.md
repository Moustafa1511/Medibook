### 8.3 Design tokens mapped to Tailwind config

Lives in `src/app/globals.css` and `tailwind.config.ts` (Section 3's root-level file list). Tailwind
3.4.x, class-strategy dark mode (C2). Every color is declared once as an HSL-channel CSS variable
(shadcn convention) and consumed through `hsl(var(--x) / <alpha-value>)`, so a Tailwind opacity
modifier (`bg-primary/50`) still works and no component ever hand-writes a hex. Three additions
beyond the brief's literal palette appear below, each flagged where it's introduced: a dedicated
`--primary-button`/`--primary-button-hover` pair (naming the distinct operating color C18 already
mandates), a fifth chart hue (8.3.8), and `--muted-foreground` (the brief's own `#475569` "muted
text," which otherwise has no CSS home).

#### 8.3.1 Token table

Brief colors only, hexes verbatim. Derived/adjusted shades (ink variants, dark-mode values,
`--primary-button`, chart-5) are introduced in 8.3.2–8.3.8 and are not "brief tokens."

| Token name | Hex | HSL channels | CSS variable | Tailwind utility | Where used |
|---|---|---|---|---|---|
| Primary (Teal) | `#0D9488` | `175 84% 32%` | `--primary` | `bg-primary` `text-primary` `ring-primary` `border-primary` | Icons, focus rings, borders, large/bold text, chart-1 — never normal-weight text on white (8.3.4) |
| Primary hover | `#0F766E` | `175 77% 26%` | `--primary-button` | `bg-primary-button` | **The actual** solid-button fill (Button `default` variant, wizard Next/Confirm, admin primary actions) — not `--primary` itself (8.3.4) |
| Secondary (Indigo) | `#4F46E5` | `243 75% 59%` | `--secondary` | `text-secondary` `border-secondary` `bg-secondary` | Secondary/outline buttons, links, selected-tab indicator, chart-2 |
| Accent (Soft Coral) | `#F97066` | `4 92% 69%` | `--accent` | `bg-accent` | Hero "Book Appointment" CTA fill only (brief: "used sparingly") — paired with `text-foreground`, never its own text color (8.3.4) |
| Background | `#F8FAFC` | `210 40% 98%` | `--background` | `bg-background` | Page canvas (`<body>`) |
| Surface | `#FFFFFF` | `0 0% 100%` | `--card`, `--popover` | `bg-card` `bg-popover` | Cards, dialogs, popovers, table rows |
| Border | `#E2E8F0` | `214 32% 91%` | `--border`, `--input`, `--muted` | `border-border` `bg-muted` | Dividers, input borders, disabled/subtle fills — reused as `--muted` too; the brief gives no separate "subtle surface" hex, and this is already the clinic's one neutral-gray |
| Text (primary) | `#0F172A` | `222 47% 11%` | `--foreground` | `text-foreground` | Body/heading text everywhere; also `--primary-foreground`-equivalent dark-mode value (8.3.4) |
| Text (muted) | `#475569` | `215 19% 35%` | `--muted-foreground` | `text-muted-foreground` | Secondary copy, captions, table meta — **added token**: the brief names this color explicitly but 8.3.2's suggested variable list omits a muted-text pairing; omitting the variable would leave an explicitly-specified brief color with no CSS home |
| Success | `#16A34A` | `142 76% 36%` | `--success` | `text-success` `border-success` | Status icon/dot/border only, never normal text (8.3.4, 8.3.7) |
| Warning | `#F59E0B` | `38 92% 50%` | `--warning` | `fill-warning` (chart tint only) | Reserved for large fills/tints; icon/text/border use goes through `warning-ink` (8.3.3, 8.3.4) |
| Danger | `#DC2626` | `0 72% 51%` | `--destructive` | `text-destructive` `border-destructive` | Status icon/border, destructive button/link text — passes as text directly, no ink shade needed (8.3.4) |
| Info | `#0EA5E9` | `199 89% 48%` | `--info` | `fill-info` (chart tint only) | Reserved for large fills/tints; icon/text/border use goes through `info-ink` (8.3.3, 8.3.4) |

#### 8.3.2 globals.css

**Canonical vocabulary (A8).** The CSS variable names declared below — in both `:root` and
`.dark` — are the *only* canonical names; nothing else may be introduced by an implementer.
`--primary-hover`, `--primary-hover-dark`, `--surface` and `--danger` are BANNED aliases and must
never appear in component or config code. Map any such name on sight: `--primary-hover` →
`--primary-button`, `--primary-hover-dark` → `--primary-button-hover` (its dark-mode value lives
in the same `.dark` block below, not a separate variable), `--surface` → `--card` or `--popover`
(whichever surface is meant), `--danger` → `--destructive`.

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* Neutrals */
    --background: 210 40% 98%;        /* #F8FAFC */
    --foreground: 222 47% 11%;        /* #0F172A */
    --card: 0 0% 100%;                /* #FFFFFF */
    --card-foreground: 222 47% 11%;   /* #0F172A — same as --foreground, see 8.3.4 */
    --popover: 0 0% 100%;             /* #FFFFFF */
    --popover-foreground: 222 47% 11%; /* #0F172A — same as --foreground, see 8.3.4 */
    --muted: 214 32% 91%;             /* #E2E8F0 */
    --muted-foreground: 215 19% 35%;  /* #475569 — brief "Text (muted)"; see 8.3.1 */
    --border: 214 32% 91%;            /* #E2E8F0 */
    --input: 214 32% 91%;             /* #E2E8F0 */

    /* Brand */
    --primary: 175 84% 32%;           /* #0D9488 — large text, icons, rings, chart-1 only */
    --primary-button: 175 77% 26%;    /* #0F766E — the actual solid-button fill, C18 */
    --primary-button-hover: 176 69% 22%; /* #115E59 */
    --primary-foreground: 0 0% 100%;  /* #FFFFFF — text on --primary-button */
    --secondary: 243 75% 59%;         /* #4F46E5 */
    --secondary-foreground: 0 0% 100%; /* #FFFFFF — 6.3:1 on --secondary, see 8.3.4 */
    --accent: 4 92% 69%;              /* #F97066 — fill only; text on it is --foreground */
    --accent-foreground: 222 47% 11%; /* #0F172A — same as --foreground, 6.4:1 on --accent, see 8.3.4 */
    --ring: 175 84% 32%;              /* reuses --primary */

    /* Status (icon / border / non-text use — see 8.3.4, 8.3.7) */
    --destructive: 0 72% 51%;         /* #DC2626 */
    --destructive-foreground: 0 0% 100%; /* #FFFFFF — 4.8:1 on --destructive, see 8.3.4 */
    --success: 142 76% 36%;           /* #16A34A */
    --warning: 38 92% 50%;            /* #F59E0B */
    --info: 199 89% 48%;              /* #0EA5E9 */

    /* Chart series (8.3.8) */
    --chart-1: 175 84% 32%;           /* teal   = --primary */
    --chart-2: 243 75% 59%;           /* indigo = --secondary */
    --chart-3: 26 90% 37%;            /* amber-ink  #B45309 — see 8.3.3/8.3.7 */
    --chart-4: 201 96% 32%;           /* sky-ink    #0369A1 — see 8.3.3/8.3.7 */
    --chart-5: 295 72% 40%;           /* fuchsia #A21CAF — net-new hue, 8.3.8 */

    --radius: 1rem;

    /* Semantic indirection: next/font injects --font-inter / --font-plus-
       jakarta-sans via a className on <html> (layout.tsx, Section 3); this
       maps "role" to "physical font" and adds a system-font fallback. */
    --font-sans: var(--font-inter), ui-sans-serif, system-ui, -apple-system,
      "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    --font-display: var(--font-plus-jakarta-sans), var(--font-sans);
  }

  .dark {
    --background: 222 47% 11%;        /* #0F172A */
    --foreground: 210 40% 96%;        /* #F1F5F9 */
    --card: 217 33% 17%;              /* #1E293B */
    --card-foreground: 210 40% 96%;   /* #F1F5F9 — same as --foreground, 13.4:1, see 8.3.4 */
    --popover: 217 33% 17%;           /* #1E293B */
    --popover-foreground: 210 40% 96%; /* #F1F5F9 — same as --foreground, 13.4:1, see 8.3.4 */
    --muted: 215 25% 27%;             /* #334155 */
    --muted-foreground: 215 20% 65%;  /* #94A3B8 */
    --border: 215 25% 27%;            /* #334155 */
    --input: 215 25% 27%;             /* #334155 */

    --primary: 172 66% 50%;           /* #2DD4BF — brightened; passes as text, see 8.3.4 */
    --primary-button: 172 66% 50%;    /* same bright teal is now light enough to be the fill */
    --primary-button-hover: 173 60% 44%; /* #26B8A5 */
    --primary-foreground: 222 47% 11%; /* #0F172A — dark text; flips polarity, see 8.3.4 */
    --secondary: 234 89% 74%;         /* #818CF8 */
    --secondary-foreground: 222 47% 11%; /* #0F172A — dark text, flips polarity, 6.0:1, see 8.3.4 */
    --accent: 4 92% 69%;              /* unchanged — still clears dark text, see 8.3.4 */
    --accent-foreground: 222 47% 11%; /* #0F172A — unchanged from light mode, 6.4:1, see 8.3.4 */
    --ring: 172 66% 50%;

    --destructive: 0 91% 71%;         /* #F87171 */
    --destructive-foreground: 222 47% 11%; /* #0F172A — dark text, flips polarity, 6.5:1, see 8.3.4 */
    --success: 142 69% 58%;           /* #4ADE80 */
    --warning: 43 96% 56%;            /* #FBBF24 */
    --info: 198 93% 60%;              /* #38BDF8 */

    --chart-1: 172 66% 50%;
    --chart-2: 234 89% 74%;
    --chart-3: 43 96% 56%;            /* brightened amber, no ink needed in dark mode (8.3.4) */
    --chart-4: 198 93% 60%;           /* brightened sky, no ink needed in dark mode */
    --chart-5: 292 91% 73%;           /* #E879F9 */
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground font-sans antialiased;
  }
}

/* C18: all transitions <=200ms and disabled wholesale under reduced motion.
   Focus ring is explicitly exempted — outline-color/box-shadow on :focus-visible
   is never part of this rule, so keyboard focus is never silently removed. */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

#### 8.3.3 tailwind.config.ts

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/features/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/content/**/*.{ts,tsx}",
  ],
  theme: {
    // Replaces (never extends — extend can only ADD keys) the default scale.
    // Tailwind's default keys are 4px steps, so the even-numbered keys ("2"
    // = 8px, "4" = 16px, ...) already land on the 8px grid; the odd ones
    // (4px, 12px, 20px, 28px...) are dropped, so e.g. "p-5"/"gap-7" stop
    // existing as valid classes.
    spacing: {
      0: "0px", px: "1px", // hairline borders, exempt from the grid
      2: "0.5rem", 4: "1rem", 6: "1.5rem", 8: "2rem",
      10: "2.5rem", 12: "3rem", 14: "3.5rem", 16: "4rem",
      20: "5rem", 24: "6rem", 28: "7rem", 32: "8rem",
      40: "10rem", 48: "12rem", 56: "14rem", 64: "16rem",
      // pattern continues to 96 — every surviving key is px % 8 === 0
    },
    extend: {
      colors: {
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        card: {
          DEFAULT: "hsl(var(--card) / <alpha-value>)",
          foreground: "hsl(var(--card-foreground) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "hsl(var(--popover) / <alpha-value>)",
          foreground: "hsl(var(--popover-foreground) / <alpha-value>)",
        },
        border: "hsl(var(--border) / <alpha-value>)",
        input: "hsl(var(--input) / <alpha-value>)",
        ring: "hsl(var(--ring) / <alpha-value>)",
        muted: {
          DEFAULT: "hsl(var(--muted) / <alpha-value>)",
          foreground: "hsl(var(--muted-foreground) / <alpha-value>)",
        },
        primary: {
          DEFAULT: "hsl(var(--primary) / <alpha-value>)",
          button: "hsl(var(--primary-button) / <alpha-value>)",
          "button-hover": "hsl(var(--primary-button-hover) / <alpha-value>)",
          foreground: "hsl(var(--primary-foreground) / <alpha-value>)",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary) / <alpha-value>)",
          foreground: "hsl(var(--secondary-foreground) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "hsl(var(--accent) / <alpha-value>)",
          foreground: "hsl(var(--accent-foreground) / <alpha-value>)",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
        },
        success: "hsl(var(--success) / <alpha-value>)",
        warning: "hsl(var(--warning) / <alpha-value>)",
        info: "hsl(var(--info) / <alpha-value>)",
        // Light-mode-only "ink" shades for warning/info icon/text/border use
        // (8.3.4, 8.3.7). Not CSS variables: dark mode brightens the base
        // --warning/--info value instead of darkening it further, so the
        // theme switch is a `dark:` class swap, not a variable override.
        "warning-ink": "#B45309",
        "info-ink": "#0369A1",
        chart: {
          1: "hsl(var(--chart-1) / <alpha-value>)",
          2: "hsl(var(--chart-2) / <alpha-value>)",
          3: "hsl(var(--chart-3) / <alpha-value>)",
          4: "hsl(var(--chart-4) / <alpha-value>)",
          5: "hsl(var(--chart-5) / <alpha-value>)",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        display: ["var(--font-display)"],
      },
      // lg = --radius (16px, equals Tailwind's own unmodified `rounded-2xl`);
      // md = --radius-4px (12px, equals unmodified `rounded-xl`). Hand-
      // authored components use the literal 2xl/xl utilities (C18); this
      // remap makes vendored, never-hand-edited shadcn primitives (C17,
      // which call `rounded-lg`/`rounded-md` internally) resolve to the
      // same pixel values from the same variable.
      borderRadius: {
        lg: "var(--radius)",                    // 16px
        md: "calc(var(--radius) - 4px)",         // 12px
        sm: "calc(var(--radius) - 8px)",         // 8px
      },
      boxShadow: {
        "soft-sm": "0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 1px 0 rgb(15 23 42 / 0.03)",
        "soft-md": "0 4px 12px -2px rgb(15 23 42 / 0.08), 0 2px 4px -2px rgb(15 23 42 / 0.04)",
        "soft-lg": "0 12px 32px -8px rgb(15 23 42 / 0.12), 0 4px 8px -4px rgb(15 23 42 / 0.06)",
      },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "slide-up-fade": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 150ms ease-out",
        "slide-up-fade": "slide-up-fade 200ms ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
```

#### 8.3.4 Contrast audit

C18's resolution, stated plainly: white text on `#0D9488` fails AA for normal-size text, so solid
primary buttons use `#0F766E` (hover `#115E59`) with white labels, and `#0D9488` itself is reserved
for large/bold text, icons, borders, focus rings and `chart-1`. Coral `#F97066` is fill-only —
`#0F172A` text on coral, never coral text on anything. Measured precisely (one decimal place; AA
normal text = 4.5:1, large text/UI components/icons = 3:1):

**Brand and neutral pairs (light mode)**

| Foreground | Background | Use | Ratio | Threshold | Verdict |
|---|---|---|---|---|---|
| `#FFFFFF` | `#0D9488` | normal-size button label (hypothetical — not actually used) | 3.7:1 | 4.5:1 | **FAIL** |
| `#FFFFFF` | `#0F766E` | solid primary button label (actual) | 5.5:1 | 4.5:1 | PASS |
| `#FFFFFF` | `#115E59` | primary button hover label | 7.6:1 | 4.5:1 | PASS |
| `#0D9488` | `#FFFFFF` / `#F8FAFC` | icon, border, focus ring, chart-1 | 3.7:1 / 3.6:1 | 3:1 | PASS |
| `#0F172A` | `#F97066` | coral CTA label (actual) | 6.4:1 | 4.5:1 | PASS |
| `#F97066` | `#FFFFFF` | coral AS text on white — banned | 2.8:1 | 4.5:1 | **FAIL** |
| `#475569` | `#F8FAFC` / `#FFFFFF` | muted body text | 7.2:1 / 7.6:1 | 4.5:1 | PASS |
| `#0F172A` | `#F8FAFC` / `#FFFFFF` | primary body/heading text | 17.1:1 / 17.9:1 | 4.5:1 | PASS |
| `#4F46E5` | `#FFFFFF` / `#F8FAFC` | secondary link/button text, border | 6.3:1 / 6.0:1 | 4.5:1 | PASS |
| `#E2E8F0` | `#FFFFFF` | decorative divider/border | 1.2:1 | n/a (decorative) | — |

**Status colors on white and on the page background (light mode)**

| Foreground | Background | Use | Ratio | Threshold | Verdict |
|---|---|---|---|---|---|
| `#16A34A` | `#FFFFFF` / `#F8FAFC` | success icon/border (non-text) | 3.3:1 / 3.2:1 | 3:1 | PASS |
| `#16A34A` | `#FFFFFF` | success AS normal text (not used) | 3.3:1 | 4.5:1 | **FAIL** |
| `#DC2626` | `#FFFFFF` / `#F8FAFC` | danger icon, border, and text (used directly) | 4.8:1 / 4.6:1 | 4.5:1 | PASS |
| `#B91C1C` | `#FFFFFF` | danger/destructive hover text | 6.5:1 | 4.5:1 | PASS |
| `#F59E0B` | `#FFFFFF` / `#F8FAFC` | warning AS SPECIFIED, icon/border | 2.1:1 / 2.1:1 | 3:1 | **FAIL** |
| `#B45309` (warning-ink) | `#FFFFFF` / `#F8FAFC` | warning icon/text — shade actually used | 5.0:1 / 4.8:1 | 3:1 | PASS |
| `#0EA5E9` | `#FFFFFF` / `#F8FAFC` | info AS SPECIFIED, icon/border | 2.8:1 / 2.7:1 | 3:1 | **FAIL** |
| `#0369A1` (info-ink) | `#FFFFFF` / `#F8FAFC` | info icon/text — shade actually used | 5.9:1 / 5.7:1 | 3:1 | PASS |

Finding beyond what C18 flags: the brief's `warning`/`info` hexes fail even the 3:1 *non-text* floor
against both white and the page background — too light for an icon stroke, badge border or chart
line, not merely borderline for text. Success and danger don't have this problem (3.3:1/4.8:1
against white already clear 3:1, danger clears 4.5:1 outright). Resolution, mirroring C18's own
primary/accent pattern: `--warning`/`--info` stay at the brief's exact hex, used only for large
fills/tints where no AA minimum applies (a badge's tint, a calendar event's fill — 8.3.7); every
icon/border/status-text use instead goes through `warning-ink` (`#B45309`) / `info-ink` (`#0369A1`)
(8.3.3). No status color is ever its own colored text on white — every `StatusBadge` label uses
`text-foreground`, color carried by the icon alone — which is also why `success`/`danger`'s raw
hexes need no adjustment: they only ever have to clear 3:1 (icon), or 4.5:1 for danger's occasional
use as link text, both already true.

**Dark mode**

Dark-mode brand/status values are brightened for visibility against a dark surface, which flips
`--primary-foreground` from white to dark (`#0F172A`): the same teal that's too dark for white
text in light mode becomes, once brightened for dark mode, too light for white text and needs dark
text instead — the mirror-image problem. `--secondary` has the identical issue if ever solid-filled
(not currently done — see table), which is exactly why destructive is specified as an outline/text
treatment in both themes (8.3.6/8.3.7): no shipped component actually needs a third per-theme
foreground override. `--secondary-foreground` and `--destructive-foreground` are nonetheless
declared in full in 8.3.2 (white in light mode, `#0F172A` in dark mode — the same flip as
`--primary-foreground`), satisfying A8's closed token vocabulary even though today's components
keep secondary and destructive as outline/text treatments rather than solid fills.

| Foreground | Background | Use | Ratio | Threshold | Verdict |
|---|---|---|---|---|---|
| `#F1F5F9` | `#0F172A` / `#1E293B` | body text on bg / card | 16.3:1 / 13.4:1 | 4.5:1 | PASS |
| `#94A3B8` | `#0F172A` / `#1E293B` | muted text | 7.0:1 / 5.7:1 | 4.5:1 | PASS |
| `#2DD4BF` | `#0F172A` | primary icon/text/ring directly on bg | 9.6:1 | 3:1 (icon) / 4.5:1 (text) | PASS (both) |
| `#0F172A` | `#2DD4BF` | dark text on bright primary fill (= dark `--primary-foreground`) | 9.6:1 | 4.5:1 | PASS |
| `#FFFFFF` | `#818CF8` | white text on secondary fill — not used, shown to justify why | 3.0:1 | 4.5:1 | **FAIL** |
| `#0F172A` | `#818CF8` | dark text on secondary fill, if ever solid-filled | 6.0:1 | 4.5:1 | PASS |
| `#F97066` | `#0F172A` | accent icon/text directly on bg (unchanged hex) | 6.4:1 | 4.5:1 | PASS |
| `#F87171` | `#0F172A` | destructive text/icon directly on bg | 6.5:1 | 4.5:1 | PASS |
| `#FFFFFF` | `#F87171` | white text on destructive fill — not used, shown to justify why | 2.8:1 | 4.5:1 | **FAIL** |
| `#4ADE80` / `#FBBF24` / `#38BDF8` | `#0F172A` | success/warning/info text/icon directly on bg | 10.3:1 / 10.7:1 / 8.3:1 | 4.5:1 | PASS — no ink shade needed in dark mode |

#### 8.3.5 Typography scale

Plus Jakarta Sans (`--font-display`) for headings and large numerals, Inter (`--font-sans`) for UI
text and body copy, both via `next/font/google` with `display: "swap"` and a `variable` export
(`src/app/layout.tsx`, Section 3). Self-hosted: `next/font` downloads the font files at build time
and serves them from the app's own origin with no runtime request to Google, which is what keeps
the landing page's third-party-script count at zero (C23) and avoids leaking visitor IPs to a
third-party font host (privacy, C20's spirit).

| Role | Element | Size | Line height | Weight | Tracking | Tailwind class |
|---|---|---|---|---|---|---|
| Hero display | Landing `<h1>` | fluid, `clamp(2.25rem, 1.9rem + 2.5vw, 3.75rem)` | 1.1 | 800 | `-0.02em` | `font-display text-[clamp(2.25rem,1.9rem+2.5vw,3.75rem)] font-extrabold leading-[1.1] tracking-tight` |
| H1 | Section/page title | 1.875rem → 2.25rem (`md:`) | 1.2 | 700 | `-0.01em` | `font-display text-3xl md:text-4xl font-bold leading-tight tracking-tight` |
| H2 | Subsection heading | 1.5rem → 1.875rem (`md:`) | 1.25 | 700 | normal | `font-display text-2xl md:text-3xl font-bold leading-snug` |
| H3 | Card/dialog title | 1.25rem | 1.3 | 600 | normal | `font-display text-xl font-semibold leading-snug` |
| KPI figure | Dashboard KPI number | 1.875rem → 2.25rem (`md:`) | 1.1 | 700 | normal | `font-display text-3xl md:text-4xl font-bold leading-none tabular-nums` |
| Eyebrow | Section label above an H2 | 0.875rem | 1.2 | 600 | `0.08em`, uppercase | `font-sans text-sm font-semibold uppercase tracking-wide text-muted-foreground` |
| Body (lead) | Hero/section intro paragraph | 1.125rem | 1.6 | 400 | normal | `font-sans text-lg leading-relaxed text-muted-foreground` |
| Body | Default paragraph | 1rem | 1.6 | 400 | normal | `font-sans text-base leading-relaxed` |
| Body small | Table cells, captions | 0.875rem | 1.5 | 400 | normal | `font-sans text-sm leading-normal` |
| Label | Form field label | 0.875rem | 1 | 500 | normal | `font-sans text-sm font-medium leading-none` |
| Button | Button/tab text | 0.875rem | 1 | 600 | `0.01em` | `font-sans text-sm font-semibold leading-none tracking-wide` |
| Badge | StatusBadge text | 0.75rem | 1 | 600 | `0.03em`, uppercase | `font-sans text-xs font-semibold uppercase tracking-wide` |

#### 8.3.6 Spacing, radius, elevation, motion

**Spacing.** 8px grid, enforced by replacing `theme.spacing` outright (8.3.3) rather than extending
it — the restriction is only meaningful if the odd 4px-stepped keys genuinely stop resolving to a
class; `theme.extend.spacing` cannot remove inherited keys, only add to them.

**Radius.** One source value, `--radius: 1rem`. Cards, dialogs and sheets: `rounded-2xl` (16px, a
plain Tailwind default already equal to `--radius`). Buttons, inputs, selects: `rounded-xl` (12px,
already equal to `--radius` minus 4px). `borderRadius.lg`/`.md` are remapped to the same two
pixel values so vendored shadcn primitives (which call `rounded-lg`/`rounded-md` internally and are
never hand-edited, C17) land on the identical radii without anyone touching the vendored files.

**Elevation.** Three levels, soft and low-opacity (brief: "soft shadows"), slate-tinted rather than
pure black so they read as a lift in the page's own neutral: `shadow-soft-sm` (resting card),
`shadow-soft-md` (hover/raised card, open dropdown), `shadow-soft-lg` (modal/popover/sheet). Dark
mode keeps the same values but they contribute little against a dark surface by construction (a
black-tinted shadow is nearly invisible on `#0F172A`); dark-mode elevation instead comes from the
`--card`/`--background` lightness step (8.3.2) plus a 1px `--border` — stated explicitly since it's
an easy thing to forget once a dark toggle ships and cards start looking flat.

**Motion.** All transitions ≤200ms (C18), `ease-out` entering/growing and the reverse leaving/
shrinking — matches `tailwindcss-animate`'s Radix `data-state` enter/exit animations for Dialog/
Sheet/Popover/DropdownMenu/Tooltip (C2; those keyframes are the plugin's, not hand-rolled). The two
hand-rolled keyframes above cover what nothing else owns: `/book/success`'s reference-code reveal
and `OtpResendButton`'s cooldown-complete state change. Only opacity and `transform: translateY`
animate — never `width`/`height`/`top`/`left`, which would force layout and can't be disabled by
`prefers-reduced-motion` without a visible jump. The reduced-motion override (8.3.2) collapses every
duration to effectively zero and disables smooth scrolling; it never touches `:focus-visible`
outline/ring styles, which are never animated or removed (C18).

#### 8.3.7 Status colour mapping

Five `AppointmentStatus` values (C4) against four brief status colors — `NO_SHOW` reuses the neutral
`muted-foreground` gray rather than inventing a fifth hue, since color is never the sole signal
(WCAG 1.4.1): icon and text label are both always present, so two statuses may legitimately share a
color family as long as their icon and label differ, which `CANCELLED` and `NO_SHOW` do here.

| Status | Icon (lucide) | Badge color (light) | Badge color (dark) | Calendar event color | Chart color |
|---|---|---|---|---|---|
| `PENDING_VERIFICATION` | `Clock3` | `warning-ink` `#B45309` | `warning` `#FBBF24` | `--warning` fill, `warning-ink` label | — (excluded: never a completed/booked outcome) |
| `CONFIRMED` | `CalendarCheck2` | `info-ink` `#0369A1` | `info` `#38BDF8` | `--info` fill, `info-ink` label | `--chart-2` (indigo) in "expected revenue" |
| `COMPLETED` | `CheckCircle2` | `success` `#16A34A` | `success` `#4ADE80` | `--success` fill | `--chart-1` (teal) in revenue-over-time |
| `CANCELLED` | `XCircle` | `destructive` `#DC2626` | `destructive` `#F87171` | `--destructive` fill | — (excluded from revenue) |
| `NO_SHOW` | `UserX` | `muted-foreground` `#475569` | `muted-foreground` `#94A3B8` | `--muted` fill, `muted-foreground` label | — (excluded from revenue) |

Badge implementation: `ui/badge` with a low-opacity tint background (`bg-{color}/10`) and the icon +
label in the ink/dark-mode color above — never the status color as the badge's own full-opacity
background with reversed text (the fill-vs-text polarity problem from 8.3.4). `AdminCalendar`'s
event fill is the one place a status color IS a sizeable background; no AA minimum applies to a
background in isolation, but the label drawn on top of it still renders in the same `warning-ink`/
`info-ink` tone used elsewhere for that status, keeping one consistent "ink" per status across
badge, calendar and chart rather than a one-off third shade.

#### 8.3.8 Chart palette

`chart-1`/`chart-2` reuse the brand hues (teal, indigo); `chart-3`/`chart-4` reuse `warning-ink`/
`info-ink` (8.3.3) rather than the raw `warning`/`info` hexes, for the same reason those failed the
icon/border audit — a thin line at the raw hex is nearly invisible against `#FFFFFF`/`#F8FAFC`
(2.1:1/2.7:1, 8.3.4). `chart-5` (`#A21CAF`, fuchsia) is a net-new hue: the brief's seven named colors
leave none spare for a fifth categorical series, so one addition was unavoidable, and it was chosen
— not defaulted — for two properties:

- **Grayscale.** The five relative luminances (teal 0.230, indigo 0.117, amber-ink 0.070, sky-ink
  0.098, fuchsia 0.056 — computed) are spread widely enough that a grayscale conversion still
  orders all five by visibly different lightness; none collapse together.
- **CVD.** Deuteranopia/protanopia (red-green) compress hues within that band; none of the five
  sits there alone — teal/sky are cyan-leaning blues, indigo/fuchsia are blue-violet/magenta,
  amber-ink is orange. Tritanopia (blue-yellow, rarer) is the harder case for a blue-heavy set;
  amber-ink is the one warm hue that gives it a non-blue anchor.
- **Never hue-alone.** Both chart components render a visually-hidden `<table>` fallback (8.2.12),
  and Recharts' tooltip/legend pair every swatch with its label and value — color is a convenience,
  never the only way to read a series (WCAG 1.4.1, same principle as 8.3.7).
- **Axis/grid/tooltip.** Gridlines/ticks: `stroke-border` at `/60` opacity — decorative, so the 3:1
  floor doesn't apply. Axis labels: `fill-muted-foreground` (passes 4.5:1 in both themes, 8.3.4).
  Tooltip: `bg-popover` + `shadow-soft-md` + `text-foreground` — the same tokens as any other
  floating panel, not a chart-specific one.

#### Contract Challenges

1. **C18's own worked example doesn't round-trip to its hex.** C18 writes `--primary: 174 80% 32%`
   for `#0D9488`; converting that triple back to RGB gives approximately `#109386`, a visible drift
   if copied literally. The precise conversion, used in 8.3.2, is `175 84% 32%`. C18 should state
   the conversion rule (RGB→HSL, each channel rounded to the nearest integer) rather than one
   hand-rounded example, so independent sections don't quietly disagree on the one token meant to
   be the shared source of truth for the brand teal.
2. **C18 flags only primary/accent; `warning`/`info` have the same defect, worse.** C18 names
   exactly two adjustments (primary's button shade, coral's text-on-fill ban). Measured here
   (8.3.4), the brief's `warning`/`info` hexes fail not just AA text contrast but the lower 3:1
   non-text floor against both white and the page background — unusable even as an icon stroke or
   border, unlike `success`/`danger`. C18 should pin `warning-ink`/`info-ink`-equivalent shades
   itself (as it already pins `#0F766E` for primary), rather than leaving 8.3.7's badges, 8.3.8's
   chart-3/chart-4, and any future admin-calendar work to each separately re-derive the same fix.
