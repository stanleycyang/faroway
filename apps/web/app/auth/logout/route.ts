import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  
  // Sign out the user
  await supabase.auth.signOut()
  
  // Get the origin for redirect
  const { origin } = new URL(request.url)
  
  // Redirect to home page after logout
  return NextResponse.redirect(`${origin}/`, {
    status: 302
  })
}

export async function GET(request: Request) {
  // Also support GET for simple logout links
  const supabase = await createClient()
  
  await supabase.auth.signOut()
  
  const { origin } = new URL(request.url)
  
  return NextResponse.redirect(`${origin}/`, {
    status: 302
  })
}
