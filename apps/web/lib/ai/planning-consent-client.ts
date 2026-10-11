"use client";
import { createClient } from "@/lib/supabase/client";

/** Fresh choice per operation; pin both creation and generation to this account. */
export async function requestPlanningConsent() {
  const client = createClient();
  const initial = await client.auth.getSession();
  const userId = initial.data.session?.user.id;
  if (initial.error || !userId) throw new Error("Sign in before planning.");
  const response = await fetch("/api/ai/disclosure", {
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok)
    throw new Error("AI sharing information is unavailable. Please retry.");
  const disclosure = await response.json();
  if (
    !disclosure ||
    typeof disclosure.version !== "string" ||
    !/^[a-zA-Z0-9-]{1,100}$/.test(disclosure.version) ||
    typeof disclosure.message !== "string" ||
    !disclosure.message ||
    disclosure.message.length > 4000
  )
    throw new Error("AI sharing information could not be verified.");
  if (
    !window.confirm(
      disclosure.message +
        "\n\nChoose OK to share and plan, or Cancel to keep your saved trips without starting AI.",
    )
  )
    throw new Error(
      "AI sharing declined. Your saved trips are still available.",
    );
  return async () => {
    const current = await client.auth.getSession();
    if (current.error || current.data.session?.user.id !== userId)
      throw new Error("Your account changed. Please start again.");
    if (!navigator.onLine)
      throw new Error("You’re offline. Reconnect and choose to plan again.");
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${current.data.session.access_token}`,
      "X-Faroway-AI-Disclosure": disclosure.version,
    };
  };
}
