import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { AppError } from "@/lib/errors";
import { readJsonBody } from "@/lib/http";
import { getGroupMemberContributions } from "@/lib/db/group-leaderboard";
import { removeMember, setMemberMuted, updateMemberRole } from "@/lib/db/groups";
import type { GroupRole } from "@/types";

type Period = "WEEK" | "MONTH" | "YEAR" | "ALL_TIME";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { profileId } = await requireAuth(request);
    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;
    
    const period = (searchParams.get("period") as Period) || "WEEK";
    const validPeriods: Period[] = ["WEEK", "MONTH", "YEAR", "ALL_TIME"];
    if (!validPeriods.includes(period)) {
      return NextResponse.json({ error: "Período inválido." }, { status: 400 });
    }

    const result = await getGroupMemberContributions(profileId, Number(id), period);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}

const ROLES: GroupRole[] = ["OWNER", "ADMIN", "MEMBER"];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { profileId } = await requireAuth(request);
    const { id } = await params;
    const body = await readJsonBody(request);
    const targetProfileId = typeof body.profileId === "string" ? body.profileId : "";
    const role = typeof body.role === "string" ? body.role : "";
    if (!targetProfileId) {
      return NextResponse.json({ error: "profileId é obrigatório." }, { status: 400 });
    }
    if (body.muted !== undefined) {
      await setMemberMuted(profileId, Number(id), targetProfileId, Boolean(body.muted));
      return NextResponse.json({ success: true });
    }
    if (!ROLES.includes(role as GroupRole)) {
      return NextResponse.json({ error: "Função inválida." }, { status: 400 });
    }
    await updateMemberRole(profileId, Number(id), targetProfileId, role as GroupRole);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { profileId } = await requireAuth(request);
    const { id } = await params;
    const body = await readJsonBody(request);
    const targetProfileId = typeof body.profileId === "string" ? body.profileId : "";
    if (!targetProfileId) {
      return NextResponse.json({ error: "profileId é obrigatório." }, { status: 400 });
    }
    await removeMember(profileId, Number(id), targetProfileId);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}