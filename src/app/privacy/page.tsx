import type { Metadata } from "next";
import type { ReactNode } from "react";

import { PageHeader } from "@/components/page-header";
import { SiteFooter, type SiteFooterContent } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { siteContent } from "@/content/site";

/**
 * Static legal page: SSG at build, no runtime data fetching (Section 2.3's
 * rendering-strategy table lists `/privacy` as "no DB read", unlike `/` which
 * reads `Service` rows at build time). Plain Server Component — nothing here
 * needs state, an effect, or a browser API, so no `"use client"` directive.
 */
export const revalidate = false;

export const metadata: Metadata = {
  alternates: { canonical: "/privacy" },
  title: `سياسة الخصوصية | ${siteContent.clinicName}`,
  description: `كيف تجمع ${siteContent.clinicName} بيانات المرضى وتخزّنها وتحذفها، ومن تتواصل معه بخصوص بياناتك.`,
};

// Hand-written, not derived from a build timestamp, so the page stays a pure,
// deterministic function of its (lack of) props/data for tests and SSG.
const LAST_UPDATED = "6 أكتوبر 2026";

// `/privacy` reuses `SiteFooter` (8.1.2, T2.8) but, per the rendering-strategy
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

export default function PrivacyPage() {
  const { contact, legal } = siteContent;

  return (
    <>
      <SiteHeader currentPath="/privacy" />
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8"
      >
        <PageHeader title="سياسة الخصوصية" description={`آخر تحديث: ${LAST_UPDATED}`} />

        <div className="mt-8 max-w-[72ch] space-y-10">
          <div className="rounded-2xl border border-border bg-muted p-6 text-sm leading-relaxed text-foreground">
            <p>
              <strong className="font-semibold">هذا نموذج مبدئي.</strong> كُتب بلغة واضحة ليصف
              فعليًا ما يفعله نظام الحجز هذا ببياناتك. لم يراجعه أو يصغه محامٍ متخصص، ويجب على
              العيادة أن تعرضه على محامٍ قبل الاعتماد عليه في الإطلاق الفعلي.
            </p>
          </div>

          <LegalSection id="privacy-collect-heading" heading="ما هي المعلومات التي نجمعها">
            <p>
              عندما تحجز موعدًا عبر هذا الموقع، نطلب منك اسمك الكامل ورقم هاتفك المحمول فقط. هذا كل
              ما نحتاجه: لا نطلب عنوان بريد إلكتروني، ولا عنوان منزلك، ولا أي تفاصيل عن تاريخك الطبي
              أو أعراضك، ولا نحتفظ بأي سجلات طبية مطلقًا.
            </p>
            <p>
              نستخدم اسمك ورقم هاتفك فقط لتحديد حجزك، وتأكيد وقت الموعد برسالة نصية، والتواصل معك
              إذا تغيّر أي شيء. يمكن لموظفي العيادة إضافة ملاحظة داخلية قصيرة على الموعد، مثل "اتصل
              المريض للتأكيد هاتفيًا". هذه الملاحظة لتنظيم المواعيد فقط، ولا تُعرض عليك مطلقًا، ويجب
              ألا تُستخدم أبدًا لتسجيل معلومات سريرية أو طبية.
            </p>
          </LegalSection>

          <LegalSection id="privacy-verification-heading" heading="كيف نتحقق من رقم هاتفك">
            <p>
              قبل تأكيد أي موعد، نرسل إلى هاتفك كودًا من ستة أرقام برسالة نصية ونطلب منك إدخاله. هذا
              يؤكد أن الرقم يخصّك بالفعل، حتى لا يُحجز موعد لرقم لا يمكننا التواصل معه فعلًا.
            </p>
            <p>
              يُشارَك رقم هاتفك مع شركة خارجية واحدة فقط: مزوّد خدمة الرسائل النصية (SMS)، الذي
              يُستخدم فقط لإرسال كود التحقق ورسالة تأكيد موعدك. لا نُسلّم اسمك أو رقم هاتفك لأي جهة
              أخرى، ولا نبيع أو نؤجّر معلوماتك مطلقًا لأغراض تسويقية أو لأي غرض آخر.
            </p>
          </LegalSection>

          <LegalSection id="privacy-retention-heading" heading="إلى متى نحتفظ بمعلوماتك">
            <p>لا نحتفظ بمعلومات المرضى إلى الأبد.</p>
            <ul className="list-disc space-y-2 ps-6">
              <li>
                بعد مرور أكثر من {legal.retentionMonths} شهرًا على انعقاد الموعد، نحذف الاسم ورقم
                الهاتف من ذلك السجل تلقائيًا. نحتفظ بالموعد نفسه — الخدمة المحجوزة وتاريخها وسعرها —
                في السجلات لتبقى السجلات المالية وسجلات الحجز الخاصة بالعيادة كاملة، لكن لا يمكن
                ربطها بك بعد ذلك.
              </li>
              <li>
                إذا لم يكن لديك أي موعد معنا خلال {legal.retentionMonths} شهرًا، نحذف سجلك كمريض
                بالكامل.
              </li>
              <li>
                يُحذف كود التحقق المؤقت الذي نرسله لك خلال 24 ساعة من استخدامه، أو خلال 24 ساعة من
                انتهاء صلاحيته دون استخدام، أيهما أسبق.
              </li>
            </ul>
          </LegalSection>

          <LegalSection
            id="privacy-cookies-heading"
            heading="ملفات تعريف الارتباط (الكوكيز) والتتبع"
          >
            <p>
              إذا كنت تحجز موعدًا أو تتصفح هذا الموقع كمريض، فلا نضع أي كوكيز على جهازك، ولا نُشغّل
              أي أدوات تحليلات أو تتبّع إعلاني على هذا الموقع. لهذا السبب لا نعرض شريط إشعار
              بالكوكيز. الكوكي الوحيد الذي يستخدمه هذا الموقع على الإطلاق هو كوكي تسجيل دخول لموظفي
              العيادة عند الدخول إلى لوحة التحكم، ولا يُستخدم أبدًا لأي شخص آخر.
            </p>
          </LegalSection>

          <LegalSection id="privacy-rights-heading" heading="حقوقك في بياناتك">
            <p>
              يمكنك في أي وقت أن تسألنا عن المعلومات التي نحتفظ بها عنك، أو تطلب تصحيحها، أو تطلب
              حذفها. أسرع طريقة هي الاتصال بالعيادة على{" "}
              <a
                href={`tel:${contact.phoneE164}`}
                className="underline hover:text-muted-foreground"
              >
                {contact.phoneDisplay}
              </a>{" "}
              أو إرسال بريد إلكتروني إلى{" "}
              <a href={`mailto:${contact.email}`} className="underline hover:text-muted-foreground">
                {contact.email}
              </a>{" "}
              مع ذكر اسمك ورقم هاتفك حتى نتمكن من إيجاد سجلك. نُنفّذ طلبات الوصول والحذف مباشرة
              بدلًا من استخدام نموذج إلكتروني.
            </p>
          </LegalSection>

          <LegalSection id="privacy-controller-heading" heading="من المسؤول عن بياناتك">
            <p>الجهة المتحكمة في المعلومات الموصوفة في هذه السياسة هي {legal.dataController}.</p>
          </LegalSection>
        </div>
      </main>
      <SiteFooter content={FOOTER_CONTENT} />
    </>
  );
}
