/**
 * WCAG 2.1 AA contrast gate for the design tokens in src/app/globals.css.
 *
 * Run: node scripts/check-contrast.mjs [path-to-globals.css]
 * Exits non-zero if any GATED pair falls below its threshold, so the committed
 * audit in docs/accessibility/contrast-audit.md can never drift from the CSS.
 *
 * Thresholds (WCAG 2.1): 4.5:1 normal text, 3:1 large/bold text and non-text UI
 * (1.4.11 Non-text Contrast, which covers an icon or badge fill that carries state).
 */
import { readFileSync } from "node:fs";

const target = process.argv[2] ?? new URL("../src/app/globals.css", import.meta.url).pathname;
const css = readFileSync(target, "utf8");

function block(selector) {
  const re = new RegExp(
    selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*\\{([\\s\\S]*?)\\n  \\}",
    "m",
  );
  const m = css.match(re);
  if (!m) throw new Error("token block not found: " + selector);
  const out = {};
  for (const line of m[1].split("\n")) {
    const d = line.match(/--([a-z0-9-]+):\s*([^;]+);/);
    if (d && d[1] !== "radius") out[d[1]] = d[2].trim();
  }
  return out;
}

function hslToRgb(str) {
  const m = str.match(/^([\d.]+)\s+([\d.]+)%\s+([\d.]+)%$/);
  if (!m) return null;
  const h = parseFloat(m[1]) / 360,
    s = parseFloat(m[2]) / 100,
    l = parseFloat(m[3]) / 100;
  if (s === 0) return [l, l, l].map((v) => Math.round(v * 255));
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue = (t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [hue(h + 1 / 3), hue(h), hue(h - 1 / 3)].map((v) => Math.round(v * 255));
}

const luminance = ([r, g, b]) =>
  [r, g, b]
    .map((c) => {
      c /= 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    })
    .reduce((acc, v, i) => acc + v * [0.2126, 0.7152, 0.0722][i], 0);

const ratio = (a, b) => {
  const l1 = luminance(a),
    l2 = luminance(b);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
};

const hex = ([r, g, b]) =>
  "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0").toUpperCase()).join("");

/** Pairs that MUST pass. A failure here fails the build. */
const GATED = [
  ["foreground", "background", "Body text on page background", 4.5],
  ["foreground", "card", "Body text on a card", 4.5],
  ["card-foreground", "card", "Card text on card", 4.5],
  ["popover-foreground", "popover", "Popover text", 4.5],
  ["muted-foreground", "background", "Muted text on page", 4.5],
  ["muted-foreground", "card", "Muted text on card", 4.5],
  ["primary-foreground", "primary-button", "Solid primary button label", 4.5],
  ["primary-foreground", "primary-button-hover", "Primary button label, hover", 4.5],
  ["secondary-foreground", "secondary", "Secondary button label", 4.5],
  ["accent-foreground", "accent", "Label on coral accent fill", 4.5],
  ["destructive-foreground", "destructive", "Destructive button label", 4.5],
  // Status fills are bright in BOTH themes, so text on them must use the
  // theme-invariant dark ink (--accent-foreground is #0F172A in light AND dark).
  // Using --foreground here is a dark-mode bug: it resolves to near-white.
  ["accent-foreground", "success", "Dark ink on success fill", 4.5],
  ["accent-foreground", "warning", "Dark ink on warning fill", 4.5],
  ["accent-foreground", "info", "Dark ink on info fill", 4.5],
  ["primary", "background", "Brand teal as icon/border/ring (non-text)", 3.0],
  ["primary", "card", "Brand teal icon on card (non-text)", 3.0],
  ["ring", "background", "Focus ring against page", 3.0],
  ["destructive", "card", "Danger icon on card (non-text)", 3.0],
  ["chart-1", "card", "Chart series 1 (non-text)", 3.0],
  ["chart-2", "card", "Chart series 2 (non-text)", 3.0],
  ["chart-3", "card", "Chart series 3 / amber ink (non-text)", 3.0],
  ["chart-4", "card", "Chart series 4 / sky ink (non-text)", 3.0],
  ["chart-5", "card", "Chart series 5 (non-text)", 3.0],
];

/**
 * Combinations that FAIL and are therefore BANNED by policy. Reported every run
 * so the ban stays visible, but excluded from the exit code: the fix is the
 * approved alternative, not a change to the brief's hexes.
 */
const BANNED = [
  [
    "primary-foreground",
    "primary",
    "White label on brand teal, normal text",
    4.5,
    "use --primary-button (bg-primary-button); --primary is for large/bold text, icons, borders, rings",
  ],
  [
    "warning",
    "card",
    "Warning colour as an icon/badge FOREGROUND on a light surface",
    3.0,
    "use --chart-3 (amber ink) as the foreground, or --warning as a FILL with --accent-foreground text",
  ],
  [
    "info",
    "card",
    "Info colour as an icon/badge FOREGROUND on a light surface",
    3.0,
    "use --chart-4 (sky ink) as the foreground, or --info as a FILL with --accent-foreground text",
  ],
  [
    "foreground",
    "warning",
    "Theme --foreground on a warning fill",
    4.5,
    "use --accent-foreground: --foreground is near-white in dark mode and drops to ~1.6:1",
  ],
];

const lines = [];
let totalFails = 0;

for (const theme of ["light", "dark"]) {
  const tokens = theme === "light" ? block(":root") : { ...block(":root"), ...block(".dark") };
  const row = (fg, bg, ctx, need, note) => {
    const a = hslToRgb(tokens[fg]),
      b = hslToRgb(tokens[bg]);
    if (!a || !b) throw new Error(`unparsed token in pair ${fg}/${bg} (${theme})`);
    const r = ratio(a, b);
    return { fg, bg, ctx, need, note, r, pass: r >= need, aHex: hex(a), bHex: hex(b) };
  };

  lines.push(`\n### ${theme === "light" ? "Light theme" : "Dark theme"}\n`);
  lines.push("| Foreground | Background | Context | Ratio | Needs | Verdict |");
  lines.push("|---|---|---|---|---|---|");
  for (const [fg, bg, ctx, need] of GATED) {
    const x = row(fg, bg, ctx, need);
    if (!x.pass) totalFails++;
    lines.push(
      `| \`--${fg}\` ${x.aHex} | \`--${bg}\` ${x.bHex} | ${ctx} | **${x.r.toFixed(2)}:1** | ${need}:1 | ${x.pass ? "PASS" : "**FAIL**"} |`,
    );
  }

  lines.push(`\n#### Banned combinations (${theme} theme)\n`);
  lines.push("| Combination | Context | Ratio | Needs | Use instead |");
  lines.push("|---|---|---|---|---|");
  for (const [fg, bg, ctx, need, note] of BANNED) {
    const x = row(fg, bg, ctx, need, note);
    lines.push(
      `| \`--${fg}\` on \`--${bg}\` | ${ctx} | **${x.r.toFixed(2)}:1** | ${need}:1 | ${note} |`,
    );
  }
}

console.log(lines.join("\n"));

if (totalFails > 0) {
  console.error(`\nFAIL: ${totalFails} gated pair(s) below threshold.`);
  process.exit(1);
}
console.error("\nPASS: every gated pair meets WCAG 2.1 AA in both themes.");
