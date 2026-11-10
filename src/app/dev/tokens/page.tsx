import { notFound } from "next/navigation";

import { MoneyDisplay } from "@/components/money-display";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { APPOINTMENT_STATUS_VALUES } from "@/lib/enums";
import { isProduction } from "@/lib/env";

// Excluded from production: the route renders a 404 there, so the style guide is
// a development tool and never part of the shipped surface.
export const metadata = { robots: { index: false, follow: false } };

/** Every canonical colour token, grouped as Section 8.3.1 groups them. */
const TOKEN_GROUPS: ReadonlyArray<{ group: string; tokens: readonly string[] }> = [
  {
    group: "الأسطح",
    tokens: [
      "background",
      "foreground",
      "card",
      "card-foreground",
      "popover",
      "popover-foreground",
    ],
  },
  {
    group: "العلامة",
    tokens: [
      "primary",
      "primary-foreground",
      "primary-button",
      "primary-button-hover",
      "secondary",
      "secondary-foreground",
      "accent",
      "accent-foreground",
    ],
  },
  { group: "الحياد", tokens: ["muted", "muted-foreground", "border", "input", "ring"] },
  {
    group: "الحالة",
    tokens: ["destructive", "destructive-foreground", "success", "warning", "info"],
  },
  { group: "الرسوم البيانية", tokens: ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5"] },
];

function Swatch({ token }: { token: string }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="size-10 shrink-0 rounded-xl border border-border"
        style={{ backgroundColor: `hsl(var(--${token}))` }}
      />
      <code className="text-xs text-muted-foreground">--{token}</code>
    </div>
  );
}

export default function TokensPage() {
  if (isProduction) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-5xl space-y-8">
        <PageHeader
          title="رموز التصميم"
          description='دليل أنماط لأغراض التطوير فقط. بدّل class="dark" على <html> لمعاينة النسقين.'
        />

        {TOKEN_GROUPS.map(({ group, tokens }) => (
          <Card key={group}>
            <CardHeader>
              <CardTitle>{group}</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {tokens.map((token) => (
                <Swatch key={token} token={token} />
              ))}
            </CardContent>
          </Card>
        ))}

        <Card>
          <CardHeader>
            <CardTitle>الأزرار</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-4">
            {/* Solid primary uses bg-primary-button, not bg-primary: white on
                --primary is 3.65:1 and fails AA for normal-size labels. */}
            <Button className="bg-primary-button text-primary-foreground hover:bg-primary-button-hover">
              احجز موعدًا
            </Button>
            <Button variant="secondary">ثانوي</Button>
            <Button variant="outline">إطار</Button>
            <Button variant="ghost">شبح</Button>
            <Button variant="destructive">إلغاء</Button>
            <Button disabled>معطّل</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>حالة الموعد</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-4">
            {APPOINTMENT_STATUS_VALUES.map((status) => (
              <StatusBadge key={status} status={status} />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>الخطوط والمبالغ المالية</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <h1 className="font-display text-4xl font-bold">عرض / h1</h1>
            <h2 className="font-display text-2xl font-semibold">عرض / h2</h2>
            <p className="text-base">نص أساسي بخط Cairo بحجم 16px.</p>
            <p className="text-sm text-muted-foreground">نص ثانوي خافت.</p>
            <p className="text-lg">
              <MoneyDisplay minor={5000} currency="EGP" />
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
