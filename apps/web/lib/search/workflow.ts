/**
 * Travel Search Workflow
 * Orchestrates the multi-agent search process
 *
 * Note: This module defines the workflow logic that is executed
 * by the /api/search/[searchId]/execute endpoint.
 * For production use with Vercel Workflows, see /workflows/
 */

import { SearchInput, SearchResults } from "./types";
import { mapSearchResultsToItinerary } from "./bridge";
import {
  runOrchestratorAgent,
  runHotelsAgent,
  runActivitiesAgent,
  runDiningAgent,
  runTransportAgent,
  runAggregatorAgent,
} from "./agents";
import { runSearchEnrichment } from "./enrichment";

export interface TravelSearchWorkflowInput {
  searchId: string;
  input: SearchInput;
}

export interface TravelSearchWorkflowOutput {
  searchId: string;
  status: "completed" | "error";
  results?: SearchResults;
  error?: string;
}

export interface WorkflowCallbacks {
  onProgress?: (stage: string, status: "searching" | "done") => Promise<void>;
  onAgentResult?: (stage: string, data: unknown) => Promise<void>;
  /** Called for micro-progress updates (e.g., "Analyzing your travel style...") */
  onMicroProgress?: (data: {
    stage: string;
    message: string;
    detail?: string;
  }) => void;
}

/**
 * Execute the travel search workflow directly
 * This runs all agents in sequence/parallel and returns results
 */
export async function executeTravelSearch(
  searchId: string,
  input: SearchInput,
  callbacks?: WorkflowCallbacks,
): Promise<TravelSearchWorkflowOutput> {
  const onProgress = callbacks?.onProgress;
  const onAgentResult = callbacks?.onAgentResult;
  const onMicroProgress = callbacks?.onMicroProgress;
  const workflowStart = Date.now();

  try {
    const logStageTiming = (stage: string, startedAt: number) => {
      console.log(
        `[WorkflowTiming] search=${searchId} stage=${stage} duration_ms=${Date.now() - startedAt}`,
      );
    };

    // Step 1: Orchestrator Agent - Creates the search plan
    const orchestratorStart = Date.now();
    onMicroProgress?.({
      stage: "orchestrator",
      message: "Analyzing your travel preferences...",
    });
    if (onProgress) await onProgress("orchestrator", "searching");

    onMicroProgress?.({
      stage: "orchestrator",
      message: "Understanding your travel style...",
      detail: `${input.vibes?.join(", ") || "adventure"}`,
    });
    const searchPlan = await runOrchestratorAgent(input);

    onMicroProgress?.({
      stage: "orchestrator",
      message: "Created personalized search plan",
      detail: `${searchPlan.dates.nights} nights in ${input.destination}`,
    });
    logStageTiming("orchestrator", orchestratorStart);
    if (onProgress) await onProgress("orchestrator", "done");

    // Step 2: Run specialized agents in parallel
    onMicroProgress?.({
      stage: "hotels",
      message: "Searching top-rated hotels...",
    });
    onMicroProgress?.({
      stage: "activities",
      message: "Finding unique experiences...",
    });
    onMicroProgress?.({
      stage: "dining",
      message: "Discovering local restaurants...",
    });
    if (searchPlan.transportCriteria?.originAirport) {
      onMicroProgress?.({
        stage: "transport",
        message: "Searching flights...",
      });
    }
    onMicroProgress?.({
      stage: "enrichment",
      message: "Checking local enrichment sources...",
    });

    if (onProgress) {
      await onProgress("hotels", "searching");
      await onProgress("activities", "searching");
      await onProgress("dining", "searching");
      if (searchPlan.transportCriteria?.originAirport) {
        await onProgress("transport", "searching");
      }
      await onProgress("enrichment", "searching");
    }

    const fanoutStart = Date.now();
    const [
      hotelsResult,
      activitiesResult,
      diningResult,
      transportResult,
      enrichmentResult,
    ] = await Promise.allSettled([
      runHotelsAgent(searchPlan, 10).then(async (results) => {
        logStageTiming("hotels", fanoutStart);
        onMicroProgress?.({
          stage: "hotels",
          message: `Found ${results.length} perfect hotels`,
          detail: results[0]?.name,
        });
        if (onProgress) await onProgress("hotels", "done");
        if (onAgentResult) await onAgentResult("hotels", results);
        return results;
      }),
      runActivitiesAgent(searchPlan, 15).then(async (results) => {
        logStageTiming("activities", fanoutStart);
        onMicroProgress?.({
          stage: "activities",
          message: `Discovered ${results.length} activities`,
          detail: results[0]?.name,
        });
        if (onProgress) await onProgress("activities", "done");
        if (onAgentResult) await onAgentResult("activities", results);
        return results;
      }),
      runDiningAgent(searchPlan, 12).then(async (results) => {
        logStageTiming("dining", fanoutStart);
        onMicroProgress?.({
          stage: "dining",
          message: `Found ${results.length} restaurants`,
          detail: results[0]?.name,
        });
        if (onProgress) await onProgress("dining", "done");
        if (onAgentResult) await onAgentResult("dining", results);
        return results;
      }),
      runTransportAgent(searchPlan, input.travelers || 1, 5).then(
        async (results) => {
          logStageTiming("transport", fanoutStart);
          onMicroProgress?.({
            stage: "transport",
            message:
              results.length > 0
                ? `Found ${results.length} flight options`
                : "No flights needed",
            detail: results[0]?.provider,
          });
          if (onProgress) await onProgress("transport", "done");
          if (onAgentResult) await onAgentResult("transport", results);
          return results;
        },
      ),
      runSearchEnrichment(searchPlan, searchId).then(async (results) => {
        logStageTiming("enrichment", fanoutStart);
        onMicroProgress?.({
          stage: "enrichment",
          message: "Added local context",
          detail: results.notes[0],
        });
        if (onProgress) await onProgress("enrichment", "done");
        if (onAgentResult) await onAgentResult("enrichment", results);
        return results;
      }),
    ]);
    logStageTiming("parallel_agents", fanoutStart);

    // Extract results, falling back to empty arrays if an agent failed
    const hotels =
      hotelsResult.status === "fulfilled" ? hotelsResult.value : [];
    const baseActivities =
      activitiesResult.status === "fulfilled" ? activitiesResult.value : [];
    const baseDining =
      diningResult.status === "fulfilled" ? diningResult.value : [];
    const transport =
      transportResult.status === "fulfilled" ? transportResult.value : [];
    const enrichment =
      enrichmentResult.status === "fulfilled"
        ? enrichmentResult.value
        : { activities: [], dining: [], notes: [] };
    const activities = [...baseActivities, ...enrichment.activities];
    const dining = [...baseDining, ...enrichment.dining];

    // Log any agent failures
    for (const [name, result] of [
      ["hotels", hotelsResult],
      ["activities", activitiesResult],
      ["dining", diningResult],
      ["transport", transportResult],
      ["enrichment", enrichmentResult],
    ] as const) {
      if (result.status === "rejected") {
        console.error(`[Workflow] ${name} agent failed:`, result.reason);
      }
    }

    // Step 3: Aggregator Agent - Combines results into itinerary
    onMicroProgress?.({
      stage: "aggregator",
      message: "Crafting your perfect day-by-day plan...",
    });
    if (onProgress) await onProgress("aggregator", "searching");

    onMicroProgress?.({
      stage: "aggregator",
      message: "Optimizing activities by location...",
    });
    const aggregatorStart = Date.now();
    const { days } = await runAggregatorAgent(
      searchPlan,
      hotels,
      activities,
      dining,
      transport,
    );
    logStageTiming("aggregator", aggregatorStart);

    onMicroProgress?.({
      stage: "aggregator",
      message: `Created ${days.length}-day itinerary`,
      detail: days[0]?.title,
    });
    if (onProgress) await onProgress("aggregator", "done");

    const results: SearchResults = {
      searchId,
      hotels,
      activities,
      dining,
      transport,
      itinerary: days,
    };

    // Send mapped aggregator results so the client can render TripDay[] progressively
    if (onAgentResult) {
      const topHotel = days?.[0]?.hotel || hotels[0] || null;
      const mapped = mapSearchResultsToItinerary(results, topHotel);
      await onAgentResult("aggregator", {
        days: mapped.days,
        topHotel: mapped.topHotel,
      });
    }

    return {
      searchId,
      status: "completed",
      results,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    return {
      searchId,
      status: "error",
      error: errorMessage,
    };
  } finally {
    console.log(
      `[WorkflowTiming] search=${searchId} stage=total duration_ms=${Date.now() - workflowStart}`,
    );
  }
}
