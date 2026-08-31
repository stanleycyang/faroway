import { NextResponse } from "next/server";

// Compatibility route for OAuth/email links created before the callback moved.
export function GET(request: Request) {
  const source = new URL(request.url);
  const destination = new URL("/auth/callback", source.origin);
  destination.search = source.search;
  return NextResponse.redirect(destination, 308);
}
