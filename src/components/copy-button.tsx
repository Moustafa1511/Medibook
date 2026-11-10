"use client"; // Needs client-side state (idle/copied/error), a timer to reset it, and
// direct access to `navigator.clipboard` / `document.execCommand`, none of which run
// during server rendering.

import * as React from "react";
import { Check, Copy, X } from "lucide-react";

import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CopyStatus = "idle" | "copied" | "error";

export interface CopyButtonProps extends Omit<ButtonProps, "onClick" | "children"> {
  /** Text copied to the clipboard when the button is pressed. */
  value: string;
  /** Visible label while idle. Defaults to "Copy". */
  label?: string;
  /** How long the "Copied"/"Couldn't copy" state is shown before reverting to idle, in ms. */
  resetAfterMs?: number;
}

const ANNOUNCEMENT: Record<CopyStatus, string> = {
  idle: "",
  copied: "Copied to clipboard",
  error: "Couldn't copy to clipboard",
};

/**
 * Writes `text` to the clipboard, falling back to the legacy `execCommand("copy")`
 * path when the modern Clipboard API is unavailable (older browsers, insecure
 * contexts, and — by default — jsdom in tests). Never throws: every failure resolves
 * to `false` so the caller can show an error state instead of crashing.
 */
async function writeToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to the legacy path below.
    }
  }

  if (typeof document === "undefined" || typeof document.execCommand !== "function") {
    return false;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  let succeeded = false;
  try {
    succeeded = document.execCommand("copy");
  } catch {
    succeeded = false;
  } finally {
    document.body.removeChild(textarea);
  }
  return succeeded;
}

/**
 * A button that copies `value` to the clipboard and reports what happened both
 * visually (an icon + text label change — C4, status is never color-only) and to
 * assistive tech (a polite `aria-live` announcer). Defaults to the `outline` button
 * variant rather than `default`, since the vendored `default` variant's `bg-primary`
 * fill is below the AA contrast threshold for a solid button fill (C18).
 */
export const CopyButton = React.forwardRef<HTMLButtonElement, CopyButtonProps>(
  (
    { value, label = "Copy", resetAfterMs = 2000, variant = "outline", className, ...props },
    ref,
  ) => {
    const [status, setStatus] = React.useState<CopyStatus>("idle");
    const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    React.useEffect(() => {
      return () => {
        if (timeoutRef.current !== undefined) clearTimeout(timeoutRef.current);
      };
    }, []);

    const handleClick = () => {
      void writeToClipboard(value).then((succeeded) => {
        setStatus(succeeded ? "copied" : "error");
        if (timeoutRef.current !== undefined) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => setStatus("idle"), resetAfterMs);
      });
    };

    const Icon = status === "copied" ? Check : status === "error" ? X : Copy;
    const visibleLabel =
      status === "copied" ? "Copied" : status === "error" ? "Couldn't copy" : label;

    return (
      <>
        <Button
          ref={ref}
          type="button"
          variant={variant}
          className={cn(className)}
          onClick={handleClick}
          {...props}
        >
          <Icon aria-hidden="true" />
          {visibleLabel}
        </Button>
        <span className="sr-only" role="status" aria-live="polite">
          {ANNOUNCEMENT[status]}
        </span>
      </>
    );
  },
);
CopyButton.displayName = "CopyButton";
