import { db } from "@/server/db";

import type { BookableService } from "./types";

/**
 * The services offered in wizard step 1, read on the server. Returns a narrow
 * view rather than the Prisma row so a component cannot depend on columns it
 * should not see.
 */
export async function getBookableServices(): Promise<BookableService[]> {
  const [services, settings] = await Promise.all([
    db.service.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        durationMin: true,
        priceMinor: true,
      },
    }),
    db.clinicSettings.findUnique({ where: { id: "singleton" }, select: { currency: true } }),
  ]);

  const currency = settings?.currency ?? "EUR";
  return services.map((service) => ({ ...service, currency }));
}
