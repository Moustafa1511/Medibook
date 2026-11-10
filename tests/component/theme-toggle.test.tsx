import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "next-themes";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ThemeToggle } from "@/components/theme-toggle";

// jsdom has no real `matchMedia`; next-themes calls it on mount to resolve
// the system colour scheme even with `enableSystem={false}`. Stub it here
// rather than in shared test setup, since this file is the only one that
// needs it.
beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

// This app uses a class-based dark mode strategy (`darkMode: "class"` in
// tailwind.config.ts), so every render wraps the toggle in a provider that
// matches it — next-themes defaults to `attribute="data-theme"` otherwise.
function renderToggle() {
  return render(
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <ThemeToggle />
    </ThemeProvider>,
  );
}

describe("ThemeToggle", () => {
  it("does not throw before mount and exposes an accessible name immediately", () => {
    expect(() => renderToggle()).not.toThrow();
    const button = screen.getByRole("button");
    expect(button).toHaveAccessibleName();
  });

  it("is a real button, not a div", () => {
    renderToggle();
    expect(screen.getByRole("button").tagName.toLowerCase()).toBe("button");
  });

  it("toggles the `dark` class on <html> and states what the click will do", async () => {
    const user = userEvent.setup();
    renderToggle();

    const button = await screen.findByRole("button", { name: /التبديل إلى المظهر/ });
    expect(document.documentElement.classList.contains("dark")).toBe(false);

    await user.click(button);

    await waitFor(() => {
      expect(document.documentElement.classList.contains("dark")).toBe(true);
    });
    expect(screen.getByRole("button", { name: "التبديل إلى المظهر الفاتح" })).toBeInTheDocument();
  });

  it("survives a localStorage write failure without throwing", async () => {
    const user = userEvent.setup();
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage disabled");
    });

    renderToggle();
    const button = await screen.findByRole("button", { name: /التبديل إلى المظهر/ });

    await expect(user.click(button)).resolves.not.toThrow();

    setItemSpy.mockRestore();
  });
});
