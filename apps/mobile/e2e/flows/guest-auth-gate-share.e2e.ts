import { by, device, element, expect, waitFor } from "detox";
import { e2eIds } from "../testIds";

describe("FlowB_GuestAuthGateShare", () => {
  it("shows auth gate when guest attempts share", async () => {
    await device.launchApp({
      newInstance: true,
      url: "faroway://trip/e2e-demo",
    });

    await waitFor(element(by.id(e2eIds.trip.screen)))
      .toBeVisible()
      .withTimeout(15000);
    await element(by.id(e2eIds.trip.shareButton)).tap();
    await expect(element(by.id(e2eIds.authGate.modal))).toBeVisible();
  });
});
