# MediBook

Appointment booking for a single medical clinic: a static landing page, a patient
reservation wizard with SMS verification, and an authenticated admin area with
revenue and appointment reporting.

- Implementation plan: [docs/PLAN.md](docs/PLAN.md)
- Binding technical contract: [docs/.plan-parts/_contract.md](docs/.plan-parts/_contract.md)

## Quickstart

```bash
docker compose up -d db
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm dev
```

The app runs at http://localhost:3000.

> `pnpm db:migrate` and `pnpm db:seed` become meaningful once the schema and seed
> script land in Phase 4; before then the first two commands and `pnpm dev` are
> sufficient.

## Scripts

| Script                      | Purpose                                                     |
| --------------------------- | ----------------------------------------------------------- |
| `pnpm dev`                  | Next.js dev server                                          |
| `pnpm build` / `pnpm start` | Production build and serve                                  |
| `pnpm lint`                 | ESLint, including the contract's custom architectural rules |
| `pnpm typecheck`            | `tsc --noEmit` (strict, `noUncheckedIndexedAccess`)         |
| `pnpm test`                 | Vitest: `unit` (node) and `component` (jsdom) projects      |
| `pnpm test:e2e`             | Playwright end-to-end suite                                 |
| `pnpm db:migrate`           | `prisma migrate dev`                                        |
| `pnpm db:seed`              | Seed services, appointments and the admin user              |

## Configuration

Copy `.env.example` to `.env` and fill in every key; `src/lib/env.ts` validates
the whole set at startup and fails with the names of anything missing. `.env` is
never committed.

Development defaults need no external accounts: `SMS_PROVIDER=console` prints
messages to the terminal and `RATE_LIMIT_PROVIDER=memory` needs no Redis.

## Architecture

Layers run one way only — `app -> features -> server -> lib` — and ESLint
enforces it, along with the clock seam (C22), the `process.env` seam (C16), the
ban on local-time `Date` construction in server code (C6), and the Edge-safety of
`middleware.ts` (C11). See Section 2.2 of the plan.
