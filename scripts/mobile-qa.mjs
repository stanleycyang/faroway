import {
  existsSync,
  mkdirSync,
  readFileSync,
  statfsSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { assertQaApiReachable } from "./mobile-qa-health.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mobile = resolve(root, "apps/mobile");
const require = createRequire(resolve(mobile, "package.json"));
const profile = JSON.parse(readFileSync(resolve(mobile, "eas.json"), "utf8"))
  .build.qa;
Object.assign(process.env, profile.env);
process.env.EXPO_NO_DOTENV = "1";
process.env.CI = "1";
if (!existsSync(`${process.env.JAVA_HOME}/bin/java`)) {
  const javaHome = [
    "/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home",
    "/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home",
  ].find((directory) => existsSync(`${directory}/bin/java`));
  if (javaHome) process.env.JAVA_HOME = javaHome;
}
process.env.ANDROID_HOME ||= existsSync(
  `${process.env.HOME}/Library/Android/sdk`,
)
  ? `${process.env.HOME}/Library/Android/sdk`
  : "/opt/homebrew/share/android-commandlinetools";
process.env.ANDROID_SDK_ROOT = process.env.ANDROID_HOME;
process.env.PATH = `${process.env.JAVA_HOME}/bin:${process.env.ANDROID_HOME}/platform-tools:${process.env.PATH}`;

// Expo's own config evaluator executes the QA isolation guard, including key
// provenance. It catches mistakes that TS/Jest imports alone cannot detect.
const { exp } = require("@expo/config").getConfig(mobile);
if (process.env.EXPO_PUBLIC_MOBILE_QA !== "1")
  throw new Error("QA profile is required.");
console.log(
  `QA configuration validated: ${exp.name}, staging database and API, public anon key.`,
);

function run(command, args, cwd = mobile) {
  const result = spawnSync(command, args, {
    cwd,
    env: process.env,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
const expo = require.resolve("expo/bin/cli");
const action = process.argv[2] || "preflight";
// Check before any native build or cloud submission; a successful config/export
// alone cannot prove that an installed app can reach its API.
if (
  [
    "preflight",
    "android",
    "ios-simulator",
    "cloud-android",
    "cloud-ios",
    "cloud-ios-simulator",
  ].includes(action)
) {
  await assertQaApiReachable(process.env.EXPO_PUBLIC_API_URL);
  console.log("Staging API: directly reachable, healthy JSON response.");
  run("bun", [resolve(root, "scripts/uat/images.ts")], root);
}
const disk = statfsSync(root);
const freeGiB = (Number(disk.bavail) * Number(disk.bsize)) / 1024 ** 3;
if (["android", "ios-simulator"].includes(action) && freeGiB < 12) {
  throw new Error(
    `Local native builds need at least 12 GiB free; ${freeGiB.toFixed(1)} GiB available. Use a cloud build or free disk space first.`,
  );
}
switch (action) {
  case "preflight": {
    console.log(
      `Java 17+: ${existsSync(`${process.env.JAVA_HOME}/bin/java`) ? "available" : "missing"}`,
    );
    console.log(`Android SDK: ${process.env.ANDROID_HOME}`);
    console.log(
      `Free disk: ${freeGiB.toFixed(1)} GiB (12 GiB required for local native builds).`,
    );
    run("adb", ["devices", "-l"]);
    run("xcrun", ["devicectl", "list", "devices"]);
    break;
  }
  case "prebuild": {
    const packagePath = resolve(mobile, "package.json");
    const originalScripts = JSON.parse(
      readFileSync(packagePath, "utf8"),
    ).scripts;
    run(process.execPath, [
      expo,
      "prebuild",
      "--no-install",
      "--skip-dependency-update",
      "react,react-native",
    ]);
    // Expo changes the ios/android convenience scripts when generating native
    // folders. QA preparation should not rewrite the app's existing commands.
    const generatedPackage = JSON.parse(readFileSync(packagePath, "utf8"));
    generatedPackage.scripts = originalScripts;
    writeFileSync(
      packagePath,
      JSON.stringify(generatedPackage, null, 2) + "\n",
    );
    break;
  }
  case "pods":
    run("pod", ["install"], resolve(mobile, "ios"));
    break;
  case "export":
    run(process.execPath, [
      expo,
      "export",
      "--platform",
      "all",
      "--output-dir",
      resolve(root, "artifacts/mobile-qa/export"),
    ]);
    break;
  case "smoke": {
    const evidence = resolve(root, "artifacts/mobile-qa/maestro");
    mkdirSync(evidence, { recursive: true });
    run("maestro", [
      "test",
      "--format",
      "JUNIT",
      "--output",
      resolve(evidence, "startup.xml"),
      "--debug-output",
      evidence,
      ".maestro/startup.yaml",
    ]);
    break;
  }
  case "android":
    run(
      "./gradlew",
      [
        ":app:assembleRelease",
        "-PreactNativeArchitectures=arm64-v8a",
        "--max-workers=2",
      ],
      resolve(mobile, "android"),
    );
    break;
  case "ios-simulator": {
    const device = process.env.FAROWAY_QA_IOS_DEVICE;
    if (!device) {
      throw new Error(
        "Set FAROWAY_QA_IOS_DEVICE to a simulator name or UDID from xcrun simctl list devices available.",
      );
    }
    run(process.execPath, [
      expo,
      "run:ios",
      "--configuration",
      "Release",
      "--device",
      device,
      "--no-bundler",
    ]);
    break;
  }
  case "cloud-android":
  case "cloud-ios":
  case "cloud-ios-simulator":
    // EAS evaluates config once before fetching its remote environment. The
    // outer env:exec supplies the QA public key for that initial evaluation.
    run("eas", [
      "build",
      "--platform",
      action === "cloud-android" ? "android" : "ios",
      "--profile",
      action === "cloud-ios-simulator" ? "qa-simulator" : "qa",
      "--freeze-credentials",
      "--non-interactive",
      "--no-wait",
    ]);
    break;
  default:
    throw new Error("Unknown mobile QA action.");
}
