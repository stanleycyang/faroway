import { Plane } from "lucide-react";
import type { TripDay } from "@faroway/types";
import { formatEstimate } from "@/lib/trips/budget";
import { parseTripDate } from "@/lib/trips/date-duration";

function formatFlightTime(value: unknown) {
  if (
    typeof value !== "string" ||
    Number.isNaN(parseTripDate(value.slice(0, 10)).getTime())
  )
    return "Time unavailable";
  const time = value.match(
    /^\d{4}-\d{2}-\d{2}T(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})?$/,
  );
  if (
    !time ||
    Number(time[1]) > 23 ||
    Number(time[2]) > 59 ||
    !Number.isFinite(Date.parse(value))
  )
    return "Time unavailable";
  // Preserve the provider's airport-local wall clock instead of the viewer's timezone.
  return `${time[1]}:${time[2]}`;
}

export function FlightLeg({
  transport,
  label,
}: {
  transport: NonNullable<TripDay["transport"]>;
  label: string;
}) {
  return (
    <div className="flex-1 min-w-0">
      <p className="text-[11px] font-semibold text-blue-400 uppercase tracking-wider mb-2">
        {label}
      </p>
      <div className="flex items-center gap-3">
        <div className="text-center min-w-[48px]">
          <p className="text-lg font-bold text-white">
            {typeof transport.departure?.airport === "string" &&
            transport.departure.airport.trim()
              ? transport.departure.airport
              : "Airport unavailable"}
          </p>
          <p className="text-[11px] text-blue-200">
            {formatFlightTime(transport.departure?.dateTime)}
          </p>
        </div>
        <div className="flex-1 flex flex-col items-center">
          <p className="text-[11px] text-blue-200 font-medium">
            {Number.isSafeInteger(transport.duration) && transport.duration > 0
              ? `${Math.floor(transport.duration / 60)}h ${transport.duration % 60}m`
              : "Duration unavailable"}
          </p>
          <div className="w-full flex items-center gap-0.5 my-0.5">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-300" />
            <div className="flex-1 h-px bg-blue-400/50" />
            <Plane className="h-3 w-3 text-blue-300 rotate-90" />
            <div className="flex-1 h-px bg-blue-400/50" />
            <div className="w-1.5 h-1.5 rounded-full bg-blue-300" />
          </div>
          <p className="text-[11px] text-blue-300">
            {Number.isSafeInteger(transport.stops) && transport.stops >= 0
              ? transport.stops === 0
                ? "Direct"
                : `${transport.stops} stop${transport.stops > 1 ? "s" : ""}`
              : "Stops unavailable"}
          </p>
        </div>
        <div className="text-center min-w-[48px]">
          <p className="text-lg font-bold text-white">
            {typeof transport.arrival?.airport === "string" &&
            transport.arrival.airport.trim()
              ? transport.arrival.airport
              : "Airport unavailable"}
          </p>
          <p className="text-[11px] text-blue-200">
            {formatFlightTime(transport.arrival?.dateTime)}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between mt-2">
        <p className="text-xs text-blue-200">
          {typeof transport.provider === "string"
            ? transport.provider
            : "Airline unavailable"}
        </p>
        <p className="text-sm font-bold text-white">
          {formatEstimate(transport.price, transport.currency)}
        </p>
      </div>
    </div>
  );
}
