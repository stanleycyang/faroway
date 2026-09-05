import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const deleteProfileMock = vi.fn();

vi.mock("@/app/api/user/profile/route", () => ({
  DELETE: (...args: unknown[]) => deleteProfileMock(...args),
}));

import { DELETE } from "@/app/api/user/account/route";

describe("DELETE /api/user/account", () => {
  it("uses the canonical account-deletion implementation", async () => {
    const request = new NextRequest("http://localhost:3000/api/user/account", {
      method: "DELETE",
    });
    deleteProfileMock.mockResolvedValueOnce(
      Response.json({ deleted: true }, { status: 200 }),
    );

    const response = await DELETE(request);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ deleted: true });
    expect(deleteProfileMock).toHaveBeenCalledWith(request);
  });
});
