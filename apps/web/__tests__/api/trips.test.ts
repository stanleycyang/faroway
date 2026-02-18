import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Mock Supabase ──────────────────────────────────────────────────────────────

const mockUser = { id: 'user-123', email: 'test@example.com' }

const mockTrip = {
  id: 'trip-1',
  user_id: 'user-123',
  destination: 'Tokyo',
  start_date: '2026-04-01',
  end_date: '2026-04-07',
  travelers: 2,
  status: 'draft',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

const mockItinerary = {
  days: [{ dayNumber: 1, date: '2026-04-01', title: 'Day 1' }],
  overview: 'A week in Tokyo',
  total_cost: 3000,
  packing_list: ['Passport'],
  general_tips: ['Learn basic Japanese phrases'],
  generated_at: '2026-01-02T00:00:00Z',
}

let mockAuthReturn: { data: { user: any }; error: any }
let mockSelectReturn: any
let mockInsertReturn: any
let mockUpdateReturn: any
let mockDeleteReturn: any
let mockItineraryReturn: any

const mockSingle = vi.fn()
const mockEq = vi.fn()

const mockSupabase = {
  auth: {
    getUser: vi.fn(() => mockAuthReturn),
  },
  from: vi.fn((table: string) => {
    if (table === 'itineraries') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => mockItineraryReturn),
          })),
        })),
      }
    }
    // trips table
    return {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => mockSelectReturn),
          })),
          order: vi.fn(() => mockSelectReturn),
        })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => mockInsertReturn),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(() => mockUpdateReturn),
            })),
          })),
        })),
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => mockDeleteReturn),
        })),
      })),
    }
  }),
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => mockSupabase),
}))

// ── Import route handlers after mocking ────────────────────────────────────────

import { GET as getTrips, POST } from '@/app/api/trips/route'
import {
  GET as getTrip,
  PATCH,
  DELETE,
} from '@/app/api/trips/[id]/route'

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeRequest(method: string, url: string, body?: object): NextRequest {
  const init: any = { method }
  if (body) {
    init.body = JSON.stringify(body)
    init.headers = { 'Content-Type': 'application/json' }
  }
  return new NextRequest(new URL(url, 'http://localhost:3000'), init)
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('GET /api/trips', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthReturn = { data: { user: mockUser }, error: null }
  })

  it('returns user trips array', async () => {
    mockSelectReturn = { data: [mockTrip], error: null }
    const req = makeRequest('GET', '/api/trips')
    const res = await getTrips(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.trips).toHaveLength(1)
    expect(json.trips[0].destination).toBe('Tokyo')
  })

  it('returns 401 when not authenticated', async () => {
    mockAuthReturn = { data: { user: null }, error: { message: 'No session' } }
    const req = makeRequest('GET', '/api/trips')
    const res = await getTrips(req)

    expect(res.status).toBe(401)
  })
})

describe('POST /api/trips', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthReturn = { data: { user: mockUser }, error: null }
  })

  it('creates a trip and returns 201', async () => {
    mockInsertReturn = { data: mockTrip, error: null }
    const req = makeRequest('POST', '/api/trips', {
      destination: 'Tokyo',
      start_date: '2026-04-01',
      end_date: '2026-04-07',
      travelers: 2,
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(json.trip.destination).toBe('Tokyo')
  })

  it('returns 400 for invalid input', async () => {
    const req = makeRequest('POST', '/api/trips', {
      destination: '',
    })
    const res = await POST(req)

    expect(res.status).toBe(400)
  })
})

describe('GET /api/trips/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthReturn = { data: { user: mockUser }, error: null }
  })

  it('returns trip with itinerary data', async () => {
    mockSelectReturn = { data: mockTrip, error: null }
    mockItineraryReturn = { data: mockItinerary, error: null }

    const req = makeRequest('GET', '/api/trips/trip-1')
    const res = await getTrip(req, makeParams('trip-1'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.trip.id).toBe('trip-1')
    expect(json.trip.itinerary).toBeDefined()
    expect(json.trip.itinerary.overview).toBe('A week in Tokyo')
  })

  it('returns 404 for nonexistent trip', async () => {
    mockSelectReturn = { data: null, error: { code: 'PGRST116', message: 'Not found' } }

    const req = makeRequest('GET', '/api/trips/nonexistent')
    const res = await getTrip(req, makeParams('nonexistent'))

    expect(res.status).toBe(404)
  })

  it('returns 400 for invalid trip ID', async () => {
    const req = makeRequest('GET', '/api/trips/invalid%20id!')
    const res = await getTrip(req, makeParams('invalid id!'))

    expect(res.status).toBe(400)
  })
})

describe('PATCH /api/trips/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthReturn = { data: { user: mockUser }, error: null }
  })

  it('updates trip fields', async () => {
    const updatedTrip = { ...mockTrip, destination: 'Osaka' }
    mockUpdateReturn = { data: updatedTrip, error: null }

    const req = makeRequest('PATCH', '/api/trips/trip-1', {
      destination: 'Osaka',
    })
    const res = await PATCH(req, makeParams('trip-1'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.trip.destination).toBe('Osaka')
  })

  it('returns 400 for invalid input', async () => {
    const req = makeRequest('PATCH', '/api/trips/trip-1', {
      unknown_field: 'bad',
    })
    const res = await PATCH(req, makeParams('trip-1'))

    expect(res.status).toBe(400)
  })

  it('returns 404 when trip not found', async () => {
    mockUpdateReturn = { data: null, error: { code: 'PGRST116', message: 'Not found' } }

    const req = makeRequest('PATCH', '/api/trips/trip-1', {
      destination: 'Osaka',
    })
    const res = await PATCH(req, makeParams('trip-1'))

    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/trips/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthReturn = { data: { user: mockUser }, error: null }
  })

  it('deletes trip and returns success', async () => {
    mockDeleteReturn = { error: null, count: 1 }

    const req = makeRequest('DELETE', '/api/trips/trip-1')
    const res = await DELETE(req, makeParams('trip-1'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.deleted).toBe(true)
  })

  it('returns 404 for nonexistent trip', async () => {
    mockDeleteReturn = { error: null, count: 0 }

    const req = makeRequest('DELETE', '/api/trips/nonexistent')
    const res = await DELETE(req, makeParams('nonexistent'))

    expect(res.status).toBe(404)
  })
})
