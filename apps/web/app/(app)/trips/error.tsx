"use client";

import Link from "next/link";
import { TripRecovery } from "@/components/trips/TripRecovery";

export default function TripsError({ reset }: { reset: () => void }) {
  return (
    <TripRecovery
      eyebrow="Your journey"
      title="Your trip couldn’t load"
      description="Try loading it again in a moment. If you recently saved a change, check the trip before submitting it again."
      reset={reset}
    >
      <Link
        href="/dashboard"
        className="inline-flex min-h-11 items-center text-sm font-semibold text-slate-700 underline underline-offset-4"
      >
        Back to my trips
      </Link>
      <Link
        href="/support"
        className="inline-flex min-h-11 items-center text-sm font-semibold text-slate-700 underline underline-offset-4"
      >
        Get help
      </Link>
    </TripRecovery>
  );
}
