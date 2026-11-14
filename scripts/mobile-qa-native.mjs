import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

// Expo config does not rewrite an already generated native project on run:ios.
// Fail closed before building if a previous production prebuild is still here.
export function assertQaNativeIdentity(mobile, platform) {
  const expected = "ai.faroway.app.qa";
  const fail = () => {
    throw new Error(
      `Generated ${platform} project is not isolated for QA. Run bun run qa:mobile prebuild, then retry.`,
    );
  };
  const read = (path) => {
    try {
      return readFileSync(resolve(mobile, path), "utf8");
    } catch {
      return fail();
    }
  };
  if (platform === "ios") {
    const project = read("ios/Faroway.xcodeproj/project.pbxproj");
    const identifiers = [
      ...project.matchAll(/PRODUCT_BUNDLE_IDENTIFIER\s*=\s*([^;]+);/g),
    ].map((match) => match[1].trim().replace(/^"|"$/g, ""));
    const plist = read("ios/Faroway/Info.plist");
    if (
      identifiers.length === 0 ||
      identifiers.some((id) => id !== expected) ||
      !plist.includes("<string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>") ||
      !plist.includes("<string>faroway-qa</string>") ||
      /<string>\s*(?:faroway|ai\.faroway\.app)\s*<\/string>/.test(plist)
    )
      fail();
  } else if (platform === "android") {
    const gradle = read("android/app/build.gradle");
    const identifiers = [
      ...gradle.matchAll(/\bapplicationId\s*(?:=\s*)?["']([^"']+)["']/g),
    ].map((match) => match[1]);
    const manifest = read("android/app/src/main/AndroidManifest.xml");
    if (
      identifiers.length !== 1 ||
      identifiers[0] !== expected ||
      !manifest.includes('android:scheme="faroway-qa"') ||
      /android:scheme=["'](?:faroway|ai\.faroway\.app)["']/.test(manifest)
    )
      fail();
  } else {
    throw new Error("Unsupported native QA platform");
  }
}

// Validate local signing before EAS increments versions or starts an upload.
export function assertQaAndroidCredentials(mobile) {
  try {
    const config = JSON.parse(
      readFileSync(resolve(mobile, "credentials.json"), "utf8"),
    );
    const key = config.android?.keystore;
    if (
      !key ||
      !["keystorePath", "keystorePassword", "keyAlias", "keyPassword"].every(
        (name) => typeof key[name] === "string" && key[name].trim(),
      )
    )
      throw new Error();
    if (!statSync(resolve(mobile, key.keystorePath)).isFile())
      throw new Error();
  } catch {
    // Never echo parsing errors, file contents, or credential values.
    throw new Error(
      "Android QA signing is unavailable. Restore the private credentials.json and its existing keystore before submitting a build; do not substitute production or debug signing.",
    );
  }
}
