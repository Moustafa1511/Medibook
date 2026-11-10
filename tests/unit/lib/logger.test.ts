import { describe, expect, it } from "vitest";

import { createLogger, phoneHash } from "@/lib/logger";

function capture() {
  const lines: string[] = [];
  const stream = {
    write(chunk: string) {
      lines.push(chunk);
    },
  };
  // LOG_LEVEL is "silent" in tests, so raise the level for the captured logger.
  const log = createLogger(stream);
  log.level = "debug";
  return { log, lines };
}

const PHONE = "+493012345678";
const NAME = "Jürgen O'Brien-Smith";

describe("logger redaction", () => {
  it("never emits a raw phone number", () => {
    const { log, lines } = capture();
    log.info({ phoneE164: PHONE, appointmentId: "appt_1" }, "booking created");

    const output = lines.join("");
    expect(output).not.toContain(PHONE);
    expect(output).toContain("[redacted]");
    expect(output).toContain("appt_1");
  });

  it("redacts nested patient fields too", () => {
    const { log, lines } = capture();
    log.info(
      { appointment: { holdPhoneE164: PHONE, holdFullName: NAME, reference: "MB-7K3QX9" } },
      "hold placed",
    );

    const output = lines.join("");
    expect(output).not.toContain(PHONE);
    expect(output).not.toContain(NAME);
    expect(output).not.toContain("MB-7K3QX9");
  });

  it.each(["code", "password", "passwordHash", "sessionToken", "token", "authorization"])(
    "redacts %s",
    (field) => {
      const { log, lines } = capture();
      log.info({ [field]: "s3cr3t-value" }, "sensitive");
      expect(lines.join("")).not.toContain("s3cr3t-value");
    },
  );

  it("keeps non-identifying operational fields", () => {
    const { log, lines } = capture();
    log.info({ serviceId: "svc_1", requestId: "req_42", durationMs: 12 }, "action completed");

    const output = lines.join("");
    expect(output).toContain("svc_1");
    expect(output).toContain("req_42");
    expect(output).toContain("12");
  });
});

describe("phoneHash", () => {
  it("is stable, short, and does not reveal the number", () => {
    const hash = phoneHash(PHONE);
    expect(hash).toMatch(/^[0-9a-f]{8}$/);
    expect(hash).toBe(phoneHash(PHONE));
    expect(hash).not.toContain("3012345678");
  });

  it("separates different numbers", () => {
    expect(phoneHash(PHONE)).not.toBe(phoneHash("+493099999999"));
  });
});
