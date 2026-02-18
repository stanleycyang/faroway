/**
 * Travel Search Workflow
 * Orchestrates the multi-agent search process
 * 
 * Note: This module defines the workflow logic that is executed
 * by the /api/search/[searchId]/execute endpoint.
 * For production use with Vercel Workflows, see /workflows/
 */

import {
  SearchInput,
  SearchPlan,
  HotelResult,
  ActivityResult,
  DiningResult,
  SearchResults,
  SuggestedDay,
} from './types';
import {
  runOrchestratorAgent,
  runHotelsAgent,
  runActivitiesAgent,
  runDiningAgent,
  runAggregatorAgent,
} from './agents';

export interface TravelSearchWorkflowInput {
  searchId: string;
  input: SearchInput;
}

export interface TravelSearchWorkflowOutput {
  searchId: string;
  status: 'completed' | 'error';
  results?: SearchResults;
  error?: string;
}

/**
 * Execute the travel search workflow directly
 * This runs all agents in sequence/parallel and returns results
 */
export async function executeTravelSearch(
  searchId: string,
  input: SearchInput,
  callbacks?: {
    onProgress?: (stage: string, status: 'searching' | 'done') => Promise<void>;
  }
): Promise<TravelSearchWorkflowOutput> {
  const onProgress = callbacks?.onProgress;

  try {
    // Step 1: Orchestrator Agent - Creates the search plan
    if (onProgress) await onProgress('orchestrator', 'searching');
    const searchPlan = await runOrchestratorAgent(input);
    if (onProgress) await onProgress('orchestrator', 'done');

    // Step 2: Run specialized agents in parallel
    if (onProgress) {
      await onProgress('hotels', 'searching');
      await onProgress('activities', 'searching');
      await onProgress('dining', 'searching');
    }

    const [hotels, activities, dining] = await Promise.all([
      runHotelsAgent(searchPlan, 10).then(async (results) => {
        if (onProgress) await onProgress('hotels', 'done');
        return results;
      }),
      runActivitiesAgent(searchPlan, 15).then(async (results) => {
        if (onProgress) await onProgress('activities', 'done');
        return results;
      }),
      runDiningAgent(searchPlan, 12).then(async (results) => {
        if (onProgress) await onProgress('dining', 'done');
        return results;
      }),
    ]);

    // Step 3: Aggregator Agent - Combines results into itinerary
    if (onProgress) await onProgress('aggregator', 'searching');
    const { days } = await runAggregatorAgent(searchPlan, hotels, activities, dining);
    if (onProgress) await onProgress('aggregator', 'done');

    const results: SearchResults = {
      searchId,
      hotels,
      activities,
      dining,
      itinerary: days,
    };

    return {
      searchId,
      status: 'completed',
      results,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return {
      searchId,
      status: 'error',
      error: errorMessage,
    };
  }
}
