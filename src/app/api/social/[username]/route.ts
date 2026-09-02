import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { AppError } from "@/lib/errors";
import { getUserByUsername } from "@/lib/db/social";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { profileId } = await requireAuth(request);
    const { username } = await params;
    
    // Remove @ prefix if present
    const cleanUsername = username.startsWith('@') ? username.slice(1) : username;
    
    const user = await getUserByUsername(cleanUsername);
    
    if (!user) {
      return NextResponse.json({ error: `Usuário @${cleanUsername} não encontrado.` }, { status: 404 });
    }
    
    return NextResponse.json({ user });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
