import { NextResponse } from "next/server";

export function isPlanningPaused() {
  return process.env.FAROWAY_PLANNING_PAUSED === "true";
}

export function planningPauseResponse() {
  return isPlanningPaused()
    ? NextResponse.json(
        {
          error:
            "Planning is temporarily paused. Your saved trip is safe. Try again later.",
          code: "PLANNING_PAUSED",
        },
        {
          status: 503,
          headers: { "Retry-After": "300", "Cache-Control": "no-store" },
        },
      )
    : null;
}
