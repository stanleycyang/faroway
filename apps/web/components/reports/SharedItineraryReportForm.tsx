"use client";

import { FormEvent, useState } from "react";

const reasons = [
  { value: "offensive", label: "Offensive or hateful content" },
  { value: "harassment", label: "Harassment or abuse" },
  { value: "unsafe", label: "Unsafe travel advice" },
  { value: "spam", label: "Spam or misleading content" },
  { value: "privacy", label: "Personal or private information" },
  { value: "other", label: "Something else" },
] as const;

type ReportState = "idle" | "submitting" | "submitted" | "error";

interface SharedItineraryReportFormProps {
  token: string;
}

export function SharedItineraryReportForm({
  token,
}: SharedItineraryReportFormProps) {
  const [reason, setReason] =
    useState<(typeof reasons)[number]["value"]>("offensive");
  const [details, setDetails] = useState("");
  const [reporterEmail, setReporterEmail] = useState("");
  const [status, setStatus] = useState<ReportState>("idle");
  const [error, setError] = useState<string | null>(null);

  const submitReport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("submitting");
    setError(null);

    try {
      const response = await fetch("/api/content-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentType: "shared_trip",
          token,
          reason,
          details,
          reporterEmail,
        }),
      });

      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(body.error || "Failed to submit report");
      }

      setStatus("submitted");
      setDetails("");
      setReporterEmail("");
    } catch (submitError) {
      setStatus("error");
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to submit report",
      );
    }
  };

  if (!token) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
        Open this page from a shared itinerary report link so Faroway can
        identify the content.
      </div>
    );
  }

  if (status === "submitted") {
    return (
      <div
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
      onSubmit={submitReport}
      className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
    >
      <div className="space-y-5">
        <div>
          <label
            htmlFor="reason"
            className="mb-2 block text-sm font-semibold text-gray-900"
          >
            Reason
          </label>
          <select
            id="reason"
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
            type="email"
            value={reporterEmail}
            onChange={(event) => setReporterEmail(event.target.value)}
            placeholder="Optional"
            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 outline-none ring-primary/20 transition focus:border-primary focus:ring-4"
          />
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={status === "submitting"}
          className="inline-flex w-full items-center justify-center rounded-xl bg-primary px-5 py-3 font-bold text-white transition hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === "submitting" ? "Submitting..." : "Submit Report"}
        </button>
      </div>
    </form>
  );
}
