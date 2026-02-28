import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

describe('CORS utilities', () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.ALLOWED_ORIGINS;
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  describe('isOriginAllowed', () => {
    it('returns false for null origin', async () => {
      const { isOriginAllowed } = await import('@/lib/security/cors');
      expect(isOriginAllowed(null)).toBe(false);
    });

    it('returns false when no origins configured', async () => {
      const { isOriginAllowed } = await import('@/lib/security/cors');
      expect(isOriginAllowed('https://example.com')).toBe(false);
    });

    it('returns true when origin matches ALLOWED_ORIGINS', async () => {
      process.env.ALLOWED_ORIGINS = 'https://faroway.ai,https://app.faroway.ai';
      const { isOriginAllowed } = await import('@/lib/security/cors');
      expect(isOriginAllowed('https://faroway.ai')).toBe(true);
    });

    it('returns false when origin not in ALLOWED_ORIGINS', async () => {
      process.env.ALLOWED_ORIGINS = 'https://faroway.ai';
      const { isOriginAllowed } = await import('@/lib/security/cors');
      expect(isOriginAllowed('https://evil.com')).toBe(false);
    });

    it('falls back to NEXT_PUBLIC_APP_URL when ALLOWED_ORIGINS not set', async () => {
      process.env.NEXT_PUBLIC_APP_URL = 'https://faroway.ai';
      const { isOriginAllowed } = await import('@/lib/security/cors');
      expect(isOriginAllowed('https://faroway.ai')).toBe(true);
    });
  });

  describe('applyCorsHeaders', () => {
    it('sets CORS headers for allowed origin', async () => {
      process.env.ALLOWED_ORIGINS = 'https://faroway.ai';
      const { applyCorsHeaders } = await import('@/lib/security/cors');

      const request = new NextRequest(new URL('http://localhost:3000/api/test'), {
        headers: { origin: 'https://faroway.ai' },
      });
      const response = NextResponse.json({ ok: true });

      const result = applyCorsHeaders(request, response);
      expect(result).toBe('https://faroway.ai');
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://faroway.ai');
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('GET');
      expect(response.headers.get('Vary')).toBe('Origin');
    });

    it('returns null for disallowed origin', async () => {
      process.env.ALLOWED_ORIGINS = 'https://faroway.ai';
      const { applyCorsHeaders } = await import('@/lib/security/cors');

      const request = new NextRequest(new URL('http://localhost:3000/api/test'), {
        headers: { origin: 'https://evil.com' },
      });
      const response = NextResponse.json({ ok: true });

      const result = applyCorsHeaders(request, response);
      expect(result).toBeNull();
    });

    it('returns null when no origin header', async () => {
      const { applyCorsHeaders } = await import('@/lib/security/cors');

      const request = new NextRequest(new URL('http://localhost:3000/api/test'));
      const response = NextResponse.json({ ok: true });

      const result = applyCorsHeaders(request, response);
      expect(result).toBeNull();
    });
  });

  describe('handleCorsPreflightResponse', () => {
    it('returns 204 with CORS headers for allowed origin', async () => {
      process.env.ALLOWED_ORIGINS = 'https://faroway.ai';
      const { handleCorsPreflightResponse } = await import('@/lib/security/cors');

      const request = new NextRequest(new URL('http://localhost:3000/api/test'), {
        headers: { origin: 'https://faroway.ai' },
      });

      const response = handleCorsPreflightResponse(request);
      expect(response.status).toBe(204);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://faroway.ai');
      expect(response.headers.get('Access-Control-Max-Age')).toBe('86400');
    });

    it('returns 204 without Allow-Origin for disallowed origin', async () => {
      process.env.ALLOWED_ORIGINS = 'https://faroway.ai';
      const { handleCorsPreflightResponse } = await import('@/lib/security/cors');

      const request = new NextRequest(new URL('http://localhost:3000/api/test'), {
        headers: { origin: 'https://evil.com' },
      });

      const response = handleCorsPreflightResponse(request);
      expect(response.status).toBe(204);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
    });
  });
});
