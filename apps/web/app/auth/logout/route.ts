import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withAuthRequestDeadline } from "@/lib/auth/request-deadline";

export async function POST(request: Request) {
  const { origin } = new URL(request.url);
  let destination = "/auth/login";
  try {
    const supabase = await createClient();
    const { error } = await withAuthRequestDeadline(supabase.auth.signOut());
    if (error) destination = "/auth/logout-error";
  } catch {
    destination = "/auth/logout-error";
  }
  return NextResponse.redirect(new URL(destination, origin), { status: 303 });
}
