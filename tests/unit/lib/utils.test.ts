import { describe, expect, it } from "vitest";

import { cn } from "@/lib/utils";

describe("cn", () => {
  it("drops falsy branches and keeps the rest", () => {
    // Bound to a variable rather than a literal `false &&` so the expression is
    // not a compile-time constant (no-constant-binary-expression).
    const isCompact = false;
    expect(cn("p-2", isCompact && "p-4", "text-sm")).toBe("p-2 text-sm");
  });

  it("lets a later conflicting utility win", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });

  it("resolves the @/ alias from both test projects", () => {
    expect(typeof cn).toBe("function");
  });
});
