import { expect, test } from "bun:test";
import { easBunVersionFailures } from "../eas-bun-version.mjs";
import eas from "../../apps/mobile/eas.json";
import rootPackage from "../../package.json";

test("all actual EAS profiles match the repository package manager", () => {
  expect(easBunVersionFailures(rootPackage.packageManager, eas.build)).toEqual(
    [],
  );
});
test.each([undefined, "1.2.22"])(
  "rejects missing or stale QA Bun version: %s",
  (bun) => {
    expect(easBunVersionFailures("bun@1.4.4", { qa: { bun } })).toEqual([
      "EAS qa must explicitly pin bun to 1.4.4; image defaults may not read the lockfile.",
    ]);
  },
);
test("platform overrides cannot silently select an older runtime", () => {
  expect(
    easBunVersionFailures("bun@1.4.4", {
      qa: { bun: "1.4.4", ios: { bun: "1.2.22" }, android: { bun: "1.4.4" } },
    }),
  ).toEqual(["EAS qa.ios.bun must match 1.4.4."]);
});
test("requires an exact root pin", () => {
  expect(easBunVersionFailures("bun@^1.4.4", eas.build)).toEqual([
    "Root packageManager must pin an exact Bun version.",
  ]);
});
