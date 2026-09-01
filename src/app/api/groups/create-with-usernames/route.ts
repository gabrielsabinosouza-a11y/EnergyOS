import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { AppError } from "@/lib/errors";
import { createGroupWithUsernames } from "@/lib/db/groups";

export async function POST(request: NextRequest) {
  try {
    const { profileId } = await requireAuth(request);
    const body = await request.json();
    
    // Process member usernames - remove @ prefix if present
    const memberUsernames = body.memberUsernames?.map((username: string) => 
      username.startsWith('@') ? username.slice(1) : username
    );
    
    const group = await createGroupWithUsernames(profileId, {
      name: body.name,
      avatarEmoji: body.avatarEmoji,
      description: body.description,
      isPublic: body.isPublic,
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
