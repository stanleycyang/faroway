"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import { removeLocalRetry } from "@/lib/trips/remove-local-retry";
import {
  PlanCommand,
  PlanSaveReceipt,
  type PlanCommandInput,
} from "@/lib/trips/plan-command";

const PlanRead = z.object({
  revision: z.string().min(1),
  planRevision: z.string().nullable(),
  editable: z.boolean(),
  items: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      date: z.string(),
      period: z.string(),
      locked: z.boolean(),
    }),
  ),
  history: z.array(
    z.object({
      id: z.string(),
      requestId: z.string().nullable(),
      createdAt: z.string(),
      action: z.string().min(1),
    }),
  ),
});
type Plan = z.infer<typeof PlanRead>;
type Item = Plan["items"][number];
type Command = PlanCommandInput;

export function PlanEditor({
  tripId,
  userId,
  onSaved,
  open,
  onOpenChange,
}: {
  tripId: string;
  userId: string;
  onSaved: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [first, setFirst] = useState("");
  const [second, setSecond] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [unreadableRetry, setUnreadableRetry] = useState(false);
  const [pending, setPending] = useState<Command | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const readSequence = useRef(0);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      readSequence.current += 1;
    };
  }, []);
  const endpoint = `/api/trips/${tripId}/plan`;
  const storageKey = `faroway:plan-change:${userId}:${tripId}`;
  const refresh = useCallback(async () => {
    const sequence = ++readSequence.current;
    try {
      const response = await fetch(endpoint, {
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      });
      const data = await response.json();
      if (!mounted.current || sequence !== readSequence.current) return null;
      if (!response.ok)
        throw new Error(data.error || "Could not load plan editing.");
      const verified = PlanRead.safeParse(data);
      if (!verified.success)
        throw new Error(
          "The saved plan could not be verified. Your pending change is kept; try refreshing the saved plan.",
        );
      setPlan(verified.data);
      return verified.data;
    } catch (error) {
      if (!mounted.current || sequence !== readSequence.current) return null;
      throw error;
    }
  }, [endpoint]);
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const parsed = PlanCommand.safeParse(JSON.parse(saved));
          if (parsed.success) setPending(parsed.data);
          else {
            setUnreadableRetry(true);
            setMessage(
              "The saved retry could not be read. Your current plan is still available; review it before making a new change.",
            );
          }
        }
      } catch {
        setUnreadableRetry(true);
        setMessage(
          "Saved retry recovery is unavailable. Your current plan is still available; review it before making a new change.",
        );
      }
      void refresh().catch((error) => {
        if (mounted.current) setMessage(error.message);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [refresh, storageKey]);
  const clearPending = () => {
    // A verified server receipt can release the UI even if local cleanup fails.
    removeLocalRetry(storageKey);
    setPending(null);
  };
  const checkSaved = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const latest = await refresh();
      if (!latest) return;
      if (
        pending &&
        latest.history.some((row) => row.requestId === pending.requestId)
      ) {
        clearPending();
        setMessage("Your change was saved. The current plan is shown below.");
      } else
        setMessage(
          pending
            ? "The latest plan is loaded. Review it before retrying or discarding your pending change."
            : "The latest saved plan is loaded.",
        );
      onSaved();
    } catch (error) {
      if (!mounted.current) return;
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not check the saved plan.",
      );
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const save = async (command: Command) => {
    if (inFlight.current || unreadableRetry) return;
    inFlight.current = true;
    readSequence.current += 1;
    setBusy(true);
    setMessage(null);
    setPending(command);
    try {
      localStorage.setItem(storageKey, JSON.stringify(command));
    } catch {
      /* Server request identity still prevents replay. */
    }
    let saved = false;
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(command),
        signal: AbortSignal.timeout(20_000),
      });
      const data = await response.json();
      if (!mounted.current) return;
      const receipt = PlanSaveReceipt.safeParse(data);
      if (
        !response.ok ||
        !receipt.success ||
        receipt.data.requestId !== command.requestId ||
        receipt.data.revision === command.expectedUpdatedAt ||
        receipt.data.planRevision === command.expectedPlanRevision
      )
        throw new Error(
          typeof data?.error === "string"
            ? data.error
            : "The save could not be confirmed.",
        );
      saved = true;
      clearPending();
      setReviewing(false);
      setFirst("");
      setSecond("");
      onSaved();
      const latest = await refresh();
      if (!latest) return;
      setMessage(
        "Your plan is saved. Public sharing is off until you choose to share again.",
      );
    } catch (error) {
      if (!mounted.current) return;
      setMessage(
        saved
          ? "Your change was saved, but the updated plan could not be loaded. Refresh the saved plan; do not submit the change again."
          : `${error instanceof Error ? error.message : "The save was interrupted."} Check the saved plan before retrying; the save may already have completed.`,
      );
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const command = (
    action: Command["action"],
    itemId: string,
    otherItemId?: string,
  ): Command => ({
    requestId: crypto.randomUUID(),
    expectedUpdatedAt: plan!.revision,
    expectedPlanRevision: plan!.planRevision,
    action,
    itemId,
    ...(otherItemId ? { otherItemId } : {}),
  });
  const a = plan?.items.find((item) => item.id === first);
  const b = plan?.items.find((item) => item.id === second);
  const label = (item: Item) => `${item.name} · ${item.date} ${item.period}`;
  return (
    <details
      open={open}
      onToggle={(event) => onOpenChange?.(event.currentTarget.open)}
      className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
    >
      <summary className="cursor-pointer font-semibold text-gray-900">
        Make this plan yours{" "}
        <span className="ml-2 text-sm font-normal text-gray-500">
          Lock favorites or swap activities
        </span>
      </summary>
      <p className="mt-3 text-sm text-gray-600">
        Keep what you love and adjust the schedule. Changes do not change
        reservations. Check opening hours, availability, travel time, and
        provider dates before booking.
      </p>
      {message && (
        <p
          role="status"
          className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900"
        >
          {message}
        </p>
      )}
      {!plan && !message && (
        <p className="mt-3 text-sm">Loading your saved plan…</p>
      )}
      {message && !pending && (
        <button
          disabled={busy}
          onClick={() => void checkSaved()}
          className="min-h-11 mt-2 font-medium underline"
        >
          Refresh saved plan
        </button>
      )}
      {unreadableRetry && (
        <div
          role="status"
          className="mt-4 rounded-xl border border-amber-200 p-4"
        >
          <p className="text-sm">
            Your interrupted change could not be read. Refresh and review the
            saved plan before clearing this browser’s retry record and making a
            new change.
          </p>
          <button
            type="button"
            disabled={busy}
            className="min-h-11 mt-2 font-medium underline"
            onClick={() => {
              if (removeLocalRetry(storageKey)) {
                setUnreadableRetry(false);
                setMessage(
                  "Unreadable retry cleared from this browser. Your saved plan is unchanged.",
                );
              } else {
                setMessage(
                  "This browser could not clear the interrupted retry. Try again before making a new change.",
                );
              }
            }}
          >
            Discard unreadable retry
          </button>
        </div>
      )}
      {pending && (
        <div className="mt-4 rounded-xl border border-amber-200 p-4">
          <p className="text-sm">
            A plan change needs confirmation. It will not be retried
            automatically.
          </p>
          <div className="mt-2 flex flex-wrap gap-4">
            <button
              disabled={busy}
              onClick={() => void checkSaved()}
              className="min-h-11 font-medium underline"
            >
              Check saved plan
            </button>
            <button
              disabled={busy || !plan?.editable}
              onClick={() => void save(pending)}
              className="min-h-11 font-medium underline"
            >
              Retry saved change
            </button>
            <button
              disabled={busy}
              onClick={() => {
                if (!removeLocalRetry(storageKey)) {
                  setMessage(
                    "This browser couldn’t discard the pending change. It is kept for recovery; try again before making a new change.",
                  );
                  return;
                }
                setPending(null);
                setReviewing(false);
                setMessage(
                  "Pending retry discarded from this browser. Any change already saved remains; refresh the plan to check it.",
                );
              }}
              className="min-h-11 font-medium underline"
            >
              Discard pending change
            </button>
          </div>
        </div>
      )}
      {plan && !plan.editable && (
        <p className="mt-3 text-sm">
          Finish planning for your saved brief before editing this itinerary.
        </p>
      )}
      {plan?.editable && (
        <fieldset
          disabled={busy || !!pending || unreadableRetry}
          className="mt-4 space-y-4 disabled:opacity-60"
        >
          <ul className="space-y-2">
            {plan.items.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 p-3"
              >
                <div>
                  <p className="text-sm font-medium">{item.name}</p>
                  <p className="text-xs text-gray-500">
                    {item.date} · {item.period}
                    {item.locked ? " · Locked" : ""}
                  </p>
                </div>
                <button
                  onClick={() =>
                    void save(command(item.locked ? "unlock" : "lock", item.id))
                  }
                  className="min-h-11 shrink-0 px-2 text-sm font-semibold text-primary"
                  aria-label={`${item.locked ? "Unlock" : "Lock"} ${item.name}`}
                >
                  {item.locked ? "Unlock" : "Lock"}
                </button>
              </li>
            ))}
          </ul>
          {plan.items.length === 0 && (
            <p className="text-sm text-gray-600">
              No editable activities are available in this plan yet.
            </p>
          )}
          {plan.items.filter((item) => !item.locked).length > 1 && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                First activity
                <select
                  value={first}
                  onChange={(e) => {
                    setFirst(e.target.value);
                    setReviewing(false);
                  }}
                  className="mt-1 w-full rounded-xl border p-3"
                >
                  <option value="">Choose an activity</option>
                  {plan.items
                    .filter((item) => !item.locked && item.id !== second)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {label(item)}
                      </option>
                    ))}
                </select>
              </label>
              <label className="text-sm">
                Swap with
                <select
                  value={second}
                  onChange={(e) => {
                    setSecond(e.target.value);
                    setReviewing(false);
                  }}
                  className="mt-1 w-full rounded-xl border p-3"
                >
                  <option value="">Choose an activity</option>
                  {plan.items
                    .filter((item) => !item.locked && item.id !== first)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {label(item)}
                      </option>
                    ))}
                </select>
              </label>
              <button
                disabled={!a || !b}
                onClick={() => setReviewing(true)}
                className="min-h-11 rounded-full bg-primary px-5 py-2 font-semibold text-white disabled:opacity-40 sm:col-span-2"
              >
                Review swap
              </button>
            </div>
          )}
          {reviewing && a && b && (
            <section
              aria-label="Review activity swap"
              className="rounded-xl border border-primary-100 bg-primary-50 p-4 text-sm"
            >
              <p>
                <strong>{a.name}</strong> moves to {b.date}, {b.period}.
              </p>
              <p className="mt-2">
                <strong>{b.name}</strong> moves to {a.date}, {a.period}.
              </p>
              <p className="mt-3">
                All other choices stay in place. Prices and availability are not
                reverified by this swap. Your public link will be turned off.
              </p>
              <div className="mt-3 flex gap-4">
                <button
                  onClick={() => void save(command("swap", a.id, b.id))}
                  className="min-h-11 font-semibold text-primary"
                >
                  Confirm swap
                </button>
                <button
                  onClick={() => setReviewing(false)}
                  className="min-h-11 underline"
                >
                  Keep current plan
                </button>
              </div>
            </section>
          )}
        </fieldset>
      )}
      {!!plan?.history.length && (
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer text-gray-600">
            Saved plan history
          </summary>
          <ul className="mt-2 space-y-1">
            {plan.history.map((row) => (
              <li key={row.id}>
                {row.action === "baseline"
                  ? "Original plan preserved"
                  : `${row.action[0].toUpperCase()}${row.action.slice(1)} saved`}{" "}
                · {new Date(row.createdAt).toLocaleString()}
              </li>
            ))}
          </ul>
        </details>
      )}
    </details>
  );
}
