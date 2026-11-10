"use client";
// Owns the dialog's open state and its pending-while-confirming state
// (useState) and wires click handlers for the confirm/cancel buttons, so
// this cannot be a Server Component (8.2.13(a)/(d)).

import * as React from "react";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export interface ConfirmDialogProps {
  /**
   * The element that opens the dialog. Rendered via Radix's `DialogTrigger`
   * with `asChild`, so it is cloned with the trigger's own props/ref rather
   * than wrapped in an extra DOM node - it must forward its ref (every
   * `ui/*` primitive, and a plain `<button>`, already does).
   */
  trigger: React.ReactElement;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Styles the confirm button for an irreversible action (e.g. cancel appointment, deactivate service). */
  destructive?: boolean;
  /** Awaited before the dialog closes; the confirm button is disabled for the duration. */
  onConfirm: () => Promise<void>;
  className?: string;
}

/**
 * The one reusable "are you sure?" pattern (8.2.12): title, description,
 * confirm/cancel labels, optional destructive styling, and a pending state
 * that disables the confirm button while `onConfirm` is in flight.
 *
 * Focus-return on close is Radix's own `DialogContentModal` behavior - it
 * records `DialogTrigger`'s node when the dialog opens and focuses it back
 * on `onCloseAutoFocus`, regardless of whether the close came from Cancel,
 * Escape, an overlay click, or `onConfirm` resolving. This component's test
 * asserts `document.activeElement` after both the confirm and cancel paths
 * instead of taking that behavior on faith.
 */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel = "تأكيد",
  cancelLabel = "إلغاء",
  destructive = false,
  onConfirm,
  className,
}: ConfirmDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  async function handleConfirm() {
    setPending(true);
    try {
      await onConfirm();
      setOpen(false);
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Block Escape / overlay-click / re-toggle dismissal while the
        // confirm action is in flight, matching the confirm button's own
        // disabled state.
        if (!pending) setOpen(next);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className={cn(className)}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={destructive ? "destructive" : "default"}
            // Solid fill + normal-size label: --primary measures ~3.4:1 for
            // white text and fails AA, so the actual fill is --primary-button
            // (C18). The destructive variant already resolves to a token
            // that passes contrast directly, so it needs no override.
            className={cn(!destructive && "bg-primary-button hover:bg-primary-button-hover")}
            disabled={pending}
            onClick={handleConfirm}
          >
            {pending ? (
              <>
                <Loader2 className="animate-spin" aria-hidden="true" />
                <span>{confirmLabel}</span>
              </>
            ) : (
              confirmLabel
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
