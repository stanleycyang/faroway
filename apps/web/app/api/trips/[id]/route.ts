import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const UpdateTripSchema = z.object({
  destination: z.string().min(1).max(200).trim().optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  travelers: z.number().int().min(1).max(50).optional(),
  status: z.enum(['draft', 'generating', 'generated', 'failed']).optional(),
  preferences: z.record(z.unknown()).optional(),
}).strict()

type Params = {
  params: Promise<{
    id: string
  }>
}

// GET /api/trips/[id] - Fetch a specific trip
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

    const supabase = await createClient()
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // TODO: Fetch trip from database
    // const { data: trip, error } = await supabase
    //   .from('trips')
    //   .select('*')
    //   .eq('id', id)
    //   .eq('user_id', user.id)
    //   .single()

    // Placeholder response
    return NextResponse.json({
      trip: {
        id,
        user_id: user.id,
      },
      message: `Placeholder: GET /api/trips/${id} endpoint`
    })
  } catch (error) {
    console.error('Error fetching trip:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT /api/trips/[id] - Update a specific trip
export async function PUT(
  request: NextRequest,
  { params }: Params
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    
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

    // TODO: Update trip in database
    // const { data: trip, error } = await supabase
    //   .from('trips')
    //   .update(body)
    //   .eq('id', id)
    //   .eq('user_id', user.id)
    //   .select()
    //   .single()

    // Placeholder response
    return NextResponse.json({
      trip: {
        id,
        ...body,
        user_id: user.id,
      },
      message: `Placeholder: PUT /api/trips/${id} endpoint`
    })
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
    const supabase = await createClient()
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // TODO: Delete trip from database
    // const { error } = await supabase
    //   .from('trips')
    //   .delete()
    //   .eq('id', id)
    //   .eq('user_id', user.id)

    // Placeholder response
    return NextResponse.json({
      message: `Placeholder: DELETE /api/trips/${id} endpoint`,
      deleted: true
    })
  } catch (error) {
    console.error('Error deleting trip:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
