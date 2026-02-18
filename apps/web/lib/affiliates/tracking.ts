/**
 * Affiliate Click Tracking System
 * 
 * Tracks clicks on affiliate links for commission attribution.
 * Stores data in Supabase for analytics and revenue tracking.
 */

import { createClient } from '@supabase/supabase-js';
import { nanoid } from 'nanoid';

// Types
export type AffiliatePartner = 'viator' | 'booking' | 'getyourguide' | 'tripadvisor';

export interface AffiliateClick {
  id: string;
  userId?: string;
  tripId?: string;
  activityId?: string;
  partner: AffiliatePartner;
  productId: string;
  productName: string;
  trackingId: string;
  clickUrl: string;
  referrerUrl?: string;
  clickedAt: string;
  converted: boolean;
  convertedAt?: string;
  commissionAmount?: number;
  commissionCurrency?: string;
  ipAddress?: string;
  userAgent?: string;
  deviceType?: string;
}

export interface TrackClickInput {
  userId?: string;
  tripId?: string;
  activityId?: string;
  partner: AffiliatePartner;
  productId: string;
  productName: string;
  referrerUrl?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface TrackClickResult {
  trackingId: string;
  click: AffiliateClick;
}

export interface ConversionInput {
  trackingId: string;
  bookingId?: string;
  bookingAmount: number;
  commissionAmount: number;
  currency?: string;
}

// Supabase client
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !key) {
    throw new Error('Supabase not configured for affiliate tracking');
  }
  
  return createClient(url, key);
}

/**
 * Generate a unique tracking ID
 */
export function generateTrackingId(): string {
  const timestamp = Date.now().toString(36);
  const random = nanoid(8);
  return `tg_${timestamp}_${random}`;
}

/**
 * Detect device type from user agent
 */
export function detectDeviceType(userAgent?: string): string {
  if (!userAgent) return 'unknown';
  
  const ua = userAgent.toLowerCase();
  if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('android')) {
    return 'mobile';
  }
  if (ua.includes('tablet')) {
    return 'tablet';
  }
  return 'desktop';
}

/**
 * Track an affiliate click
 */
export async function trackClick(input: TrackClickInput): Promise<TrackClickResult> {
  const supabase = getSupabase();
  const trackingId = generateTrackingId();
  
  const click: Omit<AffiliateClick, 'id'> = {
    userId: input.userId,
    tripId: input.tripId,
    activityId: input.activityId,
    partner: input.partner,
    productId: input.productId,
    productName: input.productName,
    trackingId,
    clickUrl: '', // Will be set by the caller
    referrerUrl: input.referrerUrl,
    clickedAt: new Date().toISOString(),
    converted: false,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    deviceType: detectDeviceType(input.userAgent),
  };

  const { data, error } = await supabase
    .from('affiliate_clicks')
    .insert({
      user_id: click.userId,
      trip_id: click.tripId,
      activity_id: click.activityId,
      partner: click.partner,
      product_id: click.productId,
      product_name: click.productName,
      tracking_id: click.trackingId,
      click_url: click.clickUrl,
      referrer_url: click.referrerUrl,
      clicked_at: click.clickedAt,
      converted: click.converted,
      ip_address: click.ipAddress,
      user_agent: click.userAgent,
      device_type: click.deviceType,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[Tracking] Failed to record click:', error);
    throw new Error('Failed to track affiliate click');
  }

  return {
    trackingId,
    click: { ...click, id: data.id } as AffiliateClick,
  };
}

/**
 * Record a conversion (booking completed)
 */
export async function recordConversion(input: ConversionInput): Promise<boolean> {
  const supabase = getSupabase();

  const { error } = await supabase
    .from('affiliate_clicks')
    .update({
      converted: true,
      converted_at: new Date().toISOString(),
      commission_amount: input.commissionAmount,
      commission_currency: input.currency || 'USD',
    })
    .eq('tracking_id', input.trackingId);

  if (error) {
    console.error('[Tracking] Failed to record conversion:', error);
    return false;
  }

  return true;
}

/**
 * Get click by tracking ID
 */
export async function getClickByTrackingId(trackingId: string): Promise<AffiliateClick | null> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('affiliate_clicks')
    .select('*')
    .eq('tracking_id', trackingId)
    .single();

  if (error || !data) {
    return null;
  }

  return normalizeClick(data);
}

/**
 * Get clicks for a user
 */
export async function getUserClicks(
  userId: string,
  options?: { limit?: number; offset?: number }
): Promise<AffiliateClick[]> {
  const supabase = getSupabase();

  let query = supabase
    .from('affiliate_clicks')
    .select('*')
    .eq('user_id', userId)
    .order('clicked_at', { ascending: false });

  if (options?.limit) {
    query = query.limit(options.limit);
  }
  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[Tracking] Failed to get user clicks:', error);
    return [];
  }

  return (data || []).map(normalizeClick);
}

/**
 * Get analytics summary for a date range
 */
export async function getAffiliateAnalytics(
  startDate: string,
  endDate: string,
  options?: { partner?: AffiliatePartner; userId?: string }
): Promise<{
  totalClicks: number;
  totalConversions: number;
  conversionRate: number;
  totalCommission: number;
  byPartner: Record<AffiliatePartner, {
    clicks: number;
    conversions: number;
    commission: number;
  }>;
}> {
  const supabase = getSupabase();

  let query = supabase
    .from('affiliate_clicks')
    .select('partner, converted, commission_amount')
    .gte('clicked_at', startDate)
    .lte('clicked_at', endDate);

  if (options?.partner) {
    query = query.eq('partner', options.partner);
  }
  if (options?.userId) {
    query = query.eq('user_id', options.userId);
  }

  const { data, error } = await query;

  if (error || !data) {
    return {
      totalClicks: 0,
      totalConversions: 0,
      conversionRate: 0,
      totalCommission: 0,
      byPartner: {} as any,
    };
  }

  const byPartner: Record<string, { clicks: number; conversions: number; commission: number }> = {};

  for (const click of data) {
    if (!byPartner[click.partner]) {
      byPartner[click.partner] = { clicks: 0, conversions: 0, commission: 0 };
    }
    byPartner[click.partner].clicks++;
    if (click.converted) {
      byPartner[click.partner].conversions++;
      byPartner[click.partner].commission += click.commission_amount || 0;
    }
  }

  const totalClicks = data.length;
  const totalConversions = data.filter(c => c.converted).length;
  const totalCommission = data.reduce((sum, c) => sum + (c.commission_amount || 0), 0);

  return {
    totalClicks,
    totalConversions,
    conversionRate: totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0,
    totalCommission,
    byPartner: byPartner as any,
  };
}

/**
 * Normalize database row to AffiliateClick type
 */
function normalizeClick(row: any): AffiliateClick {
  return {
    id: row.id,
    userId: row.user_id,
    tripId: row.trip_id,
    activityId: row.activity_id,
    partner: row.partner,
    productId: row.product_id,
    productName: row.product_name,
    trackingId: row.tracking_id,
    clickUrl: row.click_url,
    referrerUrl: row.referrer_url,
    clickedAt: row.clicked_at,
    converted: row.converted,
    convertedAt: row.converted_at,
    commissionAmount: row.commission_amount,
    commissionCurrency: row.commission_currency,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    deviceType: row.device_type,
  };
}
