import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";

describe("cn (className merge utility)", () => {
  it("merges class names", () => {
    const result = cn("foo", "bar");
    expect(result).toBe("foo bar");
  });

  it("handles conditional classes", () => {
    const isActive = true;
    const result = cn("base", isActive && "active");
    expect(result).toContain("active");
  });

  it("handles false/null/undefined values", () => {
    const result = cn("base", false, null, undefined, "end");
    expect(result).toBe("base end");
  });

  it("merges tailwind classes correctly (last wins)", () => {
    const result = cn("p-4", "p-8");
    expect(result).toBe("p-8");
  });

  it("merges conflicting tailwind variants", () => {
    const result = cn("text-red-500", "text-blue-500");
    expect(result).toBe("text-blue-500");
  });

  it("handles empty input", () => {
    const result = cn();
    expect(result).toBe("");
  });

  it("handles array input", () => {
    const result = cn(["foo", "bar"]);
    expect(result).toBe("foo bar");
  });
});
