# Contrast audit — WCAG 2.1 AA

**Generated, not hand-written.** Regenerate with:

```bash
node scripts/check-contrast.mjs > /tmp/audit.md   # exits non-zero if a gated pair fails
pnpm check:contrast
```

Ratios are computed from the HSL channel values in `src/app/globals.css`, so this
document cannot drift from the tokens the app actually ships. The script is a CI
gate, not documentation: a change that breaks a gated pair fails the build.

## Thresholds applied

| Content                                                   | Threshold | Source                         |
| --------------------------------------------------------- | --------- | ------------------------------ |
| Normal-size text                                          | 4.5:1     | WCAG 1.4.3 Contrast (Minimum)  |
| Large text (>=18.66px bold / 24px regular)                | 3:1       | WCAG 1.4.3                     |
| Icons, borders, focus rings, badge fills that carry state | 3:1       | WCAG 1.4.11 Non-text Contrast  |
| Purely decorative borders                                 | n/a       | WCAG 1.4.11 exempts decoration |

## Three findings worth knowing

**1. White on `--primary` fails (3.65:1).** This is why the token set splits brand
teal from the button fill. `--primary` (#0D9488) is for large/bold text, icons,
borders, focus rings and chart series — all of which only need 3:1. A solid button
with a normal-size label uses `--primary-button` (#0F766E, 5.55:1). The brief's hex
values are unchanged; the usage rule is what carries the accessibility guarantee.

**2. `--warning` and `--info` cannot be icon foregrounds on a light surface.**
#F59E0B on white is 2.13:1 and #0EA5E9 on white is 2.86:1 — both below the 3:1
non-text threshold, so a warning icon would be effectively invisible to a low-vision
user. Use `--chart-3` (amber ink, #B45309, 5.05:1) or `--chart-4` (sky ink, #0369A1,
5.95:1) as the foreground instead. Those values already exist in the chart palette
for exactly this reason, so no new token is needed and the canonical 30-name
vocabulary (A8) stays intact.

**3. Text on a status fill must use `--accent-foreground`, never `--foreground`.**
This is the subtle one. The status fills are bright in _both_ themes, but
`--foreground` flips to near-white (#F1F5F9) in dark mode, so `bg-warning
text-foreground` measures a healthy 8.38:1 in light mode and collapses to **1.55:1**
in dark mode. `--accent-foreground` is #0F172A in both themes, which is why it is the
correct ink for any status fill. A combination that looks right in light mode and
fails in dark mode is the kind of defect a hand-written audit misses, which is the
argument for generating this file.

## Audited pairs

### Light theme

| Foreground                         | Background                       | Context                                   | Ratio       | Needs | Verdict |
| ---------------------------------- | -------------------------------- | ----------------------------------------- | ----------- | ----- | ------- |
| `--foreground` #0F1729             | `--background` #F8FAFC           | Body text on page background              | **17.08:1** | 4.5:1 | PASS    |
| `--foreground` #0F1729             | `--card` #FFFFFF                 | Body text on a card                       | **17.87:1** | 4.5:1 | PASS    |
| `--card-foreground` #0F1729        | `--card` #FFFFFF                 | Card text on card                         | **17.87:1** | 4.5:1 | PASS    |
| `--popover-foreground` #0F1729     | `--popover` #FFFFFF              | Popover text                              | **17.87:1** | 4.5:1 | PASS    |
| `--muted-foreground` #48566A       | `--background` #F8FAFC           | Muted text on page                        | **7.13:1**  | 4.5:1 | PASS    |
| `--muted-foreground` #48566A       | `--card` #FFFFFF                 | Muted text on card                        | **7.46:1**  | 4.5:1 | PASS    |
| `--primary-foreground` #FFFFFF     | `--primary-button` #0F756D       | Solid primary button label                | **5.55:1**  | 4.5:1 | PASS    |
| `--primary-foreground` #FFFFFF     | `--primary-button-hover` #115F5A | Primary button label, hover               | **7.48:1**  | 4.5:1 | PASS    |
| `--secondary-foreground` #FFFFFF   | `--secondary` #5048E5            | Secondary button label                    | **6.18:1**  | 4.5:1 | PASS    |
| `--accent-foreground` #0F1729      | `--accent` #F97167               | Label on coral accent fill                | **6.46:1**  | 4.5:1 | PASS    |
| `--destructive-foreground` #FFFFFF | `--destructive` #DC2828          | Destructive button label                  | **4.80:1**  | 4.5:1 | PASS    |
| `--accent-foreground` #0F1729      | `--success` #16A249              | Dark ink on success fill                  | **5.36:1**  | 4.5:1 | PASS    |
| `--accent-foreground` #0F1729      | `--warning` #F59F0A              | Dark ink on warning fill                  | **8.38:1**  | 4.5:1 | PASS    |
| `--accent-foreground` #0F1729      | `--info` #0DA2E7                 | Dark ink on info fill                     | **6.25:1**  | 4.5:1 | PASS    |
| `--primary` #0D968B                | `--background` #F8FAFC           | Brand teal as icon/border/ring (non-text) | **3.49:1**  | 3:1   | PASS    |
| `--primary` #0D968B                | `--card` #FFFFFF                 | Brand teal icon on card (non-text)        | **3.65:1**  | 3:1   | PASS    |
| `--ring` #0D968B                   | `--background` #F8FAFC           | Focus ring against page                   | **3.49:1**  | 3:1   | PASS    |
| `--destructive` #DC2828            | `--card` #FFFFFF                 | Danger icon on card (non-text)            | **4.80:1**  | 3:1   | PASS    |
| `--chart-1` #0D968B                | `--card` #FFFFFF                 | Chart series 1 (non-text)                 | **3.65:1**  | 3:1   | PASS    |
| `--chart-2` #5048E5                | `--card` #FFFFFF                 | Chart series 2 (non-text)                 | **6.18:1**  | 3:1   | PASS    |
| `--chart-3` #B35309                | `--card` #FFFFFF                 | Chart series 3 / amber ink (non-text)     | **5.05:1**  | 3:1   | PASS    |
| `--chart-4` #0369A0                | `--card` #FFFFFF                 | Chart series 4 / sky ink (non-text)       | **5.95:1**  | 3:1   | PASS    |
| `--chart-5` #A31DAF                | `--card` #FFFFFF                 | Chart series 5 (non-text)                 | **6.26:1**  | 3:1   | PASS    |

#### Banned combinations (light theme)

| Combination                           | Context                                                       | Ratio      | Needs | Use instead                                                                                       |
| ------------------------------------- | ------------------------------------------------------------- | ---------- | ----- | ------------------------------------------------------------------------------------------------- |
| `--primary-foreground` on `--primary` | White label on brand teal, normal text                        | **3.65:1** | 4.5:1 | use --primary-button (bg-primary-button); --primary is for large/bold text, icons, borders, rings |
| `--warning` on `--card`               | Warning colour as an icon/badge FOREGROUND on a light surface | **2.13:1** | 3:1   | use --chart-3 (amber ink) as the foreground, or --warning as a FILL with --accent-foreground text |
| `--info` on `--card`                  | Info colour as an icon/badge FOREGROUND on a light surface    | **2.86:1** | 3:1   | use --chart-4 (sky ink) as the foreground, or --info as a FILL with --accent-foreground text      |
| `--foreground` on `--warning`         | Theme --foreground on a warning fill                          | **8.38:1** | 4.5:1 | use --accent-foreground: --foreground is near-white in dark mode and drops to ~1.6:1              |

### Dark theme

| Foreground                         | Background                       | Context                                   | Ratio       | Needs | Verdict |
| ---------------------------------- | -------------------------------- | ----------------------------------------- | ----------- | ----- | ------- |
| `--foreground` #F1F5F9             | `--background` #0F1729           | Body text on page background              | **16.32:1** | 4.5:1 | PASS    |
| `--foreground` #F1F5F9             | `--card` #1D283A                 | Body text on a card                       | **13.53:1** | 4.5:1 | PASS    |
| `--card-foreground` #F1F5F9        | `--card` #1D283A                 | Card text on card                         | **13.53:1** | 4.5:1 | PASS    |
| `--popover-foreground` #F1F5F9     | `--popover` #1D283A              | Popover text                              | **13.53:1** | 4.5:1 | PASS    |
| `--muted-foreground` #94A3B8       | `--background` #0F1729           | Muted text on page                        | **6.97:1**  | 4.5:1 | PASS    |
| `--muted-foreground` #94A3B8       | `--card` #1D283A                 | Muted text on card                        | **5.78:1**  | 4.5:1 | PASS    |
| `--primary-foreground` #0F1729     | `--primary-button` #2BD4BD       | Solid primary button label                | **9.58:1**  | 4.5:1 | PASS    |
| `--primary-foreground` #0F1729     | `--primary-button-hover` #2DB4A4 | Primary button label, hover               | **6.96:1**  | 4.5:1 | PASS    |
| `--secondary-foreground` #0F1729   | `--secondary` #828DF8            | Secondary button label                    | **6.06:1**  | 4.5:1 | PASS    |
| `--accent-foreground` #0F1729      | `--accent` #F97167               | Label on coral accent fill                | **6.46:1**  | 4.5:1 | PASS    |
| `--destructive-foreground` #0F1729 | `--destructive` #F87272          | Destructive button label                  | **6.50:1**  | 4.5:1 | PASS    |
| `--accent-foreground` #0F1729      | `--success` #4ADE80              | Dark ink on success fill                  | **10.26:1** | 4.5:1 | PASS    |
| `--accent-foreground` #0F1729      | `--warning` #FBBD23              | Dark ink on warning fill                  | **10.56:1** | 4.5:1 | PASS    |
| `--accent-foreground` #0F1729      | `--info` #3ABFF8                 | Dark ink on info fill                     | **8.50:1**  | 4.5:1 | PASS    |
| `--primary` #2BD4BD                | `--background` #0F1729           | Brand teal as icon/border/ring (non-text) | **9.58:1**  | 3:1   | PASS    |
| `--primary` #2BD4BD                | `--card` #1D283A                 | Brand teal icon on card (non-text)        | **7.94:1**  | 3:1   | PASS    |
| `--ring` #2BD4BD                   | `--background` #0F1729           | Focus ring against page                   | **9.58:1**  | 3:1   | PASS    |
| `--destructive` #F87272            | `--card` #1D283A                 | Danger icon on card (non-text)            | **5.39:1**  | 3:1   | PASS    |
| `--chart-1` #2BD4BD                | `--card` #1D283A                 | Chart series 1 (non-text)                 | **7.94:1**  | 3:1   | PASS    |
| `--chart-2` #828DF8                | `--card` #1D283A                 | Chart series 2 (non-text)                 | **5.02:1**  | 3:1   | PASS    |
| `--chart-3` #FBBD23                | `--card` #1D283A                 | Chart series 3 / amber ink (non-text)     | **8.76:1**  | 3:1   | PASS    |
| `--chart-4` #3ABFF8                | `--card` #1D283A                 | Chart series 4 / sky ink (non-text)       | **7.05:1**  | 3:1   | PASS    |
| `--chart-5` #E87BF9                | `--card` #1D283A                 | Chart series 5 (non-text)                 | **6.09:1**  | 3:1   | PASS    |

#### Banned combinations (dark theme)

| Combination                           | Context                                                       | Ratio      | Needs | Use instead                                                                                       |
| ------------------------------------- | ------------------------------------------------------------- | ---------- | ----- | ------------------------------------------------------------------------------------------------- |
| `--primary-foreground` on `--primary` | White label on brand teal, normal text                        | **9.58:1** | 4.5:1 | use --primary-button (bg-primary-button); --primary is for large/bold text, icons, borders, rings |
| `--warning` on `--card`               | Warning colour as an icon/badge FOREGROUND on a light surface | **8.76:1** | 3:1   | use --chart-3 (amber ink) as the foreground, or --warning as a FILL with --accent-foreground text |
| `--info` on `--card`                  | Info colour as an icon/badge FOREGROUND on a light surface    | **7.05:1** | 3:1   | use --chart-4 (sky ink) as the foreground, or --info as a FILL with --accent-foreground text      |
| `--foreground` on `--warning`         | Theme --foreground on a warning fill                          | **1.55:1** | 4.5:1 | use --accent-foreground: --foreground is near-white in dark mode and drops to ~1.6:1              |

## Colour is never the sole carrier of meaning

Every status is rendered with an icon **and** a text label (`StatusBadge`), per C4 and
WCAG 1.4.1 Use of Color. The contrast figures above govern legibility; they are not a
licence to communicate state through colour alone.
