import { NextResponse } from "next/server";
import { currentPlanningDisclosure } from "@/lib/ai/planning-disclosure";

export async function GET() {
  return NextResponse.json(currentPlanningDisclosure(), {
    headers: { "Cache-Control": "no-store" },
  });
}
