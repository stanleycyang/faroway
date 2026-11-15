import { expect, it, vi } from "vitest";
import rome from "../../../../scripts/fixtures/agentic-rome-overload.json";
import { compileSchedule } from "@/lib/search/schedule-compiler";
import { repairDiningInventory } from "@/lib/search/repair-dining-inventory";
import type {
  ActivityResult,
  DiningResult,
  SearchPlan,
} from "@/lib/search/types";
const plan = {
  ...(rome.trace.steps[0].output as unknown as SearchPlan),
  dates: { start: "2027-01-11", end: "2027-01-11", nights: 0 },
  mobilityNeeds: undefined,
  requirements: undefined,
};
const location = {
  name: "Test district",
  address: "Test street",
  neighborhood: "Test district",
  lat: 41.9,
  lng: 12.5,
};
const visit = {
  ...(rome.trace.steps[2].output as unknown as ActivityResult[])[0],
  id: "visit",
  name: "Test museum",
  duration: 60,
  bestTimeOfDay: "morning" as const,
  location,
};
const nearby = ["breakfast", "lunch", "dinner"].map((type) => ({
  ...(rome.trace.steps[3].output as unknown as DiningResult[])[0],
  id: type,
  name: `Test ${type}`,
  mealTypes: [type],
  location,
})) as DiningResult[];
const compile = (dining: DiningResult[]) =>
  compileSchedule(plan, [visit], dining, [], {
    maxUnverifiedMealDistanceKm: 3,
  });
it("repairs missing local meal inventory once and recompiles with the same screens", async () => {
  const discover = vi.fn().mockResolvedValue(nearby);
  const result = await repairDiningInventory([], compile, discover);
  expect(discover).toHaveBeenCalledTimes(1);
  expect(discover).toHaveBeenCalledWith(
    [{ area: "Test district", mealTypes: ["breakfast", "lunch", "dinner"] }],
    [],
  );
  expect(result.dining).toHaveLength(3);
  expect(result.compiled.days[0].morning.meal?.id).toBe("breakfast");
  expect(result.compiled.days[0].afternoon.meal?.id).toBe("lunch");
  expect(result.compiled.days[0].evening.meal?.id).toBe("dinner");
  expect(result.compiled.days[0].timingProposal?.fitsPolicy).toBe(true);
});
it("does not retry when existing inventory covers the day", async () => {
  const discover = vi.fn();
  await repairDiningInventory(nearby, compile, discover);
  expect(discover).not.toHaveBeenCalled();
});
it("repairs named and addressed inventory even when neighborhood metadata is absent", async () => {
  const withoutNeighborhood = {
    ...visit,
    location: { ...location, neighborhood: undefined },
  };
  const discover = vi.fn().mockResolvedValue(nearby);
  const result = await repairDiningInventory(
    [],
    (inventory) =>
      compileSchedule(plan, [withoutNeighborhood], inventory, [], {
        maxUnverifiedMealDistanceKm: 3,
      }),
    discover,
  );
  expect(discover).toHaveBeenCalledExactlyOnceWith(
    [
      {
        area: "Test district, Test street",
        mealTypes: ["breakfast", "lunch", "dinner"],
      },
    ],
    [],
  );
  expect(result.compiled.days[0].morning.meal?.id).toBe("breakfast");
  expect(result.compiled.days[0].afternoon.meal?.id).toBe("lunch");
  expect(result.compiled.days[0].evening.meal?.id).toBe("dinner");
});
it("retains gaps when the retry supplies only distant or excluded restaurants", async () => {
  const distant = nearby.map((meal) => ({
    ...meal,
    location: { ...location, lat: 43 },
  }));
  const discover = vi
    .fn()
    .mockResolvedValue([
      ...distant,
      { ...nearby[0], id: "idea", planningIdea: true },
    ]);
  const result = await repairDiningInventory([], compile, discover);
  expect(discover).toHaveBeenCalledTimes(1);
  expect(result.dining).toHaveLength(3);
  expect(
    result.compiled.issues.filter((issue) =>
      issue.endsWith(":meal_supply_gap"),
    ),
  ).toHaveLength(3);
});
it("never repairs a deliberately unavailable meal window", async () => {
  const unavailable = {
    ...plan,
    mobilityNeeds: "Working 09:00–17:00 on each trip day; only evening visits",
  };
  const discover = vi.fn().mockResolvedValue([]);
  await repairDiningInventory(
    [],
    (inventory) =>
      compileSchedule(
        unavailable,
        [{ ...visit, bestTimeOfDay: "evening" }],
        inventory,
      ),
    discover,
  );
  expect(discover).toHaveBeenCalledTimes(1);
  expect(discover.mock.calls[0][0][0].mealTypes).not.toContain("lunch");
});
