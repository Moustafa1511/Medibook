import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BookingWizard } from "@/features/booking/components/booking-wizard";
import type { BookableService } from "@/features/booking/types";

// The server actions are mocked: these are component tests, so they must not
// reach the database.
const getMonthAvailability = vi.hoisted(() => vi.fn());
const getDaySlots = vi.hoisted(() => vi.fn());

vi.mock("@/features/booking/actions", () => ({ getMonthAvailability, getDaySlots }));

const SERVICES: BookableService[] = [
  {
    id: "svc_consult",
    slug: "general-consultation",
    name: "استشارة عامة",
    description: "موعد استشارة قياسي.",
    durationMin: 30,
    priceMinor: 30000,
    currency: "EGP",
  },
  {
    id: "svc_vaccine",
    slug: "vaccination",
    name: "تطعيم",
    description: "تطعيم دوري أو للسفر.",
    durationMin: 15,
    priceMinor: 20000,
    currency: "EGP",
  },
];

/** A month where one day is open and one is fully booked. */
function monthFixture() {
  return {
    ok: true as const,
    data: {
      days: [
        { dateLocal: "2026-10-07", available: true as const },
        { dateLocal: "2026-10-13", available: false as const, reason: "FULLY_BOOKED" as const },
      ],
    },
  };
}

function slotsFixture() {
  return {
    ok: true as const,
    data: {
      timeZone: "Europe/Berlin",
      slots: [
        { startUtcIso: "2026-10-07T07:00:00.000Z", displayLocal: "09:00" },
        { startUtcIso: "2026-10-07T11:00:00.000Z", displayLocal: "13:00" },
        { startUtcIso: "2026-10-07T15:00:00.000Z", displayLocal: "17:00" },
      ],
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  window.sessionStorage.clear();
  getMonthAvailability.mockResolvedValue(monthFixture());
  getDaySlots.mockResolvedValue(slotsFixture());
});

describe("BookingWizard", () => {
  it("starts on the service step and lists every service with its price", () => {
    render(<BookingWizard services={SERVICES} />);

    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("اختر الخدمة");
    expect(screen.getByRole("button", { name: /استشارة عامة/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /تطعيم/ })).toBeInTheDocument();
    // Intl surrounds Arabic currency output with invisible RTL marks, so assert
    // on the parts rather than an exact string.
    const price = screen.getByText(/300(\.00)?/);
    expect(price).toBeInTheDocument();
    expect(price.textContent).toMatch(/ج\.م\./);
  });

  it("advances to the date step once a service is chosen, and queries that service", async () => {
    const user = userEvent.setup();
    render(<BookingWizard services={SERVICES} />);

    await user.click(screen.getByRole("button", { name: /استشارة عامة/ }));

    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("اختر التاريخ");
    await waitFor(() =>
      expect(getMonthAvailability).toHaveBeenCalledWith(
        expect.objectContaining({ serviceId: "svc_consult" }),
      ),
    );
  });

  it("keeps the chosen service when navigating back", async () => {
    const user = userEvent.setup();
    render(<BookingWizard services={SERVICES} />);

    await user.click(screen.getByRole("button", { name: /استشارة عامة/ }));
    await user.click(screen.getByRole("button", { name: /رجوع/ }));

    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("اختر الخدمة");
    // Still selected, and the selection is exposed, not just styled.
    expect(screen.getByRole("button", { name: /استشارة عامة/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("explains why days are unavailable rather than silently greying them out", async () => {
    const user = userEvent.setup();
    render(<BookingWizard services={SERVICES} />);

    await user.click(screen.getByRole("button", { name: /استشارة عامة/ }));

    await waitFor(() => expect(screen.getByText(/مكتمل الحجز/)).toBeInTheDocument());
  });

  it("surfaces a retry when availability cannot be loaded", async () => {
    getMonthAvailability.mockResolvedValue({
      ok: false,
      error: { code: "INTERNAL", message: "حدث خطأ ما لدينا. من فضلك حاول مرة أخرى." },
    });
    const user = userEvent.setup();
    render(<BookingWizard services={SERVICES} />);

    await user.click(screen.getByRole("button", { name: /استشارة عامة/ }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /حاول مرة أخرى/ })).toBeInTheDocument(),
    );
    expect(screen.getByText(/تعذّر تحميل التقويم/)).toBeInTheDocument();
  });

  it("moves focus to the new step's heading so the change is announced", async () => {
    const user = userEvent.setup();
    render(<BookingWizard services={SERVICES} />);

    await user.click(screen.getByRole("button", { name: /استشارة عامة/ }));

    const heading = screen.getByRole("heading", { level: 2 });
    expect(heading).toHaveTextContent("اختر التاريخ");
    expect(heading).toHaveFocus();
  });

  it("reports availability results in a live region", async () => {
    const user = userEvent.setup();
    render(<BookingWizard services={SERVICES} />);

    await user.click(screen.getByRole("button", { name: /استشارة عامة/ }));

    await waitFor(() => {
      const regions = screen.getAllByRole("status");
      expect(regions.some((node) => /يوم متاح/.test(node.textContent ?? ""))).toBe(true);
    });
  });
});
