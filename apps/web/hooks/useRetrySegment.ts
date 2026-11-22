"use client";

import { useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * Error-boundary retry that also re-runs Server Components. A bare `reset()`
 * re-renders the cached RSC payload that threw, so server-side failures (for
 * example a transient database error while loading a trip) would fail again
 * without ever reaching the server.
 */
export function useRetrySegment(reset: () => void) {
  const router = useRouter();
  const [retrying, startTransition] = useTransition();
  const retry = useCallback(() => {
    startTransition(() => {
      router.refresh();
      reset();
    });
  }, [reset, router]);
  return { retry, retrying };
}
