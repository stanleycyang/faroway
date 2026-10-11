"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  BookingReportCommand,
  bookingLabels,
  type BookingReportInput,
} from "@/lib/trips/booking-checklist";
type Status = BookingReportInput["status"];
interface Item {
  id: string;
  name: string;
  date: string;
  status: Status;
  reportId: string | null;
  needsReview: boolean;
}
interface Checklist {
  revision: string;
  generationId: string;
  editable: boolean;
  receipt: boolean;
  items: Item[];
  earlier: { id: string; name: string; date: string; status: Status }[];
}
export function BookingChecklist({
  tripId,
  userId,
}: {
  tripId: string;
  userId: string;
}) {
  const [data, setData] = useState<Checklist | null>(null);
  const [pending, setPending] = useState<BookingReportInput | null>(null);
  const [review, setReview] = useState<{
    command: BookingReportInput;
    name: string;
  } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const endpoint = `/api/trips/${tripId}/bookings`;
  const key = `faroway:booking-report:${userId}:${tripId}`;
  const refresh = useCallback(
    async (requestId?: string) => {
      const response = await fetch(
        endpoint + (requestId ? `?requestId=${requestId}` : ""),
        { cache: "no-store", signal: AbortSignal.timeout(15_000) },
      );
      const value = await response.json();
      if (!response.ok)
        throw new Error(value.error || "Could not load booking progress.");
      setData(value as Checklist);
      return value as Checklist;
    },
    [endpoint],
  );
  const clearPending = () => {
    setPending(null);
    try {
      localStorage.removeItem(key);
    } catch {
      /* In-memory recovery remains available. */
    }
  };
  useEffect(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed = BookingReportCommand.safeParse(JSON.parse(stored));
        if (parsed.success) setPending(parsed.data);
      }
    } catch {
      /* The server still fences request identity. */
    }
    void refresh().catch((error) => setMessage(error.message));
  }, [key, refresh]);
  const check = async () => {
    if (saving.current) return;
    setBusy(true);
    try {
      const latest = await refresh(pending?.requestId);
      if (pending && latest.receipt) {
        clearPending();
        setMessage(
          "Your earlier report was saved. The latest progress is shown; review any trip changes.",
        );
      } else
        setMessage(
          pending
            ? "No saved receipt was found. Review the current trip before retrying or discarding this report."
            : "Your latest saved progress is shown.",
        );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not check saved progress.",
      );
    } finally {
      setBusy(false);
    }
  };
  const save = async (command: BookingReportInput) => {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setMessage(null);
    setPending(command);
    try {
      localStorage.setItem(key, JSON.stringify(command));
    } catch {
      /* Request IDs remain server-verified. */
    }
    let saved = false;
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(command),
        signal: AbortSignal.timeout(20_000),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Save not confirmed.");
      saved = true;
      setData(null);
      clearPending();
      setReview(null);
      await refresh();
      setMessage(
        "Your report is saved. It is not provider confirmation or proof of commission.",
      );
    } catch (error) {
      setMessage(
        saved
          ? "Your report was saved, but progress could not refresh. Refresh saved progress; do not submit it again."
          : `${error instanceof Error ? error.message : "Save interrupted."} Check saved progress before retrying.`,
      );
    } finally {
      saving.current = false;
      setBusy(false);
    }
  };
  return (
    <section
      aria-label="Booking checklist"
      className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
    >
      <h2 className="text-lg font-bold text-gray-900">Booking checklist</h2>
      <p className="mt-1 text-sm text-gray-600">
        Keep track of activities to arrange. Some activities need no
        reservation. Opening a provider page does not confirm a booking.
      </p>
      <p className="mt-2 rounded-lg bg-slate-50 p-3 text-sm">
        Provider verification is not connected. All booked or opened statuses
        here are reported by you; none are independently verified. Prices,
        reservations and commissions are not confirmed by this checklist.
      </p>
      {message && (
        <p role="status" className="mt-3 text-sm">
          {message}
        </p>
      )}
      <button
        onClick={() => void check()}
        disabled={busy}
        className="min-h-11 mt-2 font-medium underline"
      >
        Refresh saved progress
      </button>
      {pending && (
        <div className="mt-3 rounded-lg border border-amber-200 p-3">
          <p className="text-sm">
            An interrupted report is waiting. Check its saved status before
            retrying. A changed trip may require a fresh review.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              disabled={busy}
              onClick={() => void check()}
              className="min-h-11 underline"
            >
              Check saved report
            </button>
            <button
              disabled={busy}
              onClick={() => void save(pending)}
              className="min-h-11 underline"
            >
              Retry same report
            </button>
            <button
              disabled={busy}
              onClick={() => {
                clearPending();
                setReview(null);
                setMessage(
                  "Pending retry discarded. Any report already saved on the server remains; refresh to check it.",
                );
              }}
              className="min-h-11 underline"
            >
              Discard pending retry
            </button>
          </div>
        </div>
      )}
      {data && !data.editable && (
        <p className="mt-3 text-sm text-amber-900">
          This trip needs a current finished plan before progress can be
          updated. Earlier reports remain saved; check existing reservations
          with the provider.
        </p>
      )}
      {!data && !message && (
        <p className="mt-3 text-sm">Loading booking progress…</p>
      )}
      {data?.items.length === 0 && (
        <p className="mt-3 text-sm">No available activities to track yet.</p>
      )}
      <ul className="mt-3 space-y-3">
        {data?.items.map((item) => (
          <li key={item.id} className="rounded-xl border border-gray-200 p-3">
            <h3 className="font-semibold">{item.name}</h3>
            <p className="text-sm text-gray-600">{item.date}</p>
            <p className="mt-1 text-sm">{bookingLabels[item.status]}</p>
            {item.needsReview && (
              <p className="mt-1 text-sm text-amber-900">
                Trip changed — review this report against your current dates and
                activity. Existing reservations were not changed.
              </p>
            )}
            {data.editable && (
              <div className="mt-2 flex flex-wrap gap-2">
                {(Object.keys(bookingLabels) as Status[]).map((status) => (
                  <button
                    key={status}
                    disabled={busy || !!pending || !data.editable}
                    onClick={() =>
                      setReview({
                        name: item.name,
                        command: {
                          requestId: crypto.randomUUID(),
                          expectedUpdatedAt: data.revision,
                          generationId: data.generationId,
                          itemId: item.id,
                          expectedReportId: item.reportId,
                          status,
                        },
                      })
                    }
                    className="min-h-11 rounded-lg border border-gray-300 px-3 text-sm disabled:opacity-50"
                  >
                    {status === "needed"
                      ? "Still needed"
                      : status === "provider_opened"
                        ? "I opened the provider"
                        : "I booked this"}
                  </button>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
      {review && !pending && (
        <div
          role="region"
          aria-label="Review booking report"
          className="mt-4 rounded-xl border border-teal-300 bg-teal-50 p-4"
        >
          <h3 className="font-semibold">Review your report</h3>
          <p className="mt-1 text-sm">
            {review.name}: {bookingLabels[review.command.status]}
          </p>
          <p className="mt-2 text-sm">
            This records your own progress only. It does not make, change or
            cancel a reservation. If you previously booked, changing this status
            does not cancel it.
          </p>
          <button
            disabled={busy}
            onClick={() => void save(review.command)}
            className="min-h-11 mt-3 rounded-lg bg-teal-800 px-4 text-white"
          >
            Save my report
          </button>
          <button
            disabled={busy}
            onClick={() => setReview(null)}
            className="min-h-11 ml-3 underline"
          >
            Keep current status
          </button>
        </div>
      )}
      {!!data?.earlier.length && (
        <details className="mt-4">
          <summary className="min-h-11 cursor-pointer font-medium">
            Reports from earlier or unavailable activities (
            {data.earlier.length})
          </summary>
          <p className="text-sm text-gray-600">
            These reports do not transfer to a new plan. Confirm dates and any
            changes directly with your provider.
          </p>
          <ul className="mt-2 space-y-2">
            {data.earlier.map((item) => (
              <li key={item.id} className="text-sm">
                {item.name} · {item.date} · {bookingLabels[item.status]}
              </li>
            ))}
          </ul>
        </details>
      )}
      <p className="mt-3 text-xs text-gray-500">
        This first checklist covers itinerary activities. Track hotel, flight
        and dining reservations with their providers.
      </p>
    </section>
  );
}
