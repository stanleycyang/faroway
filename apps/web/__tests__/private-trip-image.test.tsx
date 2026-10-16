import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
  eq: vi.fn(),
  single: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: mocks.getUser },
    from: mocks.from,
  }),
}));
vi.mock("next/og", () => ({
  ImageResponse: class extends Response {
    constructor(element: ReactNode, options: ResponseInit) {
      super(renderToStaticMarkup(element), options);
    }
  },
}));
import Image, { dynamic } from "../app/(app)/trips/[id]/opengraph-image";
beforeEach(() => {
  vi.resetAllMocks();
  const query = { eq: mocks.eq, single: mocks.single };
  mocks.eq.mockReturnValue(query);
  mocks.from.mockReturnValue({ select: () => query });
  mocks.single.mockResolvedValue({
    data: {
      destination: "Private destination",
      start_date: "2026-11-01",
      end_date: "2026-11-04",
      travelers: 2,
    },
  });
});
test("guest preview never queries private trip rows and returns uncached generic content", async () => {
  mocks.getUser.mockResolvedValue({ data: { user: null } });
  const response = await Image({ params: Promise.resolve({ id: "trip-a" }) });
  expect(mocks.from).not.toHaveBeenCalled();
  expect(await response.text()).not.toContain("Private destination");
  expect(response.headers.get("Cache-Control")).toBe(
    "private, no-store, max-age=0",
  );
  expect(dynamic).toBe("force-dynamic");
});
test("owner preview requires verified identity and explicit owner filter", async () => {
  mocks.getUser.mockResolvedValue({ data: { user: { id: "owner-a" } } });
  const response = await Image({ params: Promise.resolve({ id: "trip-a" }) });
  expect(mocks.eq).toHaveBeenCalledWith("id", "trip-a");
  expect(mocks.eq).toHaveBeenCalledWith("user_id", "owner-a");
  expect(await response.text()).toContain("Private destination");
  expect(response.headers.get("Cache-Control")).toContain("no-store");
});
