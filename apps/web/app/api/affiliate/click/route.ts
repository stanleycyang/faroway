/**
 * Affiliate Click Tracking API
 * 
 * POST /api/affiliate/click
 * Records a click and returns a redirect URL with tracking params
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  trackClick,
  generateViatorAffiliateUrl,
  generateBookingAffiliateUrl,
  type AffiliatePartner,
} from '@/lib/affiliates';

interface ClickRequest {
  tripId?: string;
  activityId?: string;
  partner: AffiliatePartner;
  productId: string;
  productName: string;
  // Optional booking context
  date?: string;
  travelers?: number;
  checkIn?: string;
  checkOut?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: ClickRequest = await request.json();
    
    // Validate required fields
    if (!body.partner || !body.productId || !body.productName) {
      return NextResponse.json(
        { error: 'Missing required fields: partner, productId, productName' },
        { status: 400 }
      );
    }

    // Validate partner
    const validPartners: AffiliatePartner[] = ['viator', 'booking', 'getyourguide', 'tripadvisor'];
    if (!validPartners.includes(body.partner)) {
      return NextResponse.json(
        { error: `Invalid partner. Must be one of: ${validPartners.join(', ')}` },
        { status: 400 }
      );
    }

    // Get user info from headers
    const userId = request.headers.get('x-user-id') || undefined;
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0] || 
                      request.headers.get('x-real-ip') ||
                      'unknown';
    const userAgent = request.headers.get('user-agent') || undefined;
    const referrerUrl = request.headers.get('referer') || undefined;

    // Track the click
    const { trackingId, click } = await trackClick({
      userId,
      tripId: body.tripId,
      activityId: body.activityId,
      partner: body.partner,
      productId: body.productId,
      productName: body.productName,
      referrerUrl,
      ipAddress,
      userAgent,
    });

    // Generate affiliate URL based on partner
    let redirectUrl: string;

    switch (body.partner) {
      case 'viator':
        redirectUrl = generateViatorAffiliateUrl(body.productId, trackingId, {
          date: body.date,
          travelers: body.travelers,
        });
        break;

      case 'booking':
        redirectUrl = generateBookingAffiliateUrl(body.productId, trackingId, {
          checkIn: body.checkIn,
          checkOut: body.checkOut,
          guests: body.travelers,
        });
        break;

      case 'getyourguide':
        // GetYourGuide URL format
        redirectUrl = `https://www.getyourguide.com/${body.productId}?partner_id=tripgenie&cmp=${trackingId}`;
        break;

      case 'tripadvisor':
        // TripAdvisor URL format
        redirectUrl = `https://www.tripadvisor.com/${body.productId}?m=tripgenie&mcid=${trackingId}`;
        break;

      default:
        return NextResponse.json(
          { error: 'Partner not supported for redirect generation' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      trackingId,
      redirectUrl,
      click: {
        id: click.id,
        partner: click.partner,
        productId: click.productId,
        clickedAt: click.clickedAt,
      },
    });
  } catch (error) {
    console.error('[Affiliate Click API] Error:', error);
    
    return NextResponse.json(
      { error: 'Failed to track affiliate click' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/affiliate/click?trackingId=xxx
 * Get click details by tracking ID
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const trackingId = searchParams.get('trackingId');

    if (!trackingId) {
      return NextResponse.json(
        { error: 'Missing trackingId parameter' },
        { status: 400 }
      );
    }

    const { getClickByTrackingId } = await import('@/lib/affiliates');
    const click = await getClickByTrackingId(trackingId);

    if (!click) {
      return NextResponse.json(
        { error: 'Click not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      click,
    });
  } catch (error) {
    console.error('[Affiliate Click API] Error:', error);
    
    return NextResponse.json(
      { error: 'Failed to get click details' },
      { status: 500 }
    );
  }
}
