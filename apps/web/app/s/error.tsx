"use client";

import Link from "next/link";
import { TripRecovery } from "@/components/trips/TripRecovery";

export default function SharedTripError({ reset }: { reset: () => void }) {
  return (
    <TripRecovery
      eyebrow="A shared journey"
      title="This itinerary is taking a moment"
      description="We couldn’t load the shared trip. Try again in a moment. This error doesn’t confirm whether the owner has changed the link."
      reset={reset}
    >
      <Link
        href="/support"
        className="inline-flex min-h-11 items-center text-sm font-semibold text-slate-700 underline underline-offset-4"
      >
        Get help
      </Link>
    </TripRecovery>
  );
}
