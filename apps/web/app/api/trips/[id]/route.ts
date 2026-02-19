import { NextRequest, NextResponse } from 'next/server'
import { createClientFromRequest } from '@/lib/supabase/server'
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

    const supabase = await createClientFromRequest(request)

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Fetch trip from database
    const { data: trip, error } = await supabase
      .from('trips')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (error || !trip) {
      return NextResponse.json(
        { error: 'Trip not found' },
        { status: 404 }
      )
    }

    // Fetch associated itinerary
    const { data: itinerary } = await supabase
      .from('itineraries')
      .select('days, overview, total_cost, packing_list, general_tips, generated_at')
      .eq('trip_id', id)
      .single()

    return NextResponse.json({
      trip: { ...trip, itinerary: itinerary || null },
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
    const supabase = await createClientFromRequest(request)

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const parseResult = UpdateTripSchema.safeParse(body)

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parseResult.error.issues },
        { status: 400 }
      )
    }

    const { data: trip, error } = await supabase
      .from('trips')
      .update({ ...parseResult.data, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

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

// DELETE /api/trips/[id] - Delete a specific trip
export async function DELETE(
  request: NextRequest,
  { params }: Params
) {
  try {
    const { id } = await params
    const supabase = await createClientFromRequest(request)

    // Get authenticated user
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
