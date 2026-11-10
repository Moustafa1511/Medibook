import Link from "next/link";

import { siteContent } from "@/content/site";
import { cn } from "@/lib/utils";

export interface AppLogoProps {
  /** Where the wordmark links to. Defaults to the public home page. */
  href?: string;
  /** Hide the clinic name and show the mark alone (e.g. in a tight mobile bar). */
  markOnly?: boolean;
  className?: string;
}

/**
 * The clinic mark plus its name.
 *
 * The mark is an inline SVG — no `<img>`, so no network request — and uses
 * `currentColor`, so it follows the caller's text colour and therefore the
 * light/dark theme without its own colour-mode logic.
 *
 * The NAME is real HTML text, not SVG `<text>`. Two reasons: Arabic needs
 * proper glyph shaping and a real font stack (an SVG text node in a fixed
 * viewBox cannot size or wrap it), and keeping the name in HTML leaves the link
 * with exactly ONE accessible name. The previous version set aria-label AND an
 * SVG <title> AND drew the name as SVG text, so the whole thing was announced
 * twice: "MediBookMediBook".
 *
 * Server Component: no hook, event handler or browser API.
 */
export function AppLogo({ href = "/", markOnly = false, className }: AppLogoProps) {
  return (
    <Link
      href={href}
      className={cn("inline-flex items-center gap-2 text-foreground", className)}
      aria-label={markOnly ? siteContent.clinicName : undefined}
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="size-7 shrink-0"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect x="0" y="0" width="24" height="24" rx="7" fill="currentColor" />
        <path
          d="M12 6.5v11M6.5 12h11"
          stroke="hsl(var(--background))"
          strokeWidth="2.25"
          strokeLinecap="round"
        />
      </svg>
      {!markOnly && (
        <span className="truncate font-display text-lg font-bold">{siteContent.clinicName}</span>
      )}
    </Link>
  );
}
