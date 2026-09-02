import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { AppError } from "@/lib/errors";
import { updateGroupDetails, updateGroupAvatar } from "@/lib/db/groups";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { profileId } = await requireAuth(request);
    const { id } = await params;
    const body = await request.json();
    
    await updateGroupDetails(profileId, Number(id), {
      name: body.name,
      description: body.description,
      isPublic: body.isPublic,
    });

    if (body.avatarUrl !== undefined) {
      await updateGroupAvatar(profileId, Number(id), body.avatarUrl);
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}