import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { AppError } from "@/lib/errors";
import { listGroups, createGroup } from "@/lib/db/groups";

export async function GET(request: NextRequest) {
  try {
    const { profileId } = await requireAuth(request);
    const groups = await listGroups(profileId);
    return NextResponse.json({ groups });
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
    const body = await request.json();
    const group = await createGroup(profileId, {
      name: body.name,
      avatarEmoji: body.avatarEmoji,
      description: body.description,
      isPublic: body.isPublic,
      inviteIds: body.inviteIds,
    });
    return NextResponse.json({ group });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
