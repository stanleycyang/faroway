"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useMemo,
  useState,
} from "react";
import { ExternalLink, ShieldCheck, X, Calendar, Users } from "lucide-react";
import { z } from "zod";
import { useModalFocusTrap } from "@/hooks/useModalFocusTrap";
import { isValidDateOnly } from "@/lib/api/date-range";
import { formatTripDate } from "@/lib/trips/date-duration";
import { buildViatorHandoffUrl } from "@/lib/affiliates/viator-link";

const attemptIdSchema = z.string().uuid();

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
function isHandoff(value: unknown): value is Handoff {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    ["id", "item_id", "item_name", "clicked_at"].every(
      (key) => typeof item[key] === "string",
    ) &&
    typeof item.id === "string" &&
    item.id.startsWith("checkout-") &&
    attemptIdSchema.safeParse(item.id.slice("checkout-".length)).success &&
    typeof item.item_id === "string" &&
    /^[^@]+@\d{4}-\d{2}-\d{2}$/.test(item.item_id) &&
    isValidDateOnly(item.item_id.split("@")[1]) &&
    typeof item.item_name === "string" &&
    item.item_name.trim().length > 0 &&
    typeof item.clicked_at === "string" &&
    Number.isFinite(Date.parse(item.clicked_at)) &&
    (item.canResume === undefined || typeof item.canResume === "boolean")
  );
}
const CheckoutContext = createContext<{
  enabled: boolean;
  review: (selection: Selection) => void;
} | null>(null);

export function useTripCheckout() {
  return useContext(CheckoutContext);
}

/** Saved provider handoffs, deliberately separate from booking confirmations. */
interface TripCheckoutProps {
  tripId: string;
  travelers: number;
  children: React.ReactNode;
}
export function TripCheckout(props: TripCheckoutProps) {
  return <CheckoutSession key={props.tripId} {...props} />;
}
function CheckoutSession({ tripId, travelers, children }: TripCheckoutProps) {
  const mounted = useRef(false);
  const readSequence = useRef(0);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
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
    const sequence = ++readSequence.current;
    const current = () => mounted.current && sequence === readSequence.current;
    try {
      const response = await fetch(endpoint, {
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      });
      if (!current()) return;
      if (!response.ok) throw new Error();
      const data = await response.json();
      if (!current()) return;
      if (
        typeof data?.enabled !== "boolean" ||
        !Array.isArray(data.attempts) ||
        !data.attempts.every(isHandoff)
      )
        throw new Error();
      setEnabled(data.enabled === true);
      setAttempts(data.attempts || []);
      setHistoryError(false);
    } catch {
      if (!current()) return;
      setHistoryError(true);
      setEnabled(false);
    }
  }, [endpoint]);
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void refresh();
    });
    const onFocus = () => {
      void refresh();
    };
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);
  const close = () => {
    if (!busyRef.current) setSelection(null);
  };
  useModalFocusTrap({ open: selection !== null, dialogRef, onClose: close });
  useEffect(() => {
    if (!selection) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [selection]);
  const review = useCallback(
    (item: Selection) => {
      if (busyRef.current) return;
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
    },
    [attempts],
  );
  const contextValue = useMemo(() => ({ enabled, review }), [enabled, review]);
  const continueToProvider = async () => {
    if (!selection || busyRef.current) return;
    busyRef.current = true;
    ++readSequence.current;
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
      if (!mounted.current) return;
      const data = await response.json();
      if (!mounted.current) return;
      if (!response.ok)
        throw new Error(data.error || "Could not prepare checkout.");
      if (
        data?.status !== "handoff_prepared" ||
        data?.attemptId !== selection.attemptId
      ) {
        throw new Error(
          "This booking step could not be confirmed. Review your saved progress before continuing.",
        );
      }
      const url = buildViatorHandoffUrl(
        data.redirectUrl,
        `checkout-${selection.attemptId}`,
      );
      if (!url) throw new Error("The provider link could not be verified.");
      // Same-tab navigation avoids async popup blockers. The ledger survives
      // browser back, app restarts, and failed navigation; no booking is inferred.
      window.location.assign(url);
    } catch (reason) {
      if (!mounted.current) return;
      setError(reason instanceof Error ? reason.message : "Please try again.");
      void refresh();
    } finally {
      busyRef.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const uniqueAttempts = attempts.filter(
    (a, index) => attempts.findIndex((b) => b.item_id === a.item_id) === index,
  );
  const previouslyPrepared =
    selection &&
    attempts.some((a) => a.item_id === `${selection.id}@${selection.date}`);
  return (
    <CheckoutContext value={contextValue}>
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
                    onClick={(event) => {
                      event.currentTarget.focus();
                      review({
                        id,
                        date,
                        name: attempt.item_name,
                        attemptId: attempt.id.slice("checkout-".length),
                      });
                    }}
                    className="min-h-11 text-sm font-semibold text-primary-800 disabled:opacity-40"
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
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/60 sm:items-center sm:p-4">
          <div
            ref={dialogRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="checkout-title"
            aria-describedby="checkout-description"
            className="relative max-h-[90dvh] w-full max-w-lg overflow-auto overscroll-contain rounded-t-3xl bg-white p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl outline-none sm:rounded-3xl sm:p-8"
          >
            <div
              aria-hidden="true"
              className="mx-auto mb-6 h-1 w-10 rounded-full bg-slate-200 sm:hidden"
            />
            <button
              aria-label="Close checkout review"
              disabled={busy}
              onClick={close}
              className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </button>
            <ShieldCheck className="mb-5 h-7 w-7 text-teal-800" />
            <h2
              id="checkout-title"
              className="max-w-sm pr-6 font-editorial text-3xl leading-tight tracking-tight text-slate-900"
            >
              Your next step, with Viator
            </h2>
            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="font-semibold text-slate-900">{selection.name}</p>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-600">
                <span className="inline-flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {formatTripDate(selection.date)}
                </span>
                <span className="inline-flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  {travelers} {travelers === 1 ? "traveler" : "travelers"}
                </span>
              </div>
            </div>
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
              className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-slate-900 px-5 py-3 font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
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
    </CheckoutContext>
  );
}
