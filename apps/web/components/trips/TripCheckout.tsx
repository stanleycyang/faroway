"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ShieldCheck, X, Calendar, Users, ArrowRight } from "lucide-react";
import { z } from "zod";
import {
  formatAffiliatePartnerName,
  isAllowedAffiliateUrl,
  itemTypeForAffiliatePartner,
  normalizeAffiliatePartner,
  readPrice,
  resolveAffiliatePartnerByUrl,
} from "@faroway/constants";
import type { AffiliateClickSource } from "@faroway/types";
import { useModalFocusTrap } from "@/hooks/useModalFocusTrap";
import { isValidDateOnly } from "@/lib/api/date-range";
import { formatTripDate } from "@/lib/trips/date-duration";
import { formatEstimate } from "@/lib/trips/budget";
import { buildViatorHandoffUrl } from "@/lib/affiliates/viator-link";
import { AffiliateDisclosure } from "@/components/affiliates/AffiliateDisclosure";
import { trackAffiliateClick } from "@/components/affiliates/track-click-client";
import {
  CheckoutContext,
  useTripCheckout,
  type CheckoutSelection,
  type TripCheckoutContextValue,
} from "./TripCheckoutContext";

export {
  useTripCheckout,
  type CheckoutSelection,
  type TripCheckoutContextValue,
};

const attemptIdSchema = z.string().uuid();

interface ResolvedSelection extends CheckoutSelection {
  resolvedMode: "viator_hosted" | "partner_click";
  resolvedPartner: string;
  resolvedPartnerLabel: string;
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

/** Saved provider handoffs, deliberately separate from booking confirmations. */
interface TripCheckoutProps {
  tripId?: string;
  travelers: number;
  mode?: "owner" | "shared";
  source?: AffiliateClickSource;
  children: React.ReactNode;
}

export function TripCheckout({
  mode = "owner",
  tripId,
  ...rest
}: TripCheckoutProps) {
  const sessionKey =
    mode === "shared" ? "shared" : `owner:${tripId ?? "unknown"}`;
  return (
    <CheckoutSession key={sessionKey} mode={mode} tripId={tripId} {...rest} />
  );
}

function CheckoutSession({
  tripId,
  travelers,
  mode = "owner",
  source,
  children,
}: TripCheckoutProps) {
  const mounted = useRef(false);
  const readSequence = useRef(0);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const isOwnerMode = mode === "owner" && Boolean(tripId);
  const defaultSource: AffiliateClickSource =
    source ?? (mode === "shared" ? "shared_trip" : "itinerary");

  const [enabled, setEnabled] = useState(false);
  const [attempts, setAttempts] = useState<Handoff[]>([]);
  const [selection, setSelection] = useState<ResolvedSelection | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  const endpoint = tripId
    ? `/api/trips/${encodeURIComponent(tripId)}/checkout`
    : "";

  const refresh = useCallback(async () => {
    if (!isOwnerMode || !endpoint) return;
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
  }, [endpoint, isOwnerMode]);

  useEffect(() => {
    if (!isOwnerMode) return;
    void refresh();
    const onFocus = () => {
      void refresh();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [isOwnerMode, refresh]);

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
    (item: CheckoutSelection) => {
      if (busyRef.current) return;
      const isViatorHosted =
        isOwnerMode &&
        (item.mode === "viator_hosted" || (!item.mode && !item.affiliateUrl));

      if (!isViatorHosted) {
        if (!item.affiliateUrl || !isAllowedAffiliateUrl(item.affiliateUrl)) {
          return;
        }
        const resolvedPartner =
          resolveAffiliatePartnerByUrl(item.affiliateUrl) ??
          normalizeAffiliatePartner(item.partner) ??
          "viator";
        const resolvedPartnerLabel =
          item.partnerLabel || formatAffiliatePartnerName(resolvedPartner);
        setError(null);
        setSelection({
          ...item,
          resolvedMode: "partner_click",
          resolvedPartner,
          resolvedPartnerLabel,
        });
        return;
      }

      setError(null);
      const previous = attempts.find(
        (a) =>
          a.item_id === `${item.id}@${item.date ?? ""}` &&
          a.canResume !== false,
      );
      setSelection({
        ...item,
        attemptId:
          item.attemptId ||
          previous?.id.slice("checkout-".length) ||
          crypto.randomUUID(),
        resolvedMode: "viator_hosted",
        resolvedPartner: "viator",
        resolvedPartnerLabel: "Viator",
      });
    },
    [attempts, isOwnerMode],
  );

  const contextValue = useMemo<TripCheckoutContextValue>(
    () => ({ enabled, partnerEnabled: true, mode, review }),
    [enabled, mode, review],
  );

  const openExternalPartner = (url: string) => {
    const popup =
      typeof window.open === "function"
        ? window.open(url, "_blank", "noopener,noreferrer")
        : null;
    if (!popup || popup.closed) {
      window.location.assign(url);
    } else {
      setSelection(null);
    }
  };

  const continueToProvider = async () => {
    if (!selection || busyRef.current) return;
    busyRef.current = true;
    ++readSequence.current;
    setBusy(true);
    setError(null);
    try {
      if (selection.resolvedMode === "viator_hosted") {
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
        openExternalPartner(url);
        return;
      }

      if (
        !selection.affiliateUrl ||
        !isAllowedAffiliateUrl(selection.affiliateUrl)
      ) {
        throw new Error("The partner link could not be verified.");
      }

      const tracked = await trackAffiliateClick({
        affiliateUrl: selection.affiliateUrl,
        partner: selection.resolvedPartner,
        itemType:
          selection.itemType ??
          itemTypeForAffiliatePartner(selection.resolvedPartner),
        itemId: selection.id,
        itemName: selection.name,
        tripId: isOwnerMode ? tripId : undefined,
        price: selection.price,
        currency: selection.currency,
        source: selection.source ?? defaultSource,
        placement: selection.placement ?? "checkout_modal",
        campaign: selection.campaign,
      });

      if (!mounted.current) return;
      if (!tracked || !isAllowedAffiliateUrl(tracked.url)) {
        throw new Error("The partner link could not be verified.");
      }
      openExternalPartner(tracked.url);
    } catch (reason) {
      if (!mounted.current) return;
      setError(reason instanceof Error ? reason.message : "Please try again.");
      if (selection.resolvedMode === "viator_hosted") {
        void refresh();
      }
    } finally {
      busyRef.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  const uniqueAttempts = isOwnerMode
    ? attempts.filter(
        (a, index) =>
          attempts.findIndex((b) => b.item_id === a.item_id) === index,
      )
    : [];
  const previouslyPrepared =
    isOwnerMode &&
    selection?.resolvedMode === "viator_hosted" &&
    attempts.some((a) => a.item_id === `${selection.id}@${selection.date}`);

  const validSelectionPrice = selection
    ? readPrice(selection.price, selection.currency)
    : null;
  const formattedDateDisplay = selection
    ? selection.dateLabel ||
      (selection.date ? formatTripDate(selection.date) : "Flexible dates")
    : "";

  return (
    <CheckoutContext value={contextValue}>
      {isOwnerMode && historyError && (
        <p
          role="status"
          className="mb-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900"
        >
          Your booking steps could not be loaded.{" "}
          <button onClick={() => void refresh()} className="underline">
            Try again
          </button>
        </p>
      )}
      {isOwnerMode && uniqueAttempts.length > 0 && (
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
                        mode: "viator_hosted",
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
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/60 sm:items-center sm:p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
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
              type="button"
              aria-label="Close checkout review"
              disabled={busy}
              onClick={close}
              className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </button>
            <ShieldCheck
              className="mb-4 h-7 w-7 text-[#0F766E]"
              aria-hidden="true"
            />
            <h2
              id="checkout-title"
              className="max-w-sm pr-6 font-editorial text-3xl leading-tight tracking-tight text-slate-900"
            >
              Your next step, with {selection.resolvedPartnerLabel}
            </h2>

            {/* 3-row summary card */}
            <div className="mt-5 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-[#FAF8F3]">
              {/* Row 1: Experience / Partner + Price */}
              <div className="flex items-start justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">
                    {selection.name}
                  </p>
                  <p className="mt-0.5 text-xs font-medium text-slate-600">
                    Partner: {selection.resolvedPartnerLabel}
                  </p>
                </div>
                {validSelectionPrice && (
                  <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-900 ring-1 ring-slate-200">
                    Est.{" "}
                    {formatEstimate(
                      validSelectionPrice.amount,
                      validSelectionPrice.currency,
                    )}
                  </span>
                )}
              </div>

              {/* Row 2: Date / Route + Travelers */}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 text-xs font-medium text-slate-700">
                <span className="inline-flex items-center gap-1.5">
                  <Calendar
                    className="h-4 w-4 text-slate-600"
                    aria-hidden="true"
                  />
                  {formattedDateDisplay}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Users
                    className="h-4 w-4 text-slate-600"
                    aria-hidden="true"
                  />
                  {travelers} {travelers === 1 ? "traveler" : "travelers"}
                </span>
              </div>

              {/* Row 3: New-tab handoff note */}
              <div className="px-4 py-3">
                <p
                  id="checkout-description"
                  className="text-xs leading-relaxed text-slate-700"
                >
                  Opens {selection.resolvedPartnerLabel} in a new tab to confirm
                  final price and terms. Your Faroway itinerary stays saved.
                </p>
              </div>
            </div>

            {previouslyPrepared && (
              <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
                Already paid? Check {selection.resolvedPartnerLabel}’s
                confirmation email before continuing.
              </p>
            )}
            {error && (
              <p role="alert" className="mt-4 text-sm text-red-700">
                {error} Your plan is still saved.
              </p>
            )}

            <button
              type="button"
              onClick={() => void continueToProvider()}
              disabled={
                busy || (selection.resolvedMode === "viator_hosted" && !enabled)
              }
              className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary-700 px-5 py-3 font-semibold text-white transition-colors hover:bg-primary-800 disabled:opacity-50"
            >
              {busy
                ? "Preparing your booking step…"
                : `Continue to ${selection.resolvedPartnerLabel}`}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
            <AffiliateDisclosure className="mt-3 text-center text-xs text-slate-600" />
            <button
              type="button"
              onClick={close}
              disabled={busy}
              className="mt-1 min-h-11 w-full text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              Keep planning
            </button>
          </div>
        </div>
      )}
    </CheckoutContext>
  );
}
