import { describe, it, expect } from "vitest";
import { securityHeaders } from "@/lib/security/headers";

describe("securityHeaders", () => {
  it("is a non-empty array of header objects", () => {
    expect(Array.isArray(securityHeaders)).toBe(true);
    expect(securityHeaders.length).toBeGreaterThan(0);
  });

  it("every entry has key and value strings", () => {
    for (const header of securityHeaders) {
      expect(typeof header.key).toBe("string");
      expect(typeof header.value).toBe("string");
      expect(header.key.length).toBeGreaterThan(0);
      expect(header.value.length).toBeGreaterThan(0);
    }
  });

  it("includes Strict-Transport-Security", () => {
    const hsts = securityHeaders.find(
      (h) => h.key === "Strict-Transport-Security",
    );
    expect(hsts).toBeDefined();
    expect(hsts!.value).toContain("max-age=");
    expect(hsts!.value).toContain("includeSubDomains");
  });

  it("includes X-Frame-Options set to SAMEORIGIN", () => {
    const xfo = securityHeaders.find((h) => h.key === "X-Frame-Options");
    expect(xfo).toBeDefined();
    expect(xfo!.value).toBe("SAMEORIGIN");
  });

  it("includes X-Content-Type-Options set to nosniff", () => {
    const xcto = securityHeaders.find(
      (h) => h.key === "X-Content-Type-Options",
    );
    expect(xcto).toBeDefined();
    expect(xcto!.value).toBe("nosniff");
  });

  it("includes Content-Security-Policy", () => {
    const csp = securityHeaders.find(
      (h) => h.key === "Content-Security-Policy",
    );
    expect(csp).toBeDefined();
    expect(csp!.value).toContain("default-src 'self'");
    expect(csp!.value).toContain("frame-ancestors 'self'");
  });

  it("includes Referrer-Policy", () => {
    const rp = securityHeaders.find((h) => h.key === "Referrer-Policy");
    expect(rp).toBeDefined();
    expect(rp!.value).toBe("strict-origin-when-cross-origin");
  });

  it("includes Permissions-Policy", () => {
    const pp = securityHeaders.find((h) => h.key === "Permissions-Policy");
    expect(pp).toBeDefined();
    expect(pp!.value).toContain("camera=()");
    expect(pp!.value).toContain("microphone=()");
  });

  it("includes X-DNS-Prefetch-Control", () => {
    const xdpc = securityHeaders.find(
      (h) => h.key === "X-DNS-Prefetch-Control",
    );
    expect(xdpc).toBeDefined();
    expect(xdpc!.value).toBe("on");
  });
});
