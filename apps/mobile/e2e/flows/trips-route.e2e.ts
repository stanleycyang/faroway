import { by, device, element, expect } from "detox";
import { e2eIds } from "../testIds";

describe("FlowC_TripsLibraryOpen", () => {
  it("renders trips tab entry route", async () => {
    await device.launchApp({
      newInstance: true,
      url: "faroway://(tabs)/trips",
    });

    await expect(element(by.id(e2eIds.trips.screen))).toBeVisible();
  });
});
