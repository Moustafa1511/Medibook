## What changed

<!-- One or two sentences. Link the plan task ID, e.g. T4.3. -->

## Plan reference

- Task: <!-- e.g. T5.4 -->
- Sections touched: <!-- e.g. Section 6, Section 9 -->

## Checklist

- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` pass locally
- [ ] Any new log line touching patient data reviewed for PII — no phone numbers,
      names, OTP codes, passwords, session tokens or booking references reach the
      log (C19); correlation uses `phoneHash()` instead
- [ ] Server-side validation added for every new input boundary (Zod schema shared
      with the client where a form exists)
- [ ] New or changed times are stored as UTC instants and converted only at the
      edge via `src/lib/dates.ts` (C6)
- [ ] Money handled in integer minor units and formatted only through
      `src/lib/money.ts` (C7)
- [ ] Current time read through a `Clock`, not `new Date()` (C22)
- [ ] New environment variables added to `.env.example` **and** `src/lib/env.ts`
      (C16) — the key-list test updated
- [ ] Tests added for the behaviour this PR changes; a bug fix ships with a
      regression test
- [ ] Acceptance criteria from the plan task are all met
