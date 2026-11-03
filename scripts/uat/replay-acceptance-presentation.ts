/** Replay saved acceptance receipts without authentication or paid model calls. */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { transformItineraryDays } from "../../apps/mobile/lib/itineraryNormalization";
import { isGenericEventTitle } from "../../apps/web/lib/search/speculative-event";

const base = process.argv[2];
if (!base)
  throw new Error("Pass the directory containing saved acceptance cases");
const results = [];
for (const name of readdirSync(base).sort()) {
  if (
    !/^(lisbon|copenhagen|edinburgh|new-york|melbourne|interlaken)-[12]$/.test(
      name,
    )
  )
    continue;
  const receipt = JSON.parse(
    readFileSync(join(base, name, "saved.json"), "utf8"),
  );
  const sourceDays = receipt.body.itinerary.days;
  const days = transformItineraryDays(sourceDays);
  let meals = 0;
  for (const day of days) {
    for (const slot of ["morning", "afternoon"] as const) {
      const block = day.activities.filter((a) => a.scheduleSlot === slot);
      const firstVisit = block.findIndex((a) => a.type !== "restaurant");
      if (
        firstVisit >= 0 &&
        block.slice(firstVisit).some((a) => a.type === "restaurant")
      )
        throw new Error(`${name}: meal follows ${slot} visit`);
    }
    for (const meal of day.activities.filter((a) => a.type === "restaurant")) {
      meals++;
      if (meal.duration === "Duration not set")
        throw new Error(`${name}: absent-duration placeholder`);
    }
  }
  const cached = transformItineraryDays(JSON.parse(JSON.stringify(days)));
  if (
    JSON.stringify(cached.map((d) => d.activities.map((a) => a.id))) !==
    JSON.stringify(days.map((d) => d.activities.map((a) => a.id)))
  )
    throw new Error(`${name}: order changed on cache reload`);
  results.push({
    case: name,
    days: days.length,
    meals,
    presentationReplayPassed: true,
    genericEventsNowDeferred: days
      .flatMap((d) => d.activities)
      .filter((a) => a.type !== "restaurant" && isGenericEventTitle(a.title))
      .map((a) => a.title),
    scope:
      "Saved-receipt replay only; not a rebuilt APK or live itinerary acceptance",
  });
}
if (results.length !== 12)
  throw new Error(`Expected twelve receipts, found ${results.length}`);
console.log(JSON.stringify(results, null, 2));
