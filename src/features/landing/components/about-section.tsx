import { siteContent } from "@/content/site";

/**
 * Server Component (8.2.3, C15): the heading, body and doctor bios are static
 * copy read directly from `siteContent` at build time. There is no hook, no
 * event handler and no browser API anywhere in this file, so it ships with
 * zero client JS and stays a plain Server Component with no client-side
 * rendering opt-in.
 *
 * No doctor photographs: the repo has no image assets, and pointing
 * `next/image` at an invented remote URL would both violate the no-remote-
 * images rule and tank the Lighthouse/CLS budget (C23) for a landing page
 * that is supposed to ship near-zero JS. Each doctor instead gets a small
 * initials "avatar" built from a plain `<div>` + text (no network request,
 * no layout-shift risk). It is marked `aria-hidden` because the doctor's
 * full name is already adjacent, real text — the avatar would otherwise
 * read as duplicate/confusing content to assistive tech.
 */

const NAME_TITLE_PREFIXES = new Set([
  "dr",
  "dr.",
  "prof",
  "prof.",
  "mr",
  "mr.",
  "mrs",
  "mrs.",
  "ms",
  "ms.",
]);

/** "Dr. Amelie Hoffmann" -> "AH". Falls back to the name's first letter if, after
 * stripping titles, nothing is left to initialize (defensive; never hit by the
 * current content). */
function getInitials(fullName: string): string {
  const nameWords = fullName
    .split(/\s+/)
    .filter((word) => word.length > 0 && !NAME_TITLE_PREFIXES.has(word.toLowerCase()));

  const initials = nameWords
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");

  return initials.length > 0 ? initials : fullName.charAt(0).toUpperCase();
}

export function AboutSection() {
  const { heading, body, doctors } = siteContent.about;

  return (
    <section id="about" aria-labelledby="about-heading" className="py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <h2
            id="about-heading"
            className="font-display text-2xl font-bold leading-snug text-foreground md:text-3xl"
          >
            {heading}
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">{body}</p>
        </div>

        {/* A <ul>, not a bare grid of <div>s, so assistive tech announces this as a
         * list of N doctors rather than an undifferentiated block of text. */}
        <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {doctors.map((doctor) => (
            <li key={doctor.name}>
              <div className="shadow-soft-sm flex h-full flex-col gap-4 rounded-2xl border border-border bg-card p-6">
                <div
                  aria-hidden="true"
                  className="flex h-16 w-16 items-center justify-center rounded-full bg-primary"
                >
                  {/*
                   * text-xl + font-bold (20px/700) clears C18's "large/bold text"
                   * threshold (>=18.66px bold), so --primary (3.4:1 against white
                   * text) is the correct token here per the contrast audit —
                   * --primary-button (reserved for solid, normal-size CTA labels)
                   * would be the wrong choice for a decorative, large-text badge
                   * like this one.
                   */}
                  <span className="font-display text-xl font-bold text-primary-foreground">
                    {getInitials(doctor.name)}
                  </span>
                </div>

                <div>
                  <h3 className="font-display text-xl font-semibold leading-snug text-foreground">
                    {doctor.name}
                  </h3>
                  <p className="text-sm font-medium text-muted-foreground">{doctor.role}</p>
                  <p className="text-sm leading-normal text-muted-foreground">
                    {doctor.credentials}
                  </p>
                </div>

                <p className="text-base leading-relaxed text-foreground">{doctor.bio}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
