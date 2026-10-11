"use client";
import { useCallback, useEffect, useRef, useState } from "react";

interface Item {
  id: string;
  name: string;
  date: string;
  period: string;
  locked: boolean;
}
interface Plan {
  revision: string;
  planRevision: string | null;
  editable: boolean;
  items: Item[];
  history: {
    id: string;
    requestId: string | null;
    createdAt: string;
    action: string;
  }[];
}
interface Command {
  requestId: string;
  expectedUpdatedAt: string;
  expectedPlanRevision: string | null;
  action: "lock" | "unlock" | "swap";
  itemId: string;
  otherItemId?: string;
}

export function PlanEditor({
  tripId,
  userId,
  onSaved,
}: {
  tripId: string;
  userId: string;
  onSaved: () => void;
}) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [first, setFirst] = useState("");
  const [second, setSecond] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [pending, setPending] = useState<Command | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const endpoint = `/api/trips/${tripId}/plan`;
  const storageKey = `faroway:plan-change:${userId}:${tripId}`;
  const refresh = useCallback(async () => {
    const response = await fetch(endpoint, {
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const data = await response.json();
    if (!response.ok)
      throw new Error(data.error || "Could not load plan editing.");
    setPlan(data);
    return data as Plan;
  }, [endpoint]);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) setPending(JSON.parse(saved));
    } catch {
      /* Storage may be unavailable. */
    }
    void refresh().catch((error) => setMessage(error.message));
  }, [refresh, storageKey]);
  const clearPending = () => {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      /* Keep current in-memory state usable. */
    }
    setPending(null);
  };
  const checkSaved = async () => {
    try {
      const latest = await refresh();
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
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not check the saved plan.",
      );
    }
  };
  const save = async (command: Command) => {
    if (inFlight.current) return;
    inFlight.current = true;
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
      if (!response.ok)
        throw new Error(data.error || "Could not save this change.");
      saved = true;
      clearPending();
      setReviewing(false);
      setFirst("");
      setSecond("");
      onSaved();
      await refresh();
      setMessage(
        "Your plan is saved. Public sharing is off until you choose to share again.",
      );
    } catch (error) {
      setMessage(
        saved
          ? "Your change was saved, but the updated plan could not be loaded. Refresh the saved plan; do not submit the change again."
          : `${error instanceof Error ? error.message : "The save was interrupted."} Check the saved plan before retrying; the save may already have completed.`,
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
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
    <details className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
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
                clearPending();
                setReviewing(false);
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
          disabled={busy || !!pending}
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
