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
