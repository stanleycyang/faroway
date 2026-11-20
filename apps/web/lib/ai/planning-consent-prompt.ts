export type PlanningConsentPrompt = (
  message: string,
) => Promise<boolean> | boolean;

let registeredConsentPrompt: PlanningConsentPrompt | null = null;

/**
 * Register an accessible in-app dialog handler to replace native window.confirm.
 * Returns a cleanup function that only clears if this exact handler is still active,
 * preventing outgoing route cleanups from clobbering an incoming route's handler.
 */
export function setPlanningConsentPrompt(
  handler: PlanningConsentPrompt | null,
): () => void {
  registeredConsentPrompt = handler;
  return () => {
    if (handler !== null && registeredConsentPrompt === handler) {
      registeredConsentPrompt = null;
    }
  };
}

export function getPlanningConsentPrompt(): PlanningConsentPrompt | null {
  return registeredConsentPrompt;
}
