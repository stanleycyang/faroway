import { createRequire } from "node:module";
import { FatalError } from "workflow";

const requireWorkflow = createRequire(import.meta.url);

type WorkflowApiModule = {
  start: (workflow: unknown, args: readonly unknown[]) => Promise<unknown>;
};

export async function startWorkflow<TResult = unknown>(
  workflow: unknown,
  args: readonly unknown[],
): Promise<TResult> {
  const { start } = requireWorkflow("workflow/api") as WorkflowApiModule;
  return (await start(workflow, args)) as TResult;
}

export function createFatalWorkflowError(message: string): Error {
  return new FatalError(message);
}

/** Reads a known run; never starts or restarts work during reconciliation. */
export async function getWorkflowRunStatus(runId: string): Promise<string> {
  const api = requireWorkflow("workflow/api") as {
    getRun: (id: string) => { status: Promise<string> };
  };
  return await api.getRun(runId).status;
}
