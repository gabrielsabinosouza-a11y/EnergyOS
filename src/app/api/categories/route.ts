import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { handleRoute, jsonOk, readJsonBody } from "@/lib/http";
import { createCategory, listCategories } from "@/lib/db/categories";
import { assertObject } from "@/lib/db/validation";

export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    const categories = await listCategories(profileId);
    return jsonOk({ categories });
  });
}

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    const body = assertObject(await readJsonBody(request));
    const category = await createCategory(profileId, {
      name: body.name as string,
      color: body.color as string,
      icon: (body.icon as string | null | undefined) ?? null,
    });
    return jsonOk({ category }, 201);
  });
}
