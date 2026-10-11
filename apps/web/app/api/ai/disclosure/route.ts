import { NextResponse } from "next/server";
import { PLANNING_DISCLOSURE } from "@/lib/ai/planning-disclosure";

export async function GET() {
  return NextResponse.json(PLANNING_DISCLOSURE, {
    headers: { "Cache-Control": "no-store" },
  });
}
