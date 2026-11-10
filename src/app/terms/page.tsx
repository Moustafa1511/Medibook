import type { Metadata } from "next";
import type { ReactNode } from "react";

import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { SiteFooter, type SiteFooterContent } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { siteContent } from "@/content/site";

/**
 * Static legal page: SSG at build, no runtime data fetching (Section 2.3's
 * rendering-strategy table lists `/terms` as "no DB read", same as
 * `/privacy`). Plain Server Component — nothing here needs state, an effect,
 * or a browser API, so no `"use client"` directive.
 */
export const revalidate = false;

export const metadata: Metadata = {
  alternates: { canonical: "/terms" },
  title: `الشروط والأحكام | ${siteContent.clinicName}`,
  description: `شروط الحجز والإلغاء والتخلف عن الحضور للمواعيد في ${siteContent.clinicName}.`,
};

// Hand-written, not derived from a build timestamp, so the page stays a pure,
// deterministic function of its (lack of) props/data for tests and SSG.
const LAST_UPDATED = "6 أكتوبر 2026";

// `/terms` reuses `SiteFooter` (8.1.2, T2.8) but, per the rendering-strategy
// table above, takes no `WorkingHour`/DB read of its own, so its hours list is
// deliberately empty here — only the landing page resolves real opening hours.
const [, ...ADDRESS_REST] = siteContent.contact.addressLines;
const FOOTER_CONTENT: SiteFooterContent = {
  clinicName: siteContent.clinicName,
  phoneDisplay: siteContent.contact.phoneDisplay,
  phoneHref: `tel:${siteContent.contact.phoneE164}`,
  email: siteContent.contact.email,
  addressLine1: ADDRESS_REST[0] ?? "",
  addressLine2: ADDRESS_REST.slice(1).filter(Boolean).join(", "),
  hours: [],
  legalLinks: [
    { href: "/privacy", label: "الخصوصية" },
    { href: "/terms", label: "الشروط" },
  ],
};

interface LegalSectionProps {
  id: string;
  heading: string;
  children: ReactNode;
}

/**
 * One named landmark per topic (WCAG 2.1 AA): `aria-labelledby` gives the
 * `<section>` its accessible name from the same `<h2>` a sighted reader sees,
 * and every heading on this page sits at this one level under the page's
 * single `<h1>` (`PageHeader`), so heading order never skips a level.
 */
function LegalSection({ id, heading, children }: LegalSectionProps) {
  return (
    <section aria-labelledby={id} className="space-y-4">
      <h2
        id={id}
        className="font-display text-2xl font-bold leading-snug text-foreground md:text-3xl"
      >
        {heading}
      </h2>
      <div className="space-y-4 text-base leading-relaxed text-foreground">{children}</div>
    </section>
  );
}

export default function TermsPage() {
  const { contact } = siteContent;

  return (
    <>
      <SiteHeader currentPath="/terms" />
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8"
      >
        <PageHeader title="الشروط والأحكام" description={`آخر تحديث: ${LAST_UPDATED}`} />

        <div className="mt-8 max-w-[72ch] space-y-10">
          <div className="rounded-2xl border border-border bg-muted p-6 text-sm leading-relaxed text-foreground">
            <p>
              <strong className="font-semibold">هذا نموذج مبدئي.</strong> كُتب بلغة واضحة ليصف
              فعليًا كيف يعمل الحجز هنا، ولم يُراجع كنص قانوني معتمد. يجب على العيادة أن تعرضه على
              محامٍ قبل الاعتماد عليه في الإطلاق الفعلي.
            </p>
          </div>

          <LegalSection id="terms-booking-heading" heading="حجز موعد">
            <p>
              لا تحتاج إلى حساب للحجز. اختر الخدمة، ثم التاريخ والوقت من المواعيد المتاحة فعليًا،
              وأدخل اسمك ورقم هاتفك المحمول. نرسل لك كودًا من ستة أرقام برسالة نصية للتأكد من أن
              الرقم يخصّك بالفعل؛ وبعد إدخاله، يُؤكَّد الموعد وتحصل على رقم مرجعي للحجز وملف تقويم
              لحفظه لديك.
            </p>
          </LegalSection>

          <LegalSection id="terms-emergency-heading" heading="ليست خدمة للحالات الطارئة">
            <p>
              هذا الموقع أداة لجدولة المواعيد، وليس خدمة إسعاف أو رعاية عاجلة، ولا يراجع أحد الحجز
              قبل وقت موعدك. إذا كانت لديك حالة طبية طارئة، فاتصل فورًا برقم الإسعاف 123 بدلًا من
              الحجز عبر الإنترنت. {contact.hoursNote}
            </p>
          </LegalSection>

          <LegalSection id="terms-prices-heading" heading="الأسعار">
            <p>
              السعر الظاهر وقت الحجز هو سعر ذلك الموعد المحدد. وإذا تبيّن أثناء الكشف أن الطبيب
              يحتاج إلى إجراء مختلف أو أطول مما حجزته، فسنخبرك بالسعر الجديد ونأخذ موافقتك قبل
              القيام بأي شيء يتجاوز الموعد الأصلي.
            </p>
          </LegalSection>

          <LegalSection
            id="terms-cancellation-heading"
            heading="الإلغاء وإعادة الحجز والتخلف عن الحضور"
          >
            <p>
              قد تتغيّر خططك، ولا بأس في ذلك — اتصل بالعيادة في أقرب وقت ممكن إذا احتجت إلى إلغاء
              موعدك أو تغيير وقته. لا توجد أي رسوم على الإلغاء، ونحن نُفضّل دائمًا أن نعرف ذلك بدلًا
              من ترك الموعد شاغرًا. وإذا كنت متأخرًا، اتصل بنا أيضًا؛ فغالبًا ما يمكننا استقبالك،
              لكن قد نحتاج إلى تقصير مدة الموعد أو نقلك إلى أقرب وقت متاح.
            </p>
            <p>
              لا نفرض حاليًا رسومًا على التخلف عن الحضور، لكن الموعد الذي لا تحضره ولا تخبرنا به هو
              وقت لا يمكننا تقديمه لمريض آخر، فإذا تكرر غيابك دون إخبارنا مسبقًا، فقد نطلب منك
              الاتصال بالعيادة قبل الحجز مرة أخرى.
            </p>
          </LegalSection>

          <LegalSection id="terms-your-information-heading" heading="بياناتك">
            <p>
              حجز موعد يعني تزويدنا باسمك الحقيقي ورقم هاتف يمكن التواصل معك عليه فعليًا، لأننا
              نعتمد عليهما لتنظيم جدول العيادة والتواصل معك في حال تغيّر أي شيء. لمعرفة كيف نخزّن
              هذه المعلومات ونستخدمها ونحذفها في النهاية، راجع{" "}
              <Link href="/privacy" className="underline hover:text-muted-foreground">
                سياسة الخصوصية
              </Link>
              .
            </p>
          </LegalSection>

          <LegalSection id="terms-changes-heading" heading="تعديلات على هذه الشروط">
            <p>
              قد نُحدّث هذه الشروط من وقت لآخر مع تطوّر الخدمة. يُظهر التاريخ الموجود في أعلى هذه
              الصفحة آخر مرة تمت فيها مراجعتها.
            </p>
          </LegalSection>
        </div>
      </main>
      <SiteFooter content={FOOTER_CONTENT} />
    </>
  );
}
