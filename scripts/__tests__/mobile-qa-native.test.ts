import { afterAll, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { assertQaNativeIdentity } from "../mobile-qa-native.mjs";
const {
  removeOtherEnvironmentLinks,
} = require("../../apps/mobile/plugins/withIsolatedAppLinks.js");

const temporary = mkdtempSync(join(tmpdir(), "faroway-native-identity-"));
test.each([true, false])(
  "incremental prebuild removes only opposite environment links (QA=%s)",
  (qa) => {
    const schemes = [
      "faroway",
      "faroway-qa",
      "ai.faroway.app",
      "ai.faroway.app.qa",
      "https",
      "com.googleusercontent.apps.fixture",
    ];
    const filter = {
      data: schemes.map((scheme) => ({ $: { "android:scheme": scheme } })),
    };
    const manifest = {
      manifest: {
        application: [{ activity: [{ "intent-filter": [filter] }] }],
      },
    };
    removeOtherEnvironmentLinks(manifest, qa);
    const expected = qa
      ? ["faroway-qa", "ai.faroway.app.qa"]
      : ["faroway", "ai.faroway.app"];
    expect(filter.data.map((data) => data.$["android:scheme"])).toEqual([
      ...expected,
      "https",
      "com.googleusercontent.apps.fixture",
    ]);
    removeOtherEnvironmentLinks(manifest, qa);
    expect(filter.data).toHaveLength(4);
  },
);
afterAll(() => rmSync(temporary, { recursive: true, force: true }));
function fixture(platform: string, id: string, scheme: string, extraId = "") {
  const root = mkdtempSync(join(temporary, "case-"));
  const files =
    platform === "ios"
      ? {
          "ios/Faroway.xcodeproj/project.pbxproj": `PRODUCT_BUNDLE_IDENTIFIER = ${id};\nPRODUCT_BUNDLE_IDENTIFIER = "${extraId || id}";`,
          "ios/Faroway/Info.plist": `<string>$(PRODUCT_BUNDLE_IDENTIFIER)</string><string>${scheme}</string>`,
        }
      : {
          "android/app/build.gradle": `applicationId '${id}'`,
          "android/app/src/main/AndroidManifest.xml": `<data android:scheme="${scheme}"/>`,
        };
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}
for (const platform of ["ios", "android"]) {
  test(`${platform}: QA identity and links pass`, () => {
    expect(() =>
      assertQaNativeIdentity(
        fixture(platform, "ai.faroway.app.qa", "faroway-qa"),
        platform,
      ),
    ).not.toThrow();
  });
  test(`${platform}: stale production project requires QA prebuild`, () => {
    expect(() =>
      assertQaNativeIdentity(
        fixture(platform, "ai.faroway.app", "faroway"),
        platform,
      ),
    ).toThrow("qa:mobile prebuild");
  });
  test(`${platform}: QA ID with production deep link is rejected`, () => {
    expect(() =>
      assertQaNativeIdentity(
        fixture(platform, "ai.faroway.app.qa", "faroway"),
        platform,
      ),
    ).toThrow();
  });
  test(`${platform}: missing project fails closed`, () => {
    expect(() => assertQaNativeIdentity(temporary, platform)).toThrow(
      "qa:mobile prebuild",
    );
  });
}
test("iOS: mixed debug/release identities are rejected", () => {
  expect(() =>
    assertQaNativeIdentity(
      fixture("ios", "ai.faroway.app.qa", "faroway-qa", "ai.faroway.app"),
      "ios",
    ),
  ).toThrow();
});
