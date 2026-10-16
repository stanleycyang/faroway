import { expect, test } from "@playwright/test";

test("compiled browser monitoring initializes and strips query data before delivery", async ({
  page,
}) => {
  test.skip(
    process.env.E2E_INSTRUMENTATION_QA !== "true",
    "Requires the isolated production QA build with telemetry credentials omitted.",
  );
  await page.route(/^https:\/\//, (route) => route.abort());
  await page.goto("/support", { waitUntil: "domcontentloaded" });
  const inspect = () =>
    page.evaluate(() => {
      type Client = {
        getOptions: () => {
          environment?: string;
          tracesSampleRate?: number;
          replaysSessionSampleRate?: number;
          replaysOnErrorSampleRate?: number;
          beforeSend?: (event: { request: { url: string } }) => {
            request?: { url?: string };
          };
        };
      };
      // Read the installed SDK's live carrier; no mocked SDK, capture or transmission.
      const carrier = (
        window as unknown as {
          __SENTRY__?: Record<
            string,
            { defaultCurrentScope?: { getClient: () => Client | undefined } }
          >;
        }
      ).__SENTRY__;
      const client = Object.values(carrier ?? {})
        .map((entry) => entry?.defaultCurrentScope?.getClient())
        .find(Boolean);
      if (!client) return null;
      const options = client.getOptions();
      return {
        environment: options.environment,
        traces: options.tracesSampleRate,
        replay: options.replaysSessionSampleRate,
        replayOnError: options.replaysOnErrorSampleRate,
        sanitizedUrl: options.beforeSend?.({
          request: {
            url: "https://example.invalid/trip?email=synthetic%40example.invalid#draft",
          },
        })?.request?.url,
      };
    });
  await expect.poll(inspect).toEqual({
    environment: "production",
    traces: 0.1,
    replay: 0.01,
    replayOnError: 1,
    sanitizedUrl: "https://example.invalid/trip",
  });
});
