import { MODEL_COMPARE_CONFIGS } from "./model-compare";
import { DEVELOPMENT_BRIEFS, HOLDOUT_BRIEFS } from "./eval-briefs";
import { UAT_BRIEFS } from "./briefs";

/** Shared preflight/live selection; this function makes no provider calls. */
export function comparisonSelection(argv: readonly string[]) {
  const arg = (flag: string): string | undefined => {
    const index = argv.indexOf(flag);
    if (index < 0) return undefined;
    if (!argv[index + 1] || argv[index + 1].startsWith("--"))
      throw new Error(`Missing value for ${flag}`);
    return argv[index + 1];
  };
  const select = <T extends { id: string }>(items: T[], flag: string): T[] => {
    const ids = arg(flag)?.split(",");
    if (!ids) return items;
    if (
      new Set(ids).size !== ids.length ||
      ids.some((id) => !items.some((item) => item.id === id))
    )
      throw new Error(`Invalid ${flag} selection`);
    return ids.map((id) => items.find((item) => item.id === id)!);
  };
  const compiledNarrated = argv.includes("--compiled-narrated");
  const upstreamThinking = arg("--upstream-thinking") ?? "low";
  if (
    !["low", "minimal"].includes(upstreamThinking) ||
    (arg("--upstream-thinking") && !compiledNarrated)
  )
    throw new Error(
      "--upstream-thinking requires compiled narration and low or minimal",
    );
  const hotelThinking = arg("--hotel-thinking");
  if (
    hotelThinking !== undefined &&
    (!compiledNarrated ||
      upstreamThinking !== "low" ||
      hotelThinking !== "minimal")
  )
    throw new Error(
      "--hotel-thinking requires minimal, compiled narration and low upstream thinking",
    );
  const selectedConfigs = select(MODEL_COMPARE_CONFIGS, "--configs");
  if (
    compiledNarrated &&
    (selectedConfigs.length !== 1 || selectedConfigs[0].id !== "flash-low")
  )
    throw new Error("Compiled candidate requires --configs flash-low");
  const configs = compiledNarrated
    ? selectedConfigs.map((config) => ({
        ...config,
        id: hotelThinking
          ? "compiled-hotel-minimal"
          : upstreamThinking === "minimal"
            ? "compiled-upstream-minimal"
            : "compiled-minimal",
        label: hotelThinking
          ? "Compiled schedule with minimal hotel thinking and narration; other upstream agents low"
          : `Compiled schedule with minimal narration and ${upstreamThinking}-thinking upstream agents`,
        env: {
          ...config.env,
          PLANNING_THINKING_ORCHESTRATOR: upstreamThinking,
          PLANNING_THINKING_HOTELS: hotelThinking ?? upstreamThinking,
          PLANNING_THINKING_ACTIVITIES: upstreamThinking,
          PLANNING_THINKING_DINING: upstreamThinking,
          PLANNING_THINKING_AGGREGATOR: "minimal",
        },
      }))
    : selectedConfigs;
  const suite = arg("--suite") ?? "uat";
  if (!["uat", "development", "holdout"].includes(suite))
    throw new Error("Invalid --suite");
  const briefs = select(
    suite === "development"
      ? DEVELOPMENT_BRIEFS
      : suite === "holdout"
        ? HOLDOUT_BRIEFS
        : UAT_BRIEFS,
    "--briefs",
  );
  const capUsd = Number(arg("--cap-usd") ?? "20");
  if (!Number.isFinite(capUsd) || capUsd <= 0 || capUsd > 20)
    throw new Error("--cap-usd must be greater than zero and at most 20");
  return { configs, briefs, capUsd, compiledNarrated };
}
