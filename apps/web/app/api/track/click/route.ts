/**
 * Affiliate Click Tracking API
 * POST /api/track/click - Track when user clicks an affiliate link
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase/server';
import { optionalAuth } from '@/lib/auth';
import { z } from 'zod';


const ClickTrackingSchema = z.object({
  // What was clicked
  itemType: z.enum(['hotel', 'activity', 'restaurant', 'flight']),
  itemId: z.string(),
  itemName: z.string(),
  
  // Affiliate info
  affiliatePartner: z.string(),
  affiliateUrl: z.string(),
  
  // Context
  searchId: z.string().uuid().optional(),
  tripId: z.string().uuid().optional(),
  
  // Pricing
  price: z.number().optional(),
  currency: z.string().optional(),
  
  // Source
  source: z.enum(['search_results', 'trip_view', 'itinerary', 'email']).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parseResult = ClickTrackingSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const data = parseResult.data;
    const user = await optionalAuth(request);

    // Generate a unique click ID for conversion tracking
    const clickId = `click_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Store click in database
    const { error } = await getSupabase().from('affiliate_clicks').insert({
      id: clickId,
      user_id: user?.id || null,
      item_type: data.itemType,
      item_id: data.itemId,
      item_name: data.itemName,
      affiliate_partner: data.affiliatePartner,
      affiliate_url: data.affiliateUrl,
      search_id: data.searchId || null,
      trip_id: data.tripId || null,
      price: data.price || null,
      currency: data.currency || 'USD',
      source: data.source || 'search_results',
      clicked_at: new Date().toISOString(),
      converted: false,
      conversion_value: null,
    });

    if (error) {
      console.error('[Click Tracking] Database error:', error);
      // Don't fail the request, just log it
    }

    // Return the click ID and redirect URL with tracking params
    const trackingUrl = new URL(data.affiliateUrl);
    trackingUrl.searchParams.set('utm_source', 'tripgenie');
    trackingUrl.searchParams.set('utm_medium', 'affiliate');
    trackingUrl.searchParams.set('utm_campaign', data.itemType);
    trackingUrl.searchParams.set('click_id', clickId);

    return NextResponse.json({
      clickId,
      redirectUrl: trackingUrl.toString(),
    });
  } catch (error) {
    console.error('[Click Tracking] Error:', error);
    return NextResponse.json(
      { error: 'Failed to track click' },
      { status: 500 }
    );
  }
}
