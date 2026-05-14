import { afterEach, describe, expect, it, vi } from "vitest";

const originalTestLogs = process.env.FAROWAY_TEST_LOGS;

afterEach(() => {
  process.env.FAROWAY_TEST_LOGS = originalTestLogs;
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("server logger", () => {
  it("suppresses logs during tests by default", async () => {
    delete process.env.FAROWAY_TEST_LOGS;
    vi.resetModules();
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { logger } = await import("@/lib/logger");
    logger.info("info");
    logger.warn("warn");
    logger.error("error");

    expect(logSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("can enable logs during tests for debugging", async () => {
    process.env.FAROWAY_TEST_LOGS = "1";
    vi.resetModules();
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const { logger } = await import("@/lib/logger");
    logger.info("debug");

    expect(logSpy).toHaveBeenCalledWith("debug");
  });
});
