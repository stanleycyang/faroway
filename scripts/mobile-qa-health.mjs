// Native apps cannot use the developer's Vercel login or protection bypass.
export async function assertQaApiReachable(origin, fetcher = fetch) {
  const response = await fetcher(`${origin}/api/health`, {
    signal: AbortSignal.timeout(15000),
    redirect: "manual",
  });
  const type = response.headers.get("content-type") || "";
  if (response.status !== 200 || !type.includes("application/json")) {
    throw new Error(
      `Staging API is not directly reachable by a native app (HTTP ${response.status}). Configure and verify a mobile-accessible staging origin before building.`,
    );
  }
  const body = await response.json();
  if (body?.status !== "ok") {
    throw new Error("Staging API did not return the expected health response.");
  }
}
