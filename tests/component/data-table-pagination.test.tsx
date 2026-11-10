import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { DataTablePagination } from "@/components/data-table-pagination";

describe("DataTablePagination", () => {
  it("holds no internal state - it is driven entirely by page/pageCount/onPageChange props", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/components/data-table-pagination.tsx"),
      "utf-8",
    );
    expect(source).not.toMatch(/\buseState\b/);
  });

  it("disables Previous on the first page and Next on the last page", () => {
    const onPageChange = vi.fn();
    const { rerender } = render(
      <DataTablePagination page={1} pageCount={3} onPageChange={onPageChange} />,
    );

    expect(screen.getByRole("button", { name: "الصفحة السابقة" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "الصفحة التالية" })).toBeEnabled();

    rerender(<DataTablePagination page={3} pageCount={3} onPageChange={onPageChange} />);

    expect(screen.getByRole("button", { name: "الصفحة السابقة" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "الصفحة التالية" })).toBeDisabled();
  });

  it("calls onPageChange with the adjacent page number and never updates itself", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(<DataTablePagination page={2} pageCount={3} onPageChange={onPageChange} />);

    await user.click(screen.getByRole("button", { name: "الصفحة التالية" }));
    expect(onPageChange).toHaveBeenCalledWith(3);
    // The caller owns the page: with no state update of its own, the
    // component still shows page 2 until the caller re-renders it.
    expect(screen.getByText("Page 2 of 3")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "الصفحة السابقة" }));
    expect(onPageChange).toHaveBeenCalledWith(1);
    expect(onPageChange).toHaveBeenCalledTimes(2);
  });

  it("re-renders strictly from new props, with no memory of the previous render", () => {
    const onPageChange = vi.fn();
    const { rerender } = render(
      <DataTablePagination page={1} pageCount={5} onPageChange={onPageChange} />,
    );
    expect(screen.getByText("Page 1 of 5")).toBeInTheDocument();

    rerender(<DataTablePagination page={4} pageCount={5} onPageChange={onPageChange} />);
    expect(screen.getByText("Page 4 of 5")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "الصفحة التالية" })).toBeEnabled();
  });
});
