// Test-only Node preload: redirects Viator Partner API fetch requests to the
// local loopback mock server on 127.0.0.1:4411 without touching production code.
const viatorOrigin = "https://api.viator.com";
const localOrigin = "http://127.0.0.1:4411";
const upstreamFetch = globalThis.fetch;

globalThis.fetch = function (input, init) {
  const raw = input instanceof Request ? input.url : String(input);
  let url;
  try {
    url = new URL(raw);
  } catch {
    return upstreamFetch(input, init);
  }
  if (url.origin !== viatorOrigin || !url.pathname.startsWith("/partner/")) {
    return upstreamFetch(input, init);
  }
  const rest = url.pathname.slice("/partner/".length);
  const local = `${localOrigin}/viator-partner/${rest}${url.search}`;
  return upstreamFetch(
    input instanceof Request ? new Request(local, input) : local,
    init,
  );
};
