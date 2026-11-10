import Link from "next/link";
import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { siteContent } from "@/content/site";

/**
 * Server Component by default (no `"use client"`): every CTA here is a plain anchor
 * with no event handler, no client-side state and no browser API, so this section
 * ships with zero client JS. It owns the page's one and only `<h1>` (WCAG heading
 * order) and is the page's LCP element — headline, subhead and CTAs are plain text
 * with no hero `<img>` / `next/image` call, so there is nothing to preload and
 * nothing that can shift layout while an image decodes.
 *
 * The primary CTA uses `bg-primary-button`/`hover:bg-primary-button-hover` (C18): a
 * solid button with a normal-size label must NOT use `bg-primary`, which is 3.65:1
 * against white text and fails AA.
 */
export function HeroSection() {
  const { hero } = siteContent;

  return (
    <section aria-labelledby="hero-heading" className="py-16 sm:py-20 lg:py-24">
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
        <h1
          id="hero-heading"
          className="font-display text-3xl font-bold leading-snug tracking-tight text-foreground sm:text-4xl lg:text-5xl"
        >
          {hero.headline}
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-muted-foreground">{hero.subhead}</p>

        <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Button
            asChild
            size="lg"
            className="bg-primary-button text-primary-foreground hover:bg-primary-button-hover"
          >
            <Link href="/book">{hero.ctaLabel}</Link>
          </Button>
          {/* Targets ServicesSection's own `id="services"` anchor (components/services-section.tsx). */}
          <Button asChild variant="outline" size="lg">
            <Link href="#services">{hero.secondaryCtaLabel}</Link>
          </Button>
        </div>

        {/* A <ul>, not a bare row of <span>s, so assistive tech announces this as a
            list of N reassurances rather than a run-on sentence. The checkmark is
            purely decorative (the reassurance text itself conveys the meaning, never
            the icon alone), so it is `aria-hidden`. */}
        <ul className="mt-8 flex flex-col items-center gap-2 text-sm text-muted-foreground sm:flex-row sm:justify-center sm:gap-6">
          {hero.reassurance.map((item) => (
            <li key={item} className="flex items-center gap-2">
              <Check aria-hidden="true" className="h-4 w-4 shrink-0 text-primary" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
