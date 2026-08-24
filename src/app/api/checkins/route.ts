import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { handleRoute, jsonOk, readJsonBody } from "@/lib/http";
import { listCheckins, upsertCheckin } from "@/lib/db/checkins";
import { addDaysIso, todayIso } from "@/lib/db/dates";
import { assertObject, parseDate, parseNumber } from "@/lib/db/validation";

export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    const today = todayIso();
    const params = request.nextUrl.searchParams;
    const to = parseDate(params.get("to"), "Data final", today);
    const from = parseDate(params.get("from"), "Data inicial", addDaysIso(to, -29));
    const checkins = await listCheckins(profileId, from, to);
    return jsonOk({ checkins });
  });
}

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    const body = assertObject(await readJsonBody(request));
    const checkin = await upsertCheckin(
      profileId,
      {
        checkinDate: body.checkinDate as string | undefined,
        sleepHours: body.sleepHours === undefined ? undefined : parseNumber(body.sleepHours, "Horas de sono", { min: 0, max: 24 }),
        studyMinutes: body.studyMinutes === undefined ? undefined : parseNumber(body.studyMinutes, "Minutos de estudo", { min: 0, max: 1440, integer: true }),
        trainingMinutes: body.trainingMinutes === undefined ? undefined : parseNumber(body.trainingMinutes, "Minutos de treino", { min: 0, max: 1440, integer: true }),
        energyScore: body.energyScore === undefined ? undefined : parseNumber(body.energyScore, "Nível de energia", { min: 1, max: 5, integer: true }),
      },
      todayIso(),
    );
    return jsonOk(checkin, 201);
  });
}
