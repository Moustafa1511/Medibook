import {
  CalendarCheck2,
  CheckCircle2,
  Clock3,
  UserX,
  XCircle,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { AppointmentStatus } from "@/lib/enums";
import { cn } from "@/lib/utils";

export interface StatusBadgeProps {
  status: AppointmentStatus;
  className?: string;
}

interface StatusVisual {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly iconClassName: string;
  readonly tintClassName: string;
}

/**
 * Status -> icon + label + color map (8.3.7). Typed as a `satisfies` mapped-type Record
 * over the `AppointmentStatus` union, so a sixth status added to `src/lib/enums.ts` makes
 * this object fail to type-check instead of silently rendering with no visual for it.
 *
 * The badge's text label always renders in `text-foreground`, never a status color: color
 * is carried by the icon alone (8.3.4 contrast audit — every `StatusBadge` label uses
 * `text-foreground` so the raw status hexes, several of which fail WCAG as text, never
 * have to be used as text). The human-readable label is the required second, non-color
 * channel (C4, WCAG 1.4.1 Use of Color).
 */
const STATUS_VISUALS = {
  PENDING_VERIFICATION: {
    icon: Clock3,
    label: "بانتظار التأكيد",
    // chart-3 resolves to warning-ink (#B45309, 5.0:1 on white) in light mode and to the
    // brightened dark --warning value in dark mode — the brief's raw --warning (#F59E0B)
    // fails even the 3:1 non-text floor and is reserved for large tints only (8.3.4).
    iconClassName: "text-chart-3",
    tintClassName: "bg-warning/10",
  },
  CONFIRMED: {
    icon: CalendarCheck2,
    label: "مؤكد",
    // Same pattern: chart-4 resolves to info-ink (#0369A1) in light mode and the
    // brightened dark --info value in dark mode (8.3.4).
    iconClassName: "text-chart-4",
    tintClassName: "bg-info/10",
  },
  COMPLETED: {
    icon: CheckCircle2,
    label: "تم",
    // --success already clears 3:1 as an icon color in both themes — no ink shade needed.
    iconClassName: "text-success",
    tintClassName: "bg-success/10",
  },
  CANCELLED: {
    icon: XCircle,
    label: "ملغي",
    iconClassName: "text-destructive",
    tintClassName: "bg-destructive/10",
  },
  NO_SHOW: {
    icon: UserX,
    label: "لم يحضر",
    // Reuses the neutral gray rather than inventing a fifth hue (8.3.7); told apart from
    // CANCELLED by icon and label, never by color alone.
    iconClassName: "text-muted-foreground",
    tintClassName: "bg-muted",
  },
} satisfies { [K in AppointmentStatus]: StatusVisual };

/**
 * `AppointmentStatus` -> color + icon + text (C4, WCAG 1.4.1): status is never conveyed by
 * color alone. Server Component: a pure, stateless map over `ui/badge`, no state or
 * browser API involved.
 */
export function StatusBadge({ status, className }: StatusBadgeProps) {
  const visual = STATUS_VISUALS[status];
  const Icon = visual.icon;

  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5 border-transparent text-foreground", visual.tintClassName, className)}
    >
      <Icon className={cn("h-3.5 w-3.5", visual.iconClassName)} aria-hidden="true" />
      {visual.label}
    </Badge>
  );
}
