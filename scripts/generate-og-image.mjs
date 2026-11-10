/**
 * Renders the Open Graph card to a static PNG using headless Chrome.
 *
 * Why not Next's ImageResponse: that uses satori, whose text shaper does not
 * implement the contextual OpenType substitutions (GSUB lookupType 5,
 * substFormat 3) that Arabic requires — it fails the build outright, and even
 * with an Arabic font supplied it cannot join letters correctly. Chrome shapes
 * Arabic properly, so we pre-render once and commit the result. The PNG is a
 * build-time artifact with zero runtime cost.
 *
 * Re-run after changing the clinic name or hero headline:
 *   node scripts/generate-og-image.mjs
 */
import { writeFileSync } from "node:fs";

import { chromium } from "@playwright/test";

const CLINIC = process.argv[2] ?? "عيادة ميديبوك - المنصورة";
const HEADLINE = process.argv[3] ?? "رعاية طبية تناسب مواعيدك";
const SUB = process.argv[4] ?? "احجز موعدك في المنصورة في أقل من دقيقة";

const html = `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&family=Tajawal:wght@700&display=swap" rel="stylesheet">
<style>
  html,body{margin:0;padding:0}
  body{width:1200px;height:630px;background:#FBF8F2;color:#0F172A;
       font-family:'Cairo',system-ui,sans-serif;display:flex;flex-direction:column;
       justify-content:center;padding:80px;box-sizing:border-box}
  .row{display:flex;align-items:center;gap:20px}
  .mark{width:56px;height:56px;border-radius:16px;background:#0F766E;color:#fff;
        display:flex;align-items:center;justify-content:center;font-size:40px;line-height:1}
  .clinic{font-size:34px;color:#475569}
  h1{font-family:'Tajawal','Cairo',sans-serif;font-size:68px;font-weight:700;
     margin:40px 0 0;line-height:1.2}
  p{font-size:32px;color:#475569;margin:24px 0 0}
</style></head>
<body>
  <div class="row"><div class="mark">+</div><div class="clinic">${CLINIC}</div></div>
  <h1>${HEADLINE}</h1>
  <p>${SUB}</p>
</body></html>`;

const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
const png = await page.screenshot({ type: "png" });
await browser.close();

writeFileSync("src/app/opengraph-image.png", png);
writeFileSync("src/app/opengraph-image.alt.txt", `${CLINIC} — احجز موعدك عبر الإنترنت\n`);
console.log(`wrote src/app/opengraph-image.png (${Math.round(png.length / 1024)} KB)`);
