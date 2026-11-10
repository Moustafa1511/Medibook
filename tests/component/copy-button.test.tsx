import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { CopyButton } from "@/components/copy-button";

const clipboardDescriptor = Object.getOwnPropertyDescriptor(globalThis.navigator, "clipboard");

describe("CopyButton", () => {
  afterEach(() => {
    if (clipboardDescriptor) {
      Object.defineProperty(globalThis.navigator, "clipboard", clipboardDescriptor);
    } else {
      Reflect.deleteProperty(globalThis.navigator, "clipboard");
    }
  });

  it("renders an idle label with an icon, not color alone (C4)", () => {
    render(<CopyButton value="secret-code" />);
    expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument();
  });

  describe("when navigator.clipboard is undefined (jsdom's default — no clipboard, no execCommand)", () => {
    beforeEach(() => {
      Reflect.deleteProperty(globalThis.navigator, "clipboard");
    });

    it("degrades without throwing, and announces failure through the aria-live region", async () => {
      render(<CopyButton value="secret-code" />);
      const button = screen.getByRole("button", { name: "Copy" });

      expect(() => fireEvent.click(button)).not.toThrow();

      await waitFor(() => {
        expect(screen.getByRole("status")).toHaveTextContent("Couldn't copy to clipboard");
      });
      expect(screen.getByRole("button", { name: "Couldn't copy" })).toBeInTheDocument();
    });
  });

  describe("when navigator.clipboard.writeText is available", () => {
    beforeEach(() => {
      Object.defineProperty(globalThis.navigator, "clipboard", {
        configurable: true,
        value: { writeText: () => Promise.resolve() },
      });
    });

    it("copies the given value and announces success through the aria-live region", async () => {
      render(<CopyButton value="secret-code" />);
      const button = screen.getByRole("button", { name: "Copy" });

      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByRole("status")).toHaveTextContent("Copied to clipboard");
      });
      expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument();
    });
  });
});
