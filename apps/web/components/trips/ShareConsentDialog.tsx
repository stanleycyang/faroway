"use client";
import React, { useEffect, useRef } from "react";

export function ShareConsentDialog({
  open,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);
  return (
    <dialog
      ref={dialog}
      onCancel={onCancel}
      aria-labelledby="share-consent-title"
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl p-6 shadow-xl backdrop:bg-black/40"
    >
      <h2 id="share-consent-title" className="text-xl font-bold">
        Make this trip public?
      </h2>
      <p className="my-4 text-sm text-gray-600">
        Anyone with the link can view your destination, travel dates and
        itinerary. The link stays active even if you cancel the share sheet. You
        can turn off public access from this trip.
      </p>
      <div className="flex flex-wrap justify-end gap-3">
        <button
          type="button"
          autoFocus
          onClick={onCancel}
          className="min-h-11 rounded-lg border px-4"
        >
          Keep private
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="min-h-11 rounded-lg bg-primary px-4 text-white"
        >
          Create public link
        </button>
      </div>
    </dialog>
  );
}
