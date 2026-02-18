/**
 * User Profile API
 * GET /api/user/profile - Get current user profile
 * PATCH /api/user/profile - Update user profile
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase/server';
import { requireAuth, validationErrorResponse, AuthResult } from '@/lib/auth/middleware';
import { z } from 'zod';


const UpdateProfileSchema = z.object({
  email: z.string().email().optional(),
  subscription_tier: z.enum(['free', 'pro', 'premium']).optional(),
});

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { user } = authResult as AuthResult;

  try {
    const { data: profile, error } = await getSupabase()
      .from('users')
      .select('*')
      .eq('id', user!.id)
      .single();

    if (error) {
      console.error('[User Profile] Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch profile' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      id: profile.id,
      email: profile.email,
      authProvider: profile.auth_provider,
      subscriptionTier: profile.subscription_tier,
      createdAt: profile.created_at,
      updatedAt: profile.updated_at,
    });
  } catch (error) {
    console.error('[User Profile] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const authResult = await requireAuth(request);
  
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { user } = authResult as AuthResult;

  try {
    const body = await request.json();
    const parseResult = UpdateProfileSchema.safeParse(body);

    if (!parseResult.success) {
      return validationErrorResponse('Invalid request body', parseResult.error.issues);
    }

    const updates: Record<string, unknown> = {};
    
    if (parseResult.data.email) {
      updates.email = parseResult.data.email;
    }
    if (parseResult.data.subscription_tier) {
      updates.subscription_tier = parseResult.data.subscription_tier;
    }

    if (Object.keys(updates).length === 0) {
      return validationErrorResponse('No fields to update');
    }

    const { data: profile, error } = await getSupabase()
      .from('users')
      .update(updates)
      .eq('id', user!.id)
      .select()
      .single();

    if (error) {
      console.error('[User Profile] Update error:', error);
      return NextResponse.json(
        { error: 'Failed to update profile' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      id: profile.id,
      email: profile.email,
      authProvider: profile.auth_provider,
      subscriptionTier: profile.subscription_tier,
      createdAt: profile.created_at,
      updatedAt: profile.updated_at,
    });
  } catch (error) {
    console.error('[User Profile] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
