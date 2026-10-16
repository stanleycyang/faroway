import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({ single: vi.fn(), eq: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  getSupabase: () => ({
    from: () => ({ select: () => ({ eq: mocks.eq, single: mocks.single }) }),
  }),
}));
vi.mock("next/og", () => ({
  ImageResponse: class extends Response {
    constructor(element: ReactNode, options: ResponseInit) {
      super(renderToStaticMarkup(element), options);
    }
  },
}));
import Image, { runtime, revalidate } from "../app/s/[token]/opengraph-image";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.eq.mockReturnValue({ eq: mocks.eq, single: mocks.single });
});

test("shared preview keeps active-token filtering and uncached ink/ivory presentation", async () => {
  mocks.single.mockResolvedValue({
    data: {
      destination: "Tokyo",
      start_date: "2026-11-01",
      end_date: "2026-11-04",
      travelers: 4,
    },
  });
  const image = await Image({
    params: Promise.resolve({ token: "active-link" }),
  });
  const html = await image.text();
  expect(mocks.eq).toHaveBeenCalledWith("share_token", "active-link");
  expect(mocks.eq).toHaveBeenCalledWith("is_shared", true);
  expect(html).toContain("Tokyo. Your journey.");
  expect(html).toContain("4 travelers");
  expect(html).toContain("#253A34");
  expect(html).not.toContain("AI-Generated");
  expect(image.headers.get("Cache-Control")).toBe(
    "private, no-store, max-age=0",
  );
  expect(runtime).toBe("nodejs");
  expect(revalidate).toBe(0);
});

test.each(["revoked", "outage"])(
  "%s preview returns generic content without invented trip facts",
  async (scenario) => {
    if (scenario === "outage")
      mocks.single.mockRejectedValue(new Error("Private diagnostics"));
    else mocks.single.mockResolvedValue({ data: null });
    const image = await Image({
      params: Promise.resolve({ token: "unavailable-link" }),
    });
    const html = await image.text();
    expect(html).toContain("A journey, shaped around you.");
    expect(html).not.toContain("travelers");
    expect(html).not.toContain("Private diagnostics");
    expect(image.headers.get("Cache-Control")).toContain("no-store");
  },
);
