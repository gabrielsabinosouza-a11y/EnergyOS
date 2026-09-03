import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { AppError } from "@/lib/errors";
import { rateLimitForProfile } from "@/lib/rate-limit";
import { readJsonBody } from "@/lib/http";
import { startDirectChatByUsername, sendDirectMessageByUsername } from "@/lib/db/messages";

export async function GET(request: NextRequest) {
  try {
    const { profileId } = await requireAuth(request);
    const username = request.nextUrl.searchParams.get("username") ?? "";

    // Remove @ prefix if present
    const cleanUsername = username.startsWith('@') ? username.slice(1) : username;
    
    const result = await startDirectChatByUsername(profileId, cleanUsername);
    
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { profileId } = await requireAuth(request);
    rateLimitForProfile(profileId, "dm-send", 20, 60_000);
    const username = request.nextUrl.searchParams.get("username") ?? "";
    const body = await readJsonBody(request);
    
    // Remove @ prefix if present
    const cleanUsername = username.startsWith('@') ? username.slice(1) : username;
    
    const message = await sendDirectMessageByUsername(profileId, cleanUsername, body.body as string);
    
    return NextResponse.json({ message });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
