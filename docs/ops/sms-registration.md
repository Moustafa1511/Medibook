# SMS carrier registration (plan task T1.9)

**Status: not started — requires clinic/stakeholder action, not engineering work.**

A2P messaging registration takes days to weeks of carrier review that no
engineering effort can compress (plan amendment A11), which is why it is filed in
Phase 1 rather than Phase 12.

## This task blocks nothing in Phases 1-11

Development and testing use `SMS_PROVIDER=console`, which prints every message to
the terminal. Only Phase 12's switch-over to `TwilioProvider` in production
depends on this registration completing. It is calendar time, not engineer time.

## What needs to happen

1. Open the Twilio account (clinic owner, since it carries billing details).
2. File **one** of these, determined by the clinic's SMS jurisdiction:
   - **US / Canada:** A2P 10DLC brand + campaign registration, or toll-free
     verification. Alphanumeric sender IDs are **not** supported here.
   - **Elsewhere, where the destination carrier permits it:** an alphanumeric
     sender ID.
3. Record below which path was filed and the carrier's expected approval date.

## Record

| Field                  | Value                                                 |
| ---------------------- | ----------------------------------------------------- |
| Twilio account created | _not yet_                                             |
| Path filed             | _not yet — depends on OQ15 (clinic SMS jurisdiction)_ |
| Date filed             | _not yet_                                             |
| Expected approval date | _not yet_                                             |
| Owner                  | _unassigned_                                          |

Blocked on open question **OQ15** in Section 1.4 of the plan: which country is the
clinic's primary SMS jurisdiction.
