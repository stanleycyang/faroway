import { NextResponse } from "next/server";

function deprecatedEndpointResponse() {
  return NextResponse.json(
    {
      error: "Deprecated endpoint",
      code: "DEPRECATED_ENDPOINT",
      replacement: "/api/track/click",
    },
    { status: 410 },
  );
}

export async function POST(_request: Request) {
  void _request;
  return deprecatedEndpointResponse();
}

export async function GET(_request: Request) {
  void _request;
  return deprecatedEndpointResponse();
}
