import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// ─── Mock Supabase ──────────────────────────────────────────────────────────

let mockGetUserReturn: { data: { user: unknown }; error: unknown };

const mockSupabase = {
  auth: {
    getUser: vi.fn(() => mockGetUserReturn),
  },
};

vi.mock('@/lib/supabase/server', () => ({
  getSupabase: vi.fn(() => mockSupabase),
}));

// ─── Imports under test ─────────────────────────────────────────────────────

import {
  validateAuth,
  requireAuth,
  optionalAuth,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
  validationErrorResponse,
} from '@/lib/auth/middleware';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeRequest(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(new URL('http://localhost:3000/test'), { headers });
}

const validUser = {
  id: 'user-123',
  email: 'test@example.com',
  role: 'authenticated',
};

// ─── validateAuth ───────────────────────────────────────────────────────────

describe('validateAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns authenticated with user data for a valid Bearer token', async () => {
    mockGetUserReturn = { data: { user: validUser }, error: null };

    const request = makeRequest({ Authorization: 'Bearer valid-token' });
    const result = await validateAuth(request);

    expect(result).toEqual({
      authenticated: true,
      user: { id: 'user-123', email: 'test@example.com', role: 'authenticated' },
    });
    expect(mockSupabase.auth.getUser).toHaveBeenCalledWith('valid-token');
  });

  it('returns not authenticated for missing Authorization header', async () => {
    const request = makeRequest();
    const result = await validateAuth(request);

    expect(result).toEqual({
      authenticated: false,
      user: null,
      error: 'Missing or invalid Authorization header',
    });
    expect(mockSupabase.auth.getUser).not.toHaveBeenCalled();
  });

  it('returns not authenticated for non-Bearer token', async () => {
    const request = makeRequest({ Authorization: 'Basic xxx' });
    const result = await validateAuth(request);

    expect(result).toEqual({
      authenticated: false,
      user: null,
      error: 'Missing or invalid Authorization header',
    });
    expect(mockSupabase.auth.getUser).not.toHaveBeenCalled();
  });

  it('returns not authenticated when getUser returns an error', async () => {
    mockGetUserReturn = { data: { user: null }, error: { message: 'Token expired' } };

    const request = makeRequest({ Authorization: 'Bearer expired-token' });
    const result = await validateAuth(request);

    expect(result).toEqual({
      authenticated: false,
      user: null,
      error: 'Token expired',
    });
  });

  it('returns not authenticated when getUser returns null user', async () => {
    mockGetUserReturn = { data: { user: null }, error: null };

    const request = makeRequest({ Authorization: 'Bearer bad-token' });
    const result = await validateAuth(request);

    expect(result).toEqual({
      authenticated: false,
      user: null,
      error: 'Invalid token',
    });
  });

  it('returns not authenticated when getUser throws', async () => {
    mockSupabase.auth.getUser.mockImplementationOnce(() => {
      throw new Error('Network failure');
    });

    const request = makeRequest({ Authorization: 'Bearer crash-token' });
    const result = await validateAuth(request);

    expect(result).toEqual({
      authenticated: false,
      user: null,
      error: 'Token validation failed',
    });
  });
});

// ─── requireAuth ────────────────────────────────────────────────────────────

describe('requireAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns AuthResult for a valid token', async () => {
    mockGetUserReturn = { data: { user: validUser }, error: null };

    const request = makeRequest({ Authorization: 'Bearer valid-token' });
    const result = await requireAuth(request);

    expect(result).toEqual({
      authenticated: true,
      user: { id: 'user-123', email: 'test@example.com', role: 'authenticated' },
    });
  });

  it('returns a 401 NextResponse for an invalid token', async () => {
    mockGetUserReturn = { data: { user: null }, error: { message: 'Invalid token' } };

    const request = makeRequest({ Authorization: 'Bearer bad-token' });
    const result = await requireAuth(request);

    expect(result).toBeInstanceOf(NextResponse);
    const response = result as NextResponse;
    expect(response.status).toBe(401);

    const body = await response.json();
    expect(body).toEqual({ error: 'Invalid token', code: 'UNAUTHORIZED' });
  });
});

// ─── optionalAuth ───────────────────────────────────────────────────────────

describe('optionalAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns AuthUser for a valid token', async () => {
    mockGetUserReturn = { data: { user: validUser }, error: null };

    const request = makeRequest({ Authorization: 'Bearer valid-token' });
    const result = await optionalAuth(request);

    expect(result).toEqual({
      id: 'user-123',
      email: 'test@example.com',
      role: 'authenticated',
    });
  });

  it('returns null for a missing or invalid token', async () => {
    const request = makeRequest();
    const result = await optionalAuth(request);

    expect(result).toBeNull();
  });
});

// ─── Response helpers ───────────────────────────────────────────────────────

describe('unauthorizedResponse', () => {
  it('returns 401 with default message', async () => {
    const response = unauthorizedResponse();

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toEqual({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
  });

  it('returns 401 with a custom message', async () => {
    const response = unauthorizedResponse('Session expired');

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toEqual({ error: 'Session expired', code: 'UNAUTHORIZED' });
  });
});

describe('forbiddenResponse', () => {
  it('returns 403 with default message', async () => {
    const response = forbiddenResponse();

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body).toEqual({ error: 'Forbidden', code: 'FORBIDDEN' });
  });
});

describe('notFoundResponse', () => {
  it('returns 404 with default message', async () => {
    const response = notFoundResponse();

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body).toEqual({ error: 'Not found', code: 'NOT_FOUND' });
  });
});

describe('validationErrorResponse', () => {
  it('returns 400 with message and details', async () => {
    const details = { field: 'email', reason: 'invalid format' };
    const response = validationErrorResponse('Validation failed', details);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: { field: 'email', reason: 'invalid format' },
    });
  });
});
