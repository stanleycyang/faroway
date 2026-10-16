import { describe, it, expect } from "vitest";
import { validateRedirectUrl } from "@/lib/security/validate-redirect";

describe("validateRedirectUrl", () => {
  it.each(["/\t/evil.example", "/\n/evil.example", "/\r/evil.example"])(
    "blocks URL parser control-character normalization: %j",
    (path) => {
      expect(validateRedirectUrl(path)).toBe("/dashboard");
    },
  );
  it("returns the URL when it is a valid relative path", () => {
    expect(validateRedirectUrl("/dashboard")).toBe("/dashboard");
  });

  it("accepts nested paths", () => {
    expect(validateRedirectUrl("/trips/123")).toBe("/trips/123");
  });

  it("accepts paths with query params", () => {
    expect(validateRedirectUrl("/search?q=tokyo")).toBe("/search?q=tokyo");
  });

  it("returns fallback for null input", () => {
    expect(validateRedirectUrl(null)).toBe("/dashboard");
  });

  it("returns custom fallback for null input", () => {
    expect(validateRedirectUrl(null, "/home")).toBe("/home");
  });

  it("returns fallback for non-relative URL", () => {
    expect(validateRedirectUrl("https://evil.com")).toBe("/dashboard");
  });

  it("blocks protocol-relative URLs (//evil.com)", () => {
    expect(validateRedirectUrl("//evil.com")).toBe("/dashboard");
  });

  it("blocks URLs with backslashes", () => {
    expect(validateRedirectUrl("/foo\\bar")).toBe("/dashboard");
  });

  it("blocks URLs with colons (could be absolute)", () => {
    expect(validateRedirectUrl("/foo:bar")).toBe("/dashboard");
  });

  it("returns fallback for empty string", () => {
    expect(validateRedirectUrl("")).toBe("/dashboard");
  });

  it("blocks javascript: protocol", () => {
    expect(validateRedirectUrl("javascript:alert(1)")).toBe("/dashboard");
  });

  it("blocks data: protocol", () => {
    expect(validateRedirectUrl("data:text/html,test")).toBe("/dashboard");
  });
});
