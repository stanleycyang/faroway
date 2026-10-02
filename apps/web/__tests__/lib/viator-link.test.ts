import { describe, expect, it } from "vitest";
import { buildViatorHandoffUrl } from "@/lib/affiliates/viator-link";

const canonical =
  "https://www.viator.com/tours/Paris/Walk/d479-123P1?pid=P12345678&mcid=42383&medium=api&campaign=old&locale=en";
describe("Viator provider-owned attribution", () => {
  it("changes only campaign and preserves provider parameters", () => {
    const result = new URL(
      buildViatorHandoffUrl(canonical, "checkout-123", "P12345678")!,
    );
    expect(result.searchParams.get("mcid")).toBe("42383");
    expect(result.searchParams.get("pid")).toBe("P12345678");
    expect(result.searchParams.get("medium")).toBe("api");
    expect(result.searchParams.get("locale")).toBe("en");
    expect(result.searchParams.get("campaign")).toBe("checkout-123");
    expect(result.searchParams.has("click_id")).toBe(false);
  });
  it.each([
    canonical.replace("www.viator.com", "viator.com.evil.test"),
    canonical.replace("https:", "http:"),
    canonical.replace("www.viator.com", "user:password@www.viator.com"),
    canonical.replace("www.viator.com", "www.viator.com:444"),
    canonical.replace("/tours/", "/redirect/"),
    canonical.replace("P12345678", "faroway"),
    canonical.replace("mcid=42383", "mcid=tg_123"),
    canonical.replace("&medium=api", ""),
    "not a URL",
  ])("rejects unsafe or unattributable links: %s", (url) => {
    expect(buildViatorHandoffUrl(url, "checkout-123", "P12345678")).toBeNull();
  });
  it("rejects another affiliate account and invalid campaign characters", () => {
    expect(
      buildViatorHandoffUrl(canonical, "checkout-123", "P9999"),
    ).toBeNull();
    expect(buildViatorHandoffUrl(canonical, "trip/user@email.test")).toBeNull();
  });
});
