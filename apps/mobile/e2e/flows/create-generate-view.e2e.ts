import { by, device, element, expect, waitFor } from "detox";
import { e2eIds } from "../testIds";

describe("FlowA_CreateGenerateView", () => {
  beforeEach(async () => {
    await device.launchApp({
      newInstance: true,
      url: "faroway://create?destination=Paris&country=France&startDate=2026-07-10&endDate=2026-07-14&travelers=2",
      permissions: { notifications: "YES" },
    });
  });

  it("starts generation from prefilled create input", async () => {
    await expect(element(by.id(e2eIds.create.screen))).toBeVisible();
    await waitFor(element(by.id(e2eIds.create.continue)))
      .toBeVisible()
      .withTimeout(10000);
    await element(by.id(e2eIds.create.continue)).tap();
    await expect(element(by.id(e2eIds.generating.screen))).toBeVisible();
    await expect(element(by.id(e2eIds.generating.progressRing))).toBeVisible();
  });
});
