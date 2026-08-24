"use client";

import { useState } from "react";
import { Check, Loader2, Star } from "lucide-react";

const feedbackTags = [
  { value: "great_fit", label: "Felt made for me" },
  { value: "easy_to_use", label: "Easy to use" },
  { value: "incorrect", label: "Something was incorrect" },
  { value: "generic", label: "Too generic" },
  { value: "missing_places", label: "Missing key places" },
  { value: "unrealistic_pacing", label: "Pacing felt unrealistic" },
  { value: "budget_mismatch", label: "Didn’t match my budget" },
] as const;

interface TripFeedbackProps {
  tripId: string;
}

export function TripFeedback({ tripId }: TripFeedbackProps) {
  const [score, setScore] = useState<number | null>(null);
  const [wouldUseAgain, setWouldUseAgain] = useState<boolean | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleTag = (value: string) => {
    setSelectedTags((current) =>
      current.includes(value)
        ? current.filter((tag) => tag !== value)
        : current.length < 5
          ? [...current, value]
          : current,
    );
  };

  const submit = async () => {
    if (!score || submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/trips/${tripId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          score,
          wouldUseAgain: wouldUseAgain ?? undefined,
          issueTags: selectedTags,
          comment: comment.trim() || undefined,
          source: "web",
        }),
      });

      if (!response.ok) {
        throw new Error("Couldn’t save your feedback. Please try again.");
      }
      setSubmitted(true);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Couldn’t save your feedback.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <section className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <Check className="mx-auto mb-2 h-6 w-6 text-emerald-700" />
        <h2 className="font-bold text-emerald-950">Thanks for the signal</h2>
        <p className="mt-1 text-sm text-emerald-800">
          Your feedback will guide the next itinerary-quality improvements.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
      <h2 className="text-lg font-bold text-gray-900">
        How useful was this itinerary?
      </h2>
      <p className="mt-1 text-sm text-gray-600">
        A quick rating helps us improve recommendations and pacing.
      </p>

      <fieldset className="mt-5">
        <legend className="sr-only">Itinerary usefulness rating</legend>
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              aria-label={`${value} out of 5`}
              aria-pressed={score === value}
              onClick={() => setScore(value)}
              className={`inline-flex h-11 w-11 items-center justify-center rounded-xl border transition-colors ${
                score === value
                  ? "border-amber-400 bg-amber-50 text-amber-600"
                  : "border-gray-200 text-gray-400 hover:border-amber-300 hover:text-amber-500"
              }`}
            >
              <Star
                className={`h-5 w-5 ${score === value ? "fill-current" : ""}`}
              />
              <span className="sr-only">{value}</span>
            </button>
          ))}
        </div>
      </fieldset>

      {score ? (
        <>
          <fieldset className="mt-6">
            <legend className="text-sm font-semibold text-gray-900">
              Would you use Faroway for another trip?
            </legend>
            <div className="mt-2 flex gap-2">
              {[
                { value: true, label: "Yes" },
                { value: false, label: "Not yet" },
              ].map((option) => (
                <button
                  key={option.label}
                  type="button"
                  aria-pressed={wouldUseAgain === option.value}
                  onClick={() => setWouldUseAgain(option.value)}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                    wouldUseAgain === option.value
                      ? "border-primary bg-primary-50 text-primary-700"
                      : "border-gray-200 text-gray-600 hover:border-primary-300"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="mt-6">
            <legend className="text-sm font-semibold text-gray-900">
              What stood out?
            </legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {feedbackTags.map((tag) => {
                const selected = selectedTags.includes(tag.value);
                return (
                  <button
                    key={tag.value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleTag(tag.value)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                      selected
                        ? "border-primary bg-primary-50 text-primary-700"
                        : "border-gray-200 text-gray-600 hover:border-primary-300"
                    }`}
                  >
                    {tag.label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <label className="mt-6 block text-sm font-semibold text-gray-900">
            Anything else?{" "}
            <span className="font-normal text-gray-500">(optional)</span>
            <textarea
              value={comment}
              maxLength={1000}
              onChange={(event) => setComment(event.target.value)}
              rows={3}
              className="mt-2 block w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-normal text-gray-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder="Tell us what would make this plan more useful."
            />
          </label>

          {error ? (
            <p role="alert" className="mt-3 text-sm text-red-600">
              {error}
            </p>
          ) : null}

          <button
            type="button"
            disabled={submitting}
            onClick={submit}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {submitting ? "Saving…" : "Send feedback"}
          </button>
        </>
      ) : null}
    </section>
  );
}
