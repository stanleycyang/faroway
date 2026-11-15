import { EventEmitter } from "node:events";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("node:https", () => ({ request }));
beforeEach(() => {
  vi.resetModules();
  request.mockReset();
  vi.stubEnv("VIATOR_SANDBOX", "true");
  vi.stubEnv("VIATOR_API_KEY", "test-key");
  vi.stubEnv("VIATOR_PARTNER_ID", "test-partner");
  vi.stubEnv("VIATOR_CONTENT_ENABLED", "true");
  vi.stubEnv("VIATOR_CONTENT_APPROVAL_REF", "test");
});
afterEach(() => vi.unstubAllEnvs());

it.each([false, true])(
  "bounds and isolates the diagnostic response (oversized=%s)",
  async (oversized) => {
    request.mockImplementation((_url, options, respond) => {
      const outgoing = Object.assign(new EventEmitter(), {
        end: vi.fn(() => {
          const incoming = Object.assign(new EventEmitter(), {
            statusCode: 200,
          });
          respond(incoming);
          incoming.emit(
            "data",
            oversized
              ? Buffer.alloc(2 * 1024 * 1024 + 1)
              : Buffer.from('{"products":[]}'),
          );
          incoming.emit("end");
        }),
        destroy: vi.fn((error) => outgoing.emit("error", error)),
      });
      expect(options.agent).toBe(false);
      expect(options.signal).toBeInstanceOf(AbortSignal);
      return outgoing;
    });
    const { probeViatorSandbox } = await import("@/lib/affiliates/viator");
    const result = await probeViatorSandbox({ transport: "https" });
    expect(result.status).toBe(oversized ? "failed" : "empty");
    expect(JSON.stringify(result)).not.toContain("test-key");
    expect(request.mock.calls[0][0].hostname).toBe("api.sandbox.viator.com");
    expect(request).toHaveBeenCalledTimes(1);
  },
);
