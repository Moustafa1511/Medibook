import { siteContent } from "@/content/site";

/**
 * Server Component (8.2.3, C15): the three steps are fixed, static content
 * read directly from `siteContent` — nothing here reads state, listens for an
 * event, or touches a browser API, so this stays a plain Server Component
 * with no client-side rendering opt-in.
 */
export function HowItWorksSection() {
  const { heading, steps } = siteContent.howItWorks;

  return (
    <section
      id="how-it-works"
      aria-labelledby="how-it-works-heading"
      className="bg-muted/40 py-16 md:py-24"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <h2
          id="how-it-works-heading"
          className="font-display text-2xl font-bold leading-snug text-foreground md:text-3xl"
        >
          {heading}
        </h2>

        {/*
         * A native <ol>, not a visually-numbered <div> grid (C18, Section 8.1):
         * the sequence is semantic ("step 1 of 3", "2 of 3", "3 of 3" announced
         * by assistive tech), not just a visual numeral. The circular number
         * badge inside each item is purely decorative restatement of the
         * position the <ol> already conveys, so it is `aria-hidden` — without
         * that, a screen reader would announce the step's ordinal twice.
         */}
        <ol className="mt-12 grid gap-6 sm:grid-cols-3">
          {steps.map((step, index) => (
            <li
              key={step.title}
              className="shadow-soft-sm flex flex-col gap-4 rounded-2xl border border-border bg-card p-6"
            >
              {/*
               * text-xl + font-bold (20px/700) clears C18's "large/bold text"
               * threshold (>=18.66px bold), so --primary (3.4:1 against white
               * text) is the correct token for this decorative fill — not
               * --primary-button, which is reserved for solid, normal-size CTA
               * labels.
               */}
              <span
                aria-hidden="true"
                className="flex h-12 w-12 items-center justify-center rounded-full bg-primary font-display text-xl font-bold text-primary-foreground"
              >
                {index + 1}
              </span>
              <h3 className="font-display text-xl font-semibold leading-snug text-foreground">
                {step.title}
              </h3>
              <p className="text-base leading-relaxed text-muted-foreground">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
