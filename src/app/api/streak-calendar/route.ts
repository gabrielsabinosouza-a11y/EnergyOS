import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { handleRoute, jsonOk } from "@/lib/http";
import { getStreakCalendar } from "@/lib/db/tasks";
import { ValidationError } from "@/lib/db/validation";

export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);

    const url = new URL(request.url);
    const rawYear = url.searchParams.get("year");
    const rawMonth = url.searchParams.get("month");

    const year = rawYear ? Number(rawYear) : NaN;
    const month = rawMonth ? Number(rawMonth) : NaN;

    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      throw new ValidationError("Ano inválido.");
    }
    if (!Number.isInteger(month) || month < 0 || month > 11) {
      throw new ValidationError("Mês inválido.");
    }

    const byDate = await getStreakCalendar(profileId, year, month);
    return jsonOk({ year, month, days: byDate });
  });
}