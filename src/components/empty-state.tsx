import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Server Component (8.2.2, 8.2.13): a stateless icon/message/action block never needs
 * a client-side directive.
 */
export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

/**
 * `role="status"` (8.2.2) so that a table or list filtered down to zero rows announces
 * the change to assistive tech, not just visually swaps its content.
 */
export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      role="status"
      className={cn(
        "flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border px-6 py-12 text-center",
        className,
      )}
    >
      {Icon ? <Icon className="h-10 w-10 text-muted-foreground" aria-hidden="true" /> : null}
      <p className="font-display text-xl font-semibold leading-snug text-foreground">{title}</p>
      {description ? (
        <p className="max-w-sm text-sm leading-normal text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
