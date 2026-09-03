import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { AppError } from "@/lib/errors";
import { readJsonBody } from "@/lib/http";
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
    const body = await readJsonBody(request);
    const group = await createGroup(profileId, {
      name: body.name as string,
      avatarEmoji: body.avatarEmoji as string | undefined,
      avatarUrl: body.avatarUrl as string | undefined,
      description: body.description as string | undefined,
      isPublic: body.isPublic as boolean | undefined,
      inviteIds: body.inviteIds as string[] | undefined,
    });
    return NextResponse.json({ group });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
