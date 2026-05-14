import { createRequire } from "node:module";

const requireWorkflow = createRequire(import.meta.url);

type WorkflowApiModule = {
  start: (workflow: unknown, args: readonly unknown[]) => Promise<unknown>;
};

type WorkflowModule = {
  FatalError?: new (message: string) => Error;
};

export async function startWorkflow<TResult = unknown>(
  workflow: unknown,
  args: readonly unknown[],
): Promise<TResult> {
  const { start } = requireWorkflow("workflow/api") as WorkflowApiModule;
  return (await start(workflow, args)) as TResult;
}

export function createFatalWorkflowError(message: string): Error {
  const { FatalError } = requireWorkflow("workflow") as WorkflowModule;
  return FatalError ? new FatalError(message) : new Error(message);
}
