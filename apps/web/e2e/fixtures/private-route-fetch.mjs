// QA-only Node preload: synthetic Supabase hostname preserves production image
// allowlists while every request to it terminates at the loopback fixture.
const syntheticOrigin = "https://faroway-private-route-fixture.supabase.co";
const localOrigin = "http://127.0.0.1:4017";
const upstreamFetch = globalThis.fetch;
globalThis.fetch = function (input, init) {
  const raw = input instanceof Request ? input.url : String(input);
  const url = new URL(raw);
  if (url.origin !== syntheticOrigin) return upstreamFetch(input, init);
  const local = `${localOrigin}${url.pathname}${url.search}`;
  return upstreamFetch(
    input instanceof Request ? new Request(local, input) : local,
    init,
  );
};
