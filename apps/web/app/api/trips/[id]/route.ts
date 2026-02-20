import { NextRequest, NextResponse } from 'next/server'
import { createClientFromRequest, getSupabase } from '@/lib/supabase/server'
import { z } from 'zod'

const UpdateTripSchema = z.object({
  destination: z.string().min(1).max(200).trim().optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  travelers: z.number().int().min(1).max(50).optional(),
  status: z.enum(['draft', 'generating', 'generated', 'failed']).optional(),
  preferences: z.record(z.unknown()).optional(),
  traveler_type: z.string().max(50).optional(),
  vibes: z.array(z.string().max(50)).max(10).optional(),
  budget_tier: z.string().max(50).optional(),
  cover_image: z.string().url().optional(),
}).strict()

type Params = {
  params: Promise<{
    id: string
  }>
}

/**
 * Resolve the current user (if authenticated). Returns null for anonymous users.
 */
async function resolveUser(request: NextRequest): Promise<string | null> {
  try {
    const supabase = await createClientFromRequest(request)
    const { data: { user } } = await supabase.auth.getUser()
    return user?.id ?? null
  } catch {
    return null
  }
}

// GET /api/trips/[id] - Fetch a specific trip with itinerary data
export async function GET(
  request: NextRequest,
  { params }: Params
) {
  try {
    const { id } = await params

    // Validate ID format
    if (!/^[a-zA-Z0-9-]+$/.test(id)) {
      return NextResponse.json({ error: 'Invalid trip ID' }, { status: 400 })
    }

    const userId = await resolveUser(request)
    const db = getSupabase()

    // Fetch trip with itinerary in a single joined query
    let query = db.from('trips')
      .select('id, destination, start_date, end_date, status, travelers, budget, preferences, vibes, interests, traveler_type, budget_tier, cover_image, user_id, created_at, updated_at, itineraries(days, overview, total_cost, packing_list, general_tips, generated_at)')
      .eq('id', id)
    if (userId) {
      // Authenticated: fetch trips owned by user OR anonymous trips
      query = query.or(`user_id.eq.${userId},user_id.is.null`)
    } else {
      // Anonymous: can only access anonymous trips
      query = query.is('user_id', null)
    }

    const { data: trip, error } = await query.single()

    if (error || !trip) {
      return NextResponse.json(
        { error: 'Trip not found' },
        { status: 404 }
      )
    }

    // Flatten the joined itinerary (Supabase returns array for 1-to-many)
    const { itineraries, ...tripData } = trip as any
    const itinerary = Array.isArray(itineraries) ? itineraries[0] || null : itineraries || null

    return NextResponse.json({
      trip: { ...tripData, itinerary },
    })
  } catch (error) {
    console.error('Error fetching trip:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH /api/trips/[id] - Update a specific trip
export async function PATCH(
  request: NextRequest,
  { params }: Params
) {
  try {
    const { id } = await params
    const userId = await resolveUser(request)
    const db = getSupabase()

    const body = await request.json()
    const parseResult = UpdateTripSchema.safeParse(body)

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parseResult.error.issues },
        { status: 400 }
      )
    }

    // Build the update query — scoped to owned or anonymous trips
    let query = db
      .from('trips')
      .update({ ...parseResult.data, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (userId) {
      query = query.or(`user_id.eq.${userId},user_id.is.null`)
    } else {
      query = query.is('user_id', null)
    }

    const { data: trip, error } = await query.select().single()

    if (error || !trip) {
      return NextResponse.json(
        { error: 'Trip not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ trip })
  } catch (error) {
    console.error('Error updating trip:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/trips/[id] - Delete a specific trip (requires authentication)
export async function DELETE(
  request: NextRequest,
  { params }: Params
) {
  try {
    const { id } = await params
    const supabase = await createClientFromRequest(request)

    // Delete requires authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { error, count } = await supabase
      .from('trips')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      console.error('Error deleting trip:', error)
      return NextResponse.json(
        { error: 'Failed to delete trip' },
        { status: 500 }
      )
    }

    if (count === 0) {
      return NextResponse.json(
        { error: 'Trip not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ deleted: true })
  } catch (error) {
    console.error('Error deleting trip:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
