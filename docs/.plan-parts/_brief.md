# ORIGINAL STAKEHOLDER BRIEF (verbatim, binding requirement source)

## PROJECT
"MediBook": a web app for a single medical clinic. It has three parts:
1. A static, modern landing page
2. A patient reservation flow with a calendar, date and time selection, and name and phone confirmation
3. A protected admin area with a dashboard showing total patient count and reservation and revenue

## FUNCTIONAL REQUIREMENTS

### 1. Landing Page (static and fast)
- Sections: Hero with a "Book Appointment" CTA, Services with prices, About/Doctors, How It Works (3 steps), Testimonials, Clinic Hours and Location, FAQ, Footer with contact info.
- Statically generated (SSG) with no runtime data fetching. Services and prices come from a single config or seed source.
- Fully responsive (mobile-first), accessible (WCAG 2.1 AA), Lighthouse score >= 95 in all categories.

### 2. Reservation Flow (multi-step wizard)
- Step 1: Service. Choose a service. Each service has a name, duration, and price.
- Step 2: Date. Interactive calendar. Disable past dates, clinic closed days, and fully booked days.
- Step 3: Time. Show available time slots for the selected date. Slots are generated from clinic working hours, service duration, and existing bookings.
- Step 4: Patient details. Full name: required, 2-80 characters, letters, spaces, hyphens and apostrophes only. Phone number: required, validated in E.164 format with a country code selector.
- Step 5: Review and confirm. Show a summary of name, phone, service, date, time, and price. The patient must explicitly confirm that the name and phone are correct.
- Phone verification. Send a 6-digit OTP via SMS before the booking is finalized. Use a pluggable SmsProvider interface with a Twilio implementation and a console/mock implementation for development. OTP rules: 5-minute expiry, maximum 5 attempts, resend cooldown.
- Success screen. Show a booking reference code, an "Add to Calendar" (.ics) download, and send an SMS confirmation.
- Concurrency. Prevent double-booking with a DB-level unique constraint or transaction on the slot. Handle the race condition gracefully in the UI.
- Time zone. Store all times in UTC and display them in the clinic's configured time zone.

### 3. Admin Area (authenticated)
- Login. Secure admin login using email and password with hashed passwords. Session-based auth, rate-limited login, all admin routes protected via middleware.
- Dashboard KPI cards: Total patients (unique by phone number); Total revenue (sum of prices of COMPLETED appointments); Expected revenue (CONFIRMED, upcoming appointments); Today's appointments; Upcoming appointments this week.
- Dashboard charts: Revenue over time (daily, weekly, or monthly toggle); Appointments by service; A date-range filter applied to all KPIs and charts.
- Admin calendar: day, week, and month views of all appointments, color-coded by status.
- Appointments table: Search, filter by status, date, and service, and pagination. Actions: confirm, mark completed, mark no-show, cancel, reschedule.
- Patients list: name, phone, visit count, total spent, last visit.
- Settings: Clinic working hours per weekday; Closed dates / holidays; Slot interval; Services CRUD (name, duration, price, active flag).
- Currency. Store currency as integer minor units (e.g. cents) and make it configurable.

## APPOINTMENT STATUS MODEL
PENDING_VERIFICATION -> CONFIRMED -> COMPLETED | CANCELLED | NO_SHOW
- Unverified PENDING bookings expire after 10 minutes and release the slot.

## RECOMMENDED TECH STACK (justify any deviation)
- Framework: Next.js 14+ (App Router) with TypeScript in strict mode
- Styling: Tailwind CSS with shadcn/ui and lucide-react icons
- Database: Prisma ORM. SQLite in development and PostgreSQL in production.
- Auth: Auth.js (NextAuth) Credentials provider using bcrypt/argon2
- Validation: Zod, shared between client and server
- Forms: React Hook Form
- Calendar: Patient side react-day-picker; Admin side FullCalendar
- Charts: Recharts
- Dates: date-fns with date-fns-tz
- Testing: Unit Vitest; Component React Testing Library; E2E Playwright
- Tooling: ESLint and Prettier, plus a GitHub Actions workflow for CI

## DESIGN SYSTEM (modern, calm, medical)
- Primary: Teal #0D9488 (hover #0F766E)
- Secondary: Indigo #4F46E5
- Accent: Soft Coral #F97066 (CTAs and highlights, used sparingly)
- Background: #F8FAFC
- Surface: #FFFFFF
- Border: #E2E8F0
- Text: #0F172A (primary), #475569 (muted)
- Status colors: Success #16A34A, Warning #F59E0B, Danger #DC2626, Info #0EA5E9
- Typography: "Inter" for UI text and "Plus Jakarta Sans" for headings
- Style: rounded-2xl cards, soft shadows, generous whitespace, 8px spacing grid, subtle motion that respects prefers-reduced-motion
- Dark mode is optional (nice-to-have). Define all colors as CSS variables / Tailwind theme tokens.

## NON-FUNCTIONAL REQUIREMENTS
- Security: Server-side validation on every endpoint; CSRF protection; Rate limiting on OTP and booking endpoints; No PII in logs; Secrets only in .env, with a .env.example provided
- Privacy: Store minimal patient data and mention data retention in the plan.
- Performance: The landing page is static. Booking API p95 latency is under 300ms.
- Code quality: Feature-based folder structure, typed API layer, no "any".
- Delivery: A seed script with sample services, appointments, and one admin user.

## REQUIRED OUTPUT STRUCTURE (exact)
1. Summary and Assumptions (every assumption; open questions for stakeholder)
2. Architecture Overview (Mermaid component diagram + rendering strategy per route)
3. Folder / File Structure (full tree)
4. Data Model (Prisma schema draft + Mermaid ER diagram; indexes and unique constraints)
5. API / Server Actions Spec (per endpoint: method, path, Zod input and output, auth requirement, error cases)
6. Slot Availability Algorithm (pseudocode + edge cases: DST changes, overlapping durations, closed days)
7. Booking and OTP Sequence Diagram (Mermaid)
8. UI Plan (page-by-page wireframe descriptions; component inventory; design tokens mapped to Tailwind config)
9. Admin Dashboard Metrics (exact definition and SQL/Prisma query approach for each KPI)
10. Security and Privacy Checklist
11. Testing Strategy (critical E2E scenarios: full booking flow, double-booking race, admin login, KPI accuracy)
12. Implementation Phases (ordered: Setup -> Design System -> Landing -> Data/API -> Booking Flow -> OTP -> Admin Auth -> Dashboard -> Calendar/Tables -> Settings -> Testing -> Deploy). Each task: description, files touched, dependencies, acceptance criteria, estimated complexity (S/M/L).
13. Risks and Mitigations
14. Definition of Done for the whole project

## RULES
- Be specific and actionable. Every task must be small enough for a single focused implementation session.
- Prefer simplicity. Do not over-engineer for multi-clinic or multi-tenant use, but keep the code extensible.
- If a requirement is ambiguous, state the assumption explicitly and continue.
- No application code in the plan deliverable beyond illustrative schema/pseudocode/type snippets.
- Final plan saved to docs/PLAN.md
