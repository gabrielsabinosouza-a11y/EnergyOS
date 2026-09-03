import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { AppError } from "@/lib/errors";
import { readJsonBody } from "@/lib/http";
import { createGroupWithUsernames } from "@/lib/db/groups";

export async function POST(request: NextRequest) {
  try {
    const { profileId } = await requireAuth(request);
    const body = await readJsonBody(request);
    
    // Process member usernames - remove @ prefix if present
    const memberUsernames = Array.isArray(body.memberUsernames)
      ? (body.memberUsernames as string[]).map((username) =>
          username.startsWith('@') ? username.slice(1) : username,
        )
      : undefined;
    
    const group = await createGroupWithUsernames(profileId, {
      name: body.name as string | undefined,
      avatarEmoji: body.avatarEmoji as string | undefined,
      avatarUrl: body.avatarUrl as string | undefined,
      description: body.description as string | undefined,
      isPublic: body.isPublic as boolean | undefined,
      memberUsernames,
    });
    
    return NextResponse.json({ group });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
