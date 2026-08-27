import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { handleRoute, jsonOk, readJsonBody } from "@/lib/http";
import { deleteCategory, updateCategory } from "@/lib/db/categories";
import { assertObject } from "@/lib/db/validation";

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function resolveCategoryId(context: RouteContext): Promise<number> {
  const { id } = await context.params;
  return Number(id);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    const categoryId = await resolveCategoryId(context);
    const body = assertObject(await readJsonBody(request));
    const category = await updateCategory(profileId, categoryId, {
      name: body.name as string | undefined,
      color: body.color as string | undefined,
      icon: body.icon as string | null | undefined,
    });
    return jsonOk({ category });
  });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    const categoryId = await resolveCategoryId(context);
    const { affected } = await deleteCategory(profileId, categoryId);
    return jsonOk({ ok: true as const, affected });
  });
}
