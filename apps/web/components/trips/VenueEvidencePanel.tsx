"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { TripDay } from "@faroway/types";
import { z } from "zod";
import { useUser } from "@/hooks/useUser";

import {
  VenueEvidence as Evidence,
  VenueEvidenceRead,
} from "@/lib/trips/venue-evidence";

const labels = {
  allergy: "Food allergy",
  dietary: "Dietary preference",
  step_free_entrance: "Step-free entrance",
  accessible_restroom: "Accessible restroom",
  accessible_seating: "Accessible seating",
  accessible_parking: "Accessible parking",
  other_mobility: "Other mobility need",
} as const;
type Entry = z.infer<typeof Evidence>;

/** Owner-only, user-reported evidence; never treated as provider verification. */
type PanelProps = {
  tripId: string;
  ownerId: string;
  revision: string;
  days: TripDay[];
};
export function VenueEvidencePanel(props: PanelProps) {
  const account = useUser();
  if (account.loading || account.session?.user.id !== props.ownerId)
    return null;
  return (
    <VenueEvidenceSession
      key={`${props.tripId}:${props.revision}:${account.accountRevision}:${account.session.user.id}`}
      {...props}
    />
  );
}

function VenueEvidenceSession({ tripId, revision, days }: PanelProps) {
  const venues = useMemo(() => {
    const result = new Map<string, string>();
    for (const day of days)
      for (const slot of [day.morning, day.afternoon, day.evening]) {
        for (const item of [
          ...(slot?.activities ?? []),
          ...(slot?.meals ?? []),
        ]) {
          if (
            typeof item?.id === "string" &&
            item.id &&
            typeof item.name === "string" &&
            item.name.trim()
          )
            result.set(item.id, item.name);
        }
      }
    return [...result].map(([id, name]) => ({ id, name }));
  }, [days]);
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [venueId, setVenueId] = useState("");
  const [requirement, setRequirement] =
    useState<Entry["requirement"]>("allergy");
  const [status, setStatus] = useState<Entry["status"]>("unknown");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [evidenceRevision, setEvidenceRevision] = useState<string | null>(null);
  const active = useRef(true);
  const lock = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(
          `/api/trips/${encodeURIComponent(tripId)}/venue-evidence?tripRevision=${encodeURIComponent(revision)}`,
          { cache: "no-store", signal: controller.signal },
        );
        const body = await response.json();
        const parsed = VenueEvidenceRead.safeParse(body);
        if (
          !response.ok ||
          !parsed.success ||
          Date.parse(parsed.data.tripRevision) !== Date.parse(revision)
        )
          throw new Error();
        if (!controller.signal.aborted) {
          setEntries(parsed.data.evidence);
          setEvidenceRevision(parsed.data.evidenceRevision);
          setLoaded(true);
        }
      } catch {
        if (!controller.signal.aborted)
          setMessage("Could not load your confirmations. Try again.");
      }
    })();
    return () => controller.abort();
  }, [open, tripId, revision]);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (
      !loaded ||
      !evidenceRevision ||
      lock.current ||
      !venues.some((venue) => venue.id === venueId) ||
      (status !== "unknown" && !note.trim())
    )
      return;
    lock.current = true;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(
        `/api/trips/${encodeURIComponent(tripId)}/venue-evidence`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            evidenceRevision,
            venueId,
            requirement,
            status,
            note: note.trim(),
          }),
        },
      );
      const body = await response.json();
      const parsed = Evidence.safeParse(body?.evidence);
      if (
        !response.ok ||
        !parsed.success ||
        parsed.data.venue_id !== venueId ||
        parsed.data.requirement !== requirement ||
        parsed.data.status !== status ||
        parsed.data.note !== note.trim() ||
        parsed.data.evidence_revision !== evidenceRevision
      )
        throw new Error();
      if (!active.current) return;
      setEntries((current) => [
        ...current.filter(
          (entry) =>
            entry.venue_id !== venueId || entry.requirement !== requirement,
        ),
        parsed.data,
      ]);
      setMessage("Your report was saved. Confirm again before visiting.");
    } catch {
      if (active.current)
        setMessage(
          "Could not confirm the save. Reload this trip before trying again.",
        );
    } finally {
      lock.current = false;
      if (active.current) setBusy(false);
    }
  }
  if (!venues.length) return null;
  return (
    <section
      className="my-6 rounded-2xl border border-gray-200 bg-white p-5"
      aria-label="Venue confirmations"
    >
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setLoaded(false);
          setEntries([]);
          setEvidenceRevision(null);
          setMessage("");
          setOpen(!open);
        }}
        aria-expanded={open}
        className="font-semibold text-slate-900"
      >
        Venue confirmations
      </button>
      {open && (
        <div className="mt-3 space-y-4 text-sm text-slate-700">
          <p>
            Record what a venue told you. These are your reports, not
            independent verification. Confirm allergies, cross-contact and
            accessibility directly before visiting. Reports are private and
            apply only to this saved plan. Reports do not automatically change
            your itinerary. Replace venues that cannot meet your needs.
          </p>
          {entries.map((entry) => (
            <p key={`${entry.venue_id}:${entry.requirement}`}>
              <strong>
                {venues.find((venue) => venue.id === entry.venue_id)?.name ??
                  "Venue"}
              </strong>{" "}
              · {labels[entry.requirement]} ·{" "}
              {entry.status === "confirmed"
                ? "You reported confirmed"
                : entry.status === "contradicted"
                  ? "You reported unavailable"
                  : "Unknown"}{" "}
              · {new Date(entry.observed_at).toLocaleDateString()}
              {entry.note ? ` · ${entry.note}` : ""}
            </p>
          ))}
          <form onSubmit={save} className="grid gap-3">
            <label>
              Venue{" "}
              <select
                className="mt-1 block w-full rounded-lg border p-2"
                value={venueId}
                onChange={(event) => setVenueId(event.target.value)}
                required
              >
                <option value="">Choose a venue</option>
                {venues.map((venue) => (
                  <option key={venue.id} value={venue.id}>
                    {venue.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Requirement{" "}
              <select
                className="mt-1 block w-full rounded-lg border p-2"
                value={requirement}
                onChange={(event) =>
                  setRequirement(event.target.value as Entry["requirement"])
                }
              >
                {Object.entries(labels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              What did the venue say?{" "}
              <select
                className="mt-1 block w-full rounded-lg border p-2"
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as Entry["status"])
                }
              >
                <option value="unknown">Unknown</option>
                <option value="confirmed">Reported available</option>
                <option value="contradicted">Reported unavailable</option>
              </select>
            </label>
            <label>
              Details and who you spoke with{" "}
              <textarea
                className="mt-1 block w-full rounded-lg border p-2"
                maxLength={500}
                required={status !== "unknown"}
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </label>
            <button
              type="submit"
              disabled={busy || !loaded || !venueId}
              className="min-h-11 rounded-full bg-slate-900 px-4 py-2 font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save my report"}
            </button>
          </form>
          {message && <p role="status">{message}</p>}
        </div>
      )}
    </section>
  );
}
