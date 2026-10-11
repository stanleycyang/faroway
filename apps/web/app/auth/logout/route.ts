import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();

  // Sign out the user
  await supabase.auth.signOut();

  // Get the origin for redirect
  const { origin } = new URL(request.url);

  // Complete the form submission with a fresh GET of the sign-in page.
  return NextResponse.redirect(`${origin}/login`, {
    status: 303,
  });
}
