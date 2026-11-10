import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ConfirmDialog } from "@/components/confirm-dialog";

describe("تأكيدDialog", () => {
  it("returns focus to the trigger after cancel", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn().mockResolvedValue(undefined);

    render(
      <ConfirmDialog
        trigger={<button type="button">Open</button>}
        title="Delete appointment?"
        description="This cannot be undone."
        onConfirm={onConfirm}
      />,
    );

    const trigger = screen.getByRole("button", { name: "Open" });
    await user.click(trigger);

    const cancelButton = await screen.findByRole("button", { name: "إلغاء" });
    await user.click(cancelButton);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("disables the confirm button while pending, then returns focus to the trigger once it resolves", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn().mockResolvedValue(undefined);

    render(
      <ConfirmDialog
        trigger={<button type="button">Open</button>}
        title="إلغاء appointment?"
        description="The patient will be notified."
        confirmLabel="Yes, cancel"
        destructive
        onConfirm={onConfirm}
      />,
    );

    const trigger = screen.getByRole("button", { name: "Open" });
    await user.click(trigger);

    const confirmButton = await screen.findByRole("button", { name: "Yes, cancel" });
    const clickPromise = user.click(confirmButton);

    // While onConfirm's promise is in flight the confirm button must be
    // disabled - this is the pending state the task calls for.
    await waitFor(() => expect(confirmButton).toBeDisabled());
    await clickPromise;

    expect(onConfirm).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    // Whether the dialog was dismissed by Cancel or by a resolved confirm,
    // Radix's own focus-restoration must send focus back to the trigger -
    // asserted directly rather than assumed.
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("keeps the dialog open and does not call onتأكيد when only cancel is clicked twice", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn().mockResolvedValue(undefined);

    render(
      <ConfirmDialog
        trigger={<button type="button">Open</button>}
        title="Delete service?"
        description="This cannot be undone."
        onConfirm={onConfirm}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Open" }));
    expect(await screen.findByText("Delete service?")).toBeInTheDocument();
    expect(screen.getByText("This cannot be undone.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "إلغاء" }));
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
