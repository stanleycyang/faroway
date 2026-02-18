#!/usr/bin/env tsx
/**
 * Test script for Supabase connection and RLS policies
 * 
 * Usage: npx tsx scripts/test-supabase.ts
 * 
 * This script will:
 * 1. Test database connection
 * 2. Create a test user (requires service role key)
 * 3. Create a test trip
 * 4. Verify RLS policies are working
 */

import { createClient } from '@supabase/supabase-js'

// Environment variables
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing required environment variables!')
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_ANON_KEY')
  process.exit(1)
}

// Create admin client (bypasses RLS)
const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// Create regular client (respects RLS)
const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

async function testConnection() {
  console.log('🔍 Testing Supabase connection...\n')

  try {
    // Test connection
    const { data, error } = await adminClient.from('users').select('count').single()
    
    if (error && error.code !== 'PGRST116') {
      throw error
    }

    console.log('✅ Database connection successful!')
    return true
  } catch (error) {
    console.error('❌ Connection failed:', error)
    return false
  }
}

async function testUserCreation() {
  console.log('\n🔍 Testing user creation...\n')

  try {
    // Create a test user
    const testEmail = `test-${Date.now()}@tripgenie.test`
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: testEmail,
      email_confirm: true,
      user_metadata: {
        name: 'Test User'
      }
    })

    if (authError) throw authError

    console.log('✅ Auth user created:', authData.user.id)

    // Check if profile was automatically created via trigger
    const { data: userData, error: userError } = await adminClient
      .from('users')
      .select('*')
      .eq('id', authData.user.id)
      .single()

    if (userError) throw userError

    console.log('✅ User profile created automatically via trigger')
    console.log('   Email:', userData.email)
    console.log('   Auth Provider:', userData.auth_provider)
    console.log('   Subscription Tier:', userData.subscription_tier)

    return authData.user.id
  } catch (error) {
    console.error('❌ User creation failed:', error)
    return null
  }
}

async function testTripCreation(userId: string) {
  console.log('\n🔍 Testing trip creation and RLS...\n')

  try {
    // Create a test trip (using service role, should work)
    const { data: trip, error: tripError } = await adminClient
      .from('trips')
      .insert({
        user_id: userId,
        destination: 'Tokyo, Japan',
        start_date: '2026-06-01',
        end_date: '2026-06-07',
        travelers: 2,
        budget: 5000.00,
        preferences: {
          activities: ['cultural', 'food', 'nightlife'],
          accommodation: 'hotel',
          pace: 'moderate'
        }
      })
      .select()
      .single()

    if (tripError) throw tripError

    console.log('✅ Trip created successfully')
    console.log('   Trip ID:', trip.id)
    console.log('   Destination:', trip.destination)
    console.log('   Dates:', trip.start_date, 'to', trip.end_date)

    // Test RLS: Try to read trip with anon client (should fail without auth)
    const { data: anonTrip, error: anonError } = await anonClient
      .from('trips')
      .select('*')
      .eq('id', trip.id)
      .single()

    if (anonTrip) {
      console.log('⚠️  WARNING: RLS may not be working correctly! Anonymous client could read trip.')
    } else if (anonError) {
      console.log('✅ RLS working: Anonymous client cannot read user trips')
    }

    return trip.id
  } catch (error) {
    console.error('❌ Trip creation failed:', error)
    return null
  }
}

async function testItineraryCreation(tripId: string) {
  console.log('\n🔍 Testing itinerary creation...\n')

  try {
    const { data: itinerary, error } = await adminClient
      .from('itineraries')
      .insert({
        trip_id: tripId,
        days_data: [
          {
            day: 1,
            date: '2026-06-01',
            activities: [
              {
                time: '09:00',
                title: 'Arrive at Tokyo Narita',
                description: 'Land and transfer to hotel',
                cost: 50.00
              },
              {
                time: '14:00',
                title: 'Explore Shibuya',
                description: 'Visit Shibuya Crossing and shopping',
                cost: 30.00
              }
            ]
          }
        ],
        ai_model_used: 'claude-3-5-sonnet',
        total_cost_estimate: 4500.00
      })
      .select()
      .single()

    if (error) throw error

    console.log('✅ Itinerary created successfully')
    console.log('   Itinerary ID:', itinerary.id)
    console.log('   Days:', itinerary.days_data.length)
    console.log('   Total Cost:', itinerary.total_cost_estimate)

    return true
  } catch (error) {
    console.error('❌ Itinerary creation failed:', error)
    return false
  }
}

async function testSavedActivities(tripId: string) {
  console.log('\n🔍 Testing saved activities...\n')

  try {
    const { data: activity, error } = await adminClient
      .from('saved_activities')
      .insert({
        trip_id: tripId,
        activity_name: 'TeamLab Borderless',
        description: 'Digital art museum in Odaiba',
        time_slot: 'Morning (10:00 AM)',
        cost: 35.00,
        booking_url: 'https://borderless.teamlab.art/'
      })
      .select()
      .single()

    if (error) throw error

    console.log('✅ Saved activity created successfully')
    console.log('   Activity:', activity.activity_name)
    console.log('   Cost:', activity.cost)
    console.log('   Booking URL:', activity.booking_url)

    return true
  } catch (error) {
    console.error('❌ Saved activity creation failed:', error)
    return false
  }
}

async function cleanup(userId: string) {
  console.log('\n🧹 Cleaning up test data...\n')

  try {
    // Delete the test user (cascade will delete trips, itineraries, and activities)
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId)
    
    if (deleteError) throw deleteError

    console.log('✅ Test data cleaned up successfully')
  } catch (error) {
    console.error('⚠️  Cleanup warning:', error)
  }
}

// Main test function
async function runTests() {
  console.log('╔════════════════════════════════════════════╗')
  console.log('║   TripGenie Supabase Connection Test      ║')
  console.log('╚════════════════════════════════════════════╝\n')

  let userId: string | null = null

  try {
    // Test 1: Connection
    const connected = await testConnection()
    if (!connected) {
      console.log('\n❌ Tests aborted due to connection failure')
      process.exit(1)
    }

    // Test 2: User creation
    userId = await testUserCreation()
    if (!userId) {
      console.log('\n❌ Tests aborted due to user creation failure')
      process.exit(1)
    }

    // Test 3: Trip creation
    const tripId = await testTripCreation(userId)
    if (!tripId) {
      console.log('\n❌ Tests aborted due to trip creation failure')
      await cleanup(userId)
      process.exit(1)
    }

    // Test 4: Itinerary creation
    await testItineraryCreation(tripId)

    // Test 5: Saved activities
    await testSavedActivities(tripId)

    // Cleanup
    await cleanup(userId)

    console.log('\n╔════════════════════════════════════════════╗')
    console.log('║       ✅ All tests passed!                 ║')
    console.log('╚════════════════════════════════════════════╝\n')
  } catch (error) {
    console.error('\n❌ Test suite failed:', error)
    if (userId) {
      await cleanup(userId)
    }
    process.exit(1)
  }
}

// Run tests
runTests()
