"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useHydrated } from "@/hooks/useHydrated";

const reasons = [
  { value: "offensive", label: "Offensive or hateful content" },
  { value: "harassment", label: "Harassment or abuse" },
  { value: "unsafe", label: "Unsafe travel advice" },
  { value: "spam", label: "Spam or misleading content" },
  { value: "privacy", label: "Personal or private information" },
  { value: "other", label: "Something else" },
] as const;

interface ReportState {
  status: "idle" | "submitted" | "error";
  error: string | null;
}

interface SharedItineraryReportFormProps {
  token: string;
}

export function SharedItineraryReportForm({
  token,
}: SharedItineraryReportFormProps) {
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(token)) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
        Open this page from a shared itinerary report link so Faroway can
        identify the content.
      </div>
    );
  }
  return <ReportForm key={token} token={token} />;
}

function ReportForm({ token }: SharedItineraryReportFormProps) {
  const hydrated = useHydrated();
  const submissionLock = useRef(false);
  const active = useRef(true);
  const successRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const [reason, setReason] =
    useState<(typeof reasons)[number]["value"]>("offensive");
  const [details, setDetails] = useState("");
  const [reporterEmail, setReporterEmail] = useState("");
  const [state, submitAction, pending] = useActionState<ReportState, FormData>(
    async (previous, formData) => {
      const payload = {
        contentType: "shared_trip",
        token,
        reason: formData.get("reason"),
        details: formData.get("details"),
        reporterEmail: formData.get("reporterEmail"),
      };
      try {
        const response = await fetch("/api/content-reports", {
          method: "POST",
          signal: AbortSignal.timeout(20_000),
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const body = await response.json().catch(() => null);
        if (!active.current) return previous;
        if (!response.ok || body?.success !== true) {
          throw new Error(
            body?.error ||
              "Your report could not be confirmed. Your details are kept; please try again.",
          );
        }
        return { status: "submitted", error: null };
      } catch (error) {
        if (!active.current) return previous;
        return {
          status: "error",
          error:
            error instanceof Error &&
            error.name !== "TimeoutError" &&
            error.name !== "AbortError"
              ? error.message
              : "The report took too long to confirm. Your details are kept. It may have arrived; please wait before retrying.",
        };
      } finally {
        submissionLock.current = false;
      }
    },
    { status: "idle", error: null },
  );
  useEffect(() => {
    if (state.status === "submitted") successRef.current?.focus();
  }, [state.status]);

  if (state.status === "submitted") {
    return (
      <div
        ref={successRef}
        tabIndex={-1}
        role="status"
        className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-900"
      >
        Thanks. Faroway support will review the shared itinerary and take action
        where appropriate.
      </div>
    );
  }

  return (
    <form
      action={submitAction}
      onSubmit={(event) => {
        if (!hydrated || pending || submissionLock.current)
          event.preventDefault();
        else submissionLock.current = true;
      }}
      className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
    >
      <fieldset disabled={!hydrated || pending} className="space-y-5">
        <div>
          <label
            htmlFor="reason"
            className="mb-2 block text-sm font-semibold text-gray-900"
          >
            Reason
          </label>
          <select
            id="reason"
            name="reason"
            value={reason}
            onChange={(event) => setReason(event.target.value as typeof reason)}
            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none ring-primary/20 transition focus:border-primary focus:ring-4"
          >
            {reasons.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="details"
            className="mb-2 block text-sm font-semibold text-gray-900"
          >
            Details
          </label>
          <textarea
            id="details"
            name="details"
            value={details}
            onChange={(event) => setDetails(event.target.value)}
            maxLength={1000}
            rows={5}
            className="w-full resize-none rounded-xl border border-gray-300 px-4 py-3 text-gray-900 outline-none ring-primary/20 transition focus:border-primary focus:ring-4"
          />
        </div>

        <div>
          <label
            htmlFor="email"
            className="mb-2 block text-sm font-semibold text-gray-900"
          >
            Email
          </label>
          <input
            id="email"
            name="reporterEmail"
            maxLength={254}
            type="email"
            value={reporterEmail}
            onChange={(event) => setReporterEmail(event.target.value)}
            placeholder="Optional"
            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 outline-none ring-primary/20 transition focus:border-primary focus:ring-4"
          />
        </div>

        {state.error && (
          <p
            role="alert"
            className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={!hydrated || pending}
          className="inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-5 py-3 font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Submitting..." : "Submit Report"}
        </button>
      </fieldset>
    </form>
  );
}
