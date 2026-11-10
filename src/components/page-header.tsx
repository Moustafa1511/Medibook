import type { ReactNode } from "react";

/**
 * Server Component (8.2.2, 8.2.13): a title/description/actions header is pure layout
 * with no state of its own, so it never needs a client-side directive.
 */
export interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}

/**
 * One `<h1>` per route (8.2.2): every page composes its heading through this component
 * so heading order stays consistent across the whole app rather than being re-decided
 * per page.
 */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-2">
        <h1 className="font-display text-3xl font-bold leading-tight tracking-tight text-foreground md:text-4xl">
          {title}
        </h1>
        {description ? (
          <p className="text-base leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
