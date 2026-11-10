import type { Metadata } from "next";

import { SiteHeader } from "@/components/site-header";
import { BookingWizard } from "@/features/booking/components/booking-wizard";
import { getBookableServices } from "@/features/booking/queries";

export const metadata: Metadata = {
  alternates: { canonical: "/book" },
  title: "احجز موعدًا",
  description: "اختر الخدمة والوقت المناسب لك، وأكّد حجزك برسالة نصية.",
};

// Availability is per-request by definition, so this page is never static.
export const dynamic = "force-dynamic";

export default async function BookPage() {
  const services = await getBookableServices();

  return (
    <>
      <SiteHeader currentPath="/book" />
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14"
      >
        <h1 className="font-display text-3xl font-bold sm:text-4xl">احجز موعدًا</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          اختر الخدمة والوقت المناسب لك. سنرسل لك رسالة نصية بكود لتأكيد رقم هاتفك، وستحصل على رقم
          مرجعي للحجز فورًا.
        </p>

        <div className="mt-10">
          <BookingWizard services={services} />
        </div>
      </main>
    </>
  );
}
