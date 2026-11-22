"use client";

import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  'input:not([disabled]):not([type="hidden"])',
  "select:not([disabled])",
  "textarea:not([disabled])",
  "summary",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

// Ref-counted body scroll lock so stacked modals never clobber an outer lock,
// and modals that already manage their own scroll lock before this hook runs
// are left intact.
let activeScrollLocks = 0;
let savedBodyOverflow = "";

interface UseModalFocusTrapOptions<T extends HTMLElement> {
  open: boolean;
  dialogRef: RefObject<T | null>;
  onClose: () => void;
}

/**
 * Keeps keyboard focus inside an open modal, closes it on Escape, and restores
 * focus to the control that launched it. Dialog containers are deliberately
 * supported as the initial focus target so Shift+Tab cannot escape backwards.
 */
export function useModalFocusTrap<T extends HTMLElement>({
  open,
  dialogRef,
  onClose,
}: UseModalFocusTrapOptions<T>) {
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    dialog?.focus();

    let ownsScrollLock = false;
    const bodyStyle =
      typeof document !== "undefined" ? document.body?.style : undefined;
    if (
      bodyStyle &&
      (activeScrollLocks > 0 || bodyStyle.overflow !== "hidden")
    ) {
      if (activeScrollLocks === 0) {
        savedBodyOverflow = bodyStyle.overflow;
        bodyStyle.overflow = "hidden";
      }
      activeScrollLocks += 1;
      ownsScrollLock = true;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab" || !dialog) return;

      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (!first || !last) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const activeElement = document.activeElement;
      const focusIsOutside = !activeElement || !dialog.contains(activeElement);

      if (
        event.shiftKey &&
        (activeElement === dialog || activeElement === first || focusIsOutside)
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (activeElement === dialog || activeElement === last || focusIsOutside)
      ) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (ownsScrollLock) {
        activeScrollLocks = Math.max(0, activeScrollLocks - 1);
        if (activeScrollLocks === 0 && bodyStyle) {
          bodyStyle.overflow = savedBodyOverflow;
        }
      }
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [dialogRef, open]);
}
