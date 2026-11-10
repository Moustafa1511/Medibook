import type { Metadata } from "next";
import { Cairo, Tajawal } from "next/font/google";

import { ThemeProvider } from "@/components/theme-provider";
import { siteContent } from "@/content/site";
import { env } from "@/lib/env";
import { HTML_DIR, HTML_LANG } from "@/lib/locale";

import "./globals.css";

// Self-hosted by next/font at build time: no runtime request to
// fonts.googleapis.com, which keeps the landing page fast and leaks no visitor
// IP to a third party (C18).
const fontSans = Cairo({
  // Arabic first: Inter and Plus Jakarta Sans carry no Arabic glyphs at all, so
  // keeping them would silently fall back to a system font for every word on
  // the site. Cairo and Tajawal both cover Arabic and Latin.
  subsets: ["arabic", "latin"],
  display: "swap",
  variable: "--font-sans",
});

const fontDisplay = Tajawal({
  subsets: ["arabic", "latin"],
  display: "swap",
  weight: ["500", "700", "800"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  metadataBase: new URL(env.NEXT_PUBLIC_SITE_URL),
  title: {
    default: `${siteContent.clinicName} — book an appointment online`,
    template: `%s — ${siteContent.clinicName}`,
  },
  description:
    "Book an appointment with our clinic in under a minute. Choose a service, pick a time that suits you, and confirm by SMS. No account needed.",
  applicationName: siteContent.clinicName,
  openGraph: {
    type: "website",
    siteName: siteContent.clinicName,
    locale: "en_GB",
    url: "/",
    title: `${siteContent.clinicName} — book an appointment online`,
    description:
      "Choose a service, pick a time, confirm by SMS. Appointment booking for our clinic in central Berlin.",
  },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
  // No canonical here on purpose: metadata is inherited, so a root-level
  // canonical would make every page claim "/" as its canonical URL. Each page
  // declares its own below.
  formatDetection: { telephone: true, address: false, email: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang={HTML_LANG}
      dir={HTML_DIR}
      suppressHydrationWarning
      className={`${fontSans.variable} ${fontDisplay.variable}`}
    >
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
