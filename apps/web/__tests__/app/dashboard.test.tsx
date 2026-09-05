import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("@/components/dashboard", () => ({
  TripCard: () => null,
  TripStats: () => null,
  EmptyState: () => null,
}));

vi.mock("@/components/dashboard/TripFilters", () => ({
  TripFilters: () => null,
}));

import DashboardPage from "@/app/(app)/dashboard/page";

type TestElement = {
  type?: unknown;
  props?: Record<string, unknown>;
};

function findElement(
  node: unknown,
  predicate: (element: TestElement) => boolean,
): TestElement | undefined {
  if (Array.isArray(node)) {
    for (const child of node) {
      const match = findElement(child, predicate);
      if (match) return match;
    }
    return undefined;
  }

  if (!node || typeof node !== "object") return undefined;

  const element = node as TestElement;
  if (predicate(element)) return element;
  return findElement(element.props?.children, predicate);
}

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("does not misrepresent a database failure as an empty account", async () => {
    const order = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "database unavailable" },
    });
    const select = vi.fn(() => ({ order }));

    createClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1", email: "traveler@example.com" } },
          error: null,
        }),
      },
      from: vi.fn(() => ({ select })),
    });

    await expect(
      DashboardPage({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("Unable to load your trips right now");
  });

  it("submits logout with the POST method expected by the route", async () => {
    const order = vi.fn().mockResolvedValue({ data: [], error: null });
    const select = vi.fn(() => ({ order }));

    createClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1", email: "traveler@example.com" } },
          error: null,
        }),
      },
      from: vi.fn(() => ({ select })),
    });

    const page = await DashboardPage({ searchParams: Promise.resolve({}) });
    const logoutForm = findElement(
      page,
      (element) =>
        element.type === "form" && element.props?.action === "/auth/logout",
    );
    const submitButton = findElement(
      logoutForm,
      (element) => element.type === "button",
    );

    expect(logoutForm?.props?.method).toBe("post");
    expect(submitButton?.props?.type).toBe("submit");
  });
});
