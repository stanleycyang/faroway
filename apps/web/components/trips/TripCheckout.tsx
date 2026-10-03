"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { ExternalLink, ShieldCheck, X } from "lucide-react";
import { useModalFocusTrap } from "@/hooks/useModalFocusTrap";
import { buildViatorHandoffUrl } from "@/lib/affiliates/viator-link";

interface Selection {
  id: string;
  name: string;
  date: string;
  attemptId?: string;
}
interface Handoff {
  id: string;
  item_id: string;
  item_name: string;
  clicked_at: string;
  canResume?: boolean;
}
const CheckoutContext = createContext<{
  enabled: boolean;
  review: (selection: Selection) => void;
} | null>(null);

export function useTripCheckout() {
  return useContext(CheckoutContext);
}

/** Saved provider handoffs, deliberately separate from booking confirmations. */
export function TripCheckout({
  tripId,
  travelers,
  children,
}: {
  tripId: string;
  travelers: number;
  children: React.ReactNode;
}) {
  const [enabled, setEnabled] = useState(false);
  const [attempts, setAttempts] = useState<Handoff[]>([]);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const endpoint = `/api/trips/${encodeURIComponent(tripId)}/checkout`;
  const refresh = useCallback(async () => {
    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      if (!response.ok) throw new Error();
      const data = await response.json();
      setEnabled(data.enabled === true);
      setAttempts(data.attempts || []);
      setHistoryError(false);
    } catch {
      setHistoryError(true);
      setEnabled(false);
    }
  }, [endpoint]);
  useEffect(() => {
    void refresh();
    const onFocus = () => {
      void refresh();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);
  const close = () => {
    if (!busyRef.current) setSelection(null);
  };
  useModalFocusTrap({ open: selection !== null, dialogRef, onClose: close });
  const review = (item: Selection) => {
    setError(null);
    const previous = attempts.find(
      (a) => a.item_id === `${item.id}@${item.date}` && a.canResume !== false,
    );
    setSelection({
      ...item,
      attemptId:
        item.attemptId ||
        previous?.id.slice("checkout-".length) ||
        crypto.randomUUID(),
    });
  };
  const continueToProvider = async () => {
    if (!selection || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activityId: selection.id,
          date: selection.date,
          attemptId: selection.attemptId,
        }),
        signal: AbortSignal.timeout(20_000),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Could not prepare checkout.");
      const url = buildViatorHandoffUrl(
        data.redirectUrl,
        `checkout-${selection.attemptId}`,
      );
      if (!url) throw new Error("The provider link could not be verified.");
      // Same-tab navigation avoids async popup blockers. The ledger survives
      // browser back, app restarts, and failed navigation; no booking is inferred.
      window.location.assign(url);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Please try again.");
      void refresh();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  const uniqueAttempts = attempts.filter(
    (a, index) => attempts.findIndex((b) => b.item_id === a.item_id) === index,
  );
  const previouslyPrepared =
    selection &&
    attempts.some((a) => a.item_id === `${selection.id}@${selection.date}`);
  return (
    <CheckoutContext.Provider value={{ enabled, review }}>
      {historyError && (
        <p
          role="status"
          className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900"
        >
          Your booking steps could not be loaded.{" "}
          <button onClick={() => void refresh()} className="underline">
            Try again
          </button>
        </p>
      )}
      {uniqueAttempts.length > 0 && (
        <section
          aria-label="Saved booking steps"
          className="mb-6 rounded-2xl border border-primary-100 bg-primary-50/50 p-5"
        >
          <h3 className="font-semibold text-gray-900">
            Pick up where you left off
          </h3>
          <p className="mt-1 text-sm text-gray-600">
            These are saved checkout steps, not confirmed bookings. Check your
            Viator confirmation before paying again.
          </p>
          <ul className="mt-4 space-y-3">
            {uniqueAttempts.map((attempt) => {
              const [id, date] = attempt.item_id.split("@");
              return (
                <li
                  key={attempt.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-3"
                >
                  <div>
                    <p className="text-sm font-medium">{attempt.item_name}</p>
                    <p className="text-xs text-gray-500">
                      Planned for {date} · Confirmation not verified
                      {attempt.canResume === false &&
                        " · From a previous plan; review the current choices instead."}
                    </p>
                  </div>
                  <button
                    disabled={!enabled || attempt.canResume === false}
                    onClick={() =>
                      review({
                        id,
                        date,
                        name: attempt.item_name,
                        attemptId: attempt.id.slice("checkout-".length),
                      })
                    }
                    className="min-h-11 text-sm font-semibold text-primary disabled:opacity-40"
                  >
                    Review step
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {children}
      {selection && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4">
          <div
            ref={dialogRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="checkout-title"
            aria-describedby="checkout-description"
            className="relative max-h-[90vh] w-full max-w-lg overflow-auto rounded-3xl bg-white p-6 shadow-2xl"
          >
            <button
              aria-label="Close checkout review"
              disabled={busy}
              onClick={close}
              className="absolute right-4 top-4 rounded-full p-2 text-gray-500"
            >
              <X className="h-5 w-5" />
            </button>
            <ShieldCheck className="mb-4 h-8 w-8 text-primary" />
            <h2 id="checkout-title" className="text-2xl font-semibold">
              Your next step, with Viator
            </h2>
            <p className="mt-4 font-medium">{selection.name}</p>
            <p className="mt-1 text-sm text-gray-600">
              Planned for {selection.date} · {travelers} traveler
              {travelers === 1 ? "" : "s"}
            </p>
            <p
              id="checkout-description"
              className="mt-4 text-sm leading-relaxed text-gray-600"
            >
              Confirm your date, time, traveler details, final price and
              cancellation terms on Viator. Payment and booking support are
              handled by Viator. Your Faroway itinerary stays saved.
            </p>
            <p className="mt-3 text-xs text-gray-500">
              Faroway may earn a commission when you book. Continuing does not
              reserve a place or charge you.
            </p>
            {previouslyPrepared && (
              <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
                Already paid? Check Viator’s confirmation email before
                continuing. We cannot yet verify whether this step resulted in a
                booking.
              </p>
            )}
            {error && (
              <p role="alert" className="mt-4 text-sm text-red-700">
                {error} Your plan is still saved.
              </p>
            )}
            <button
              onClick={() => void continueToProvider()}
              disabled={busy || !enabled}
              className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Preparing your booking step…" : "Continue to Viator"}
              <ExternalLink className="h-4 w-4" />
            </button>
            <button
              onClick={close}
              disabled={busy}
              className="mt-2 min-h-11 w-full text-sm text-gray-600"
            >
              Keep planning
            </button>
          </div>
        </div>
      )}
    </CheckoutContext.Provider>
  );
}
