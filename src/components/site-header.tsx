import Link from "next/link";
import { Menu } from "lucide-react";

import { AppLogo } from "@/components/app-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export interface SiteHeaderProps {
  /**
   * The current pathname, e.g. from `usePathname()` in the layout that
   * eventually renders this header (Phase 3's job, not this task). Left
   * `undefined`, no nav link is marked current — that is why this stays a
   * plain, prop-driven Server Component instead of reaching for a
   * client-only hook itself.
   */
  currentPath?: string;
  className?: string;
}

interface NavItem {
  href: string;
  label: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "الرئيسية" },
  { href: "/privacy", label: "الخصوصية" },
  { href: "/terms", label: "الشروط" },
];

const CTA_ITEM: NavItem = { href: "/book", label: "احجز موعداً" };

function PrimaryNavItems({ currentPath }: { currentPath: string | undefined }) {
  return (
    <>
      {NAV_ITEMS.map((item) => {
        const isCurrent = currentPath === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isCurrent ? "page" : undefined}
            className={cn(
              "text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
              isCurrent && "text-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
      {/*
       * The CTA is a solid-filled button at normal text size, so it must use
       * `bg-primary-button` / `hover:bg-primary-button-hover`, never
       * `bg-primary` — white text on `--primary` measures ~3.4:1 and fails
       * WCAG AA (C18). `className` wins the `tailwind-merge` conflict with
       * the default variant's `bg-primary hover:bg-primary/90`.
       */}
      <Button
        asChild
        className="bg-primary-button text-primary-foreground hover:bg-primary-button-hover"
      >
        <Link
          href={CTA_ITEM.href}
          aria-current={currentPath === CTA_ITEM.href ? "page" : undefined}
        >
          {CTA_ITEM.label}
        </Link>
      </Button>
    </>
  );
}

/**
 * Public site header: skip-to-content link, primary nav, theme toggle and
 * the booking CTA. Server Component — the mobile drawer (`Sheet`) and the
 * theme toggle are themselves Client Components, but composing them here
 * needs no hook of its own. Not wired into `src/app/layout.tsx` yet —
 * Phase 3 does that.
 */
export function SiteHeader({ currentPath, className }: SiteHeaderProps) {
  return (
    <header className={cn("sticky top-0 z-40 border-b border-border bg-background", className)}>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:shadow-lg"
      >
        انتقل إلى المحتوى
      </a>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <AppLogo />

        <nav aria-label="التنقل الرئيسي" className="hidden items-center gap-6 md:flex">
          <PrimaryNavItems currentPath={currentPath} />
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />

          <Sheet>
            <SheetTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="افتح القائمة"
                className="md:hidden"
              >
                <Menu aria-hidden="true" className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="right"
              /* inline-start in RTL */ className="flex w-72 flex-col gap-6"
            >
              <SheetTitle>القائمة</SheetTitle>
              <nav aria-label="التنقل الرئيسي" className="flex flex-col gap-4">
                <PrimaryNavItems currentPath={currentPath} />
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
