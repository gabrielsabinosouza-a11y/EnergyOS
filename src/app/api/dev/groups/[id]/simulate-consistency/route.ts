import type { NextRequest } from "next/server";
import pool from "@/lib/db";
import { requireAuth } from "@/lib/server-auth";
import { ensureUserBootstrap } from "@/lib/db/bootstrap";
import { handleRoute, jsonOk } from "@/lib/http";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { addDaysIso, todayIso } from "@/lib/db/dates";
import { checkGroupAchievements } from "@/lib/db/group-achievements";
import { GROUP_ACHIEVEMENTS } from "@/lib/db/group-achievement-config";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (process.env.NODE_ENV !== "development") {
    return jsonOk({ error: "Not found." }, 404);
  }

  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    await ensureUserBootstrap(profileId);
    const groupId = Number((await params).id);
    if (!Number.isInteger(groupId) || groupId <= 0) {
      throw new NotFoundError("Grupo inválido.");
    }

    const client = await pool.connect();
    try {
      await client.query("begin");
      const admin = await client.query(
        `select 1 from group_members
         where group_id = $1 and profile_id = $2
           and role in ('OWNER', 'ADMIN') and is_banned = false
         for update`,
        [groupId, profileId],
      );
      if (!admin.rows[0]) throw new ForbiddenError("Somente administradores podem executar a simulação.");

      const members = await client.query<{ profile_id: string }>(
        `select profile_id from group_members
         where group_id = $1 and is_banned = false
         order by joined_at, profile_id limit 2`,
        [groupId],
      );
      if (members.rows.length < GROUP_ACHIEVEMENTS.consistencia_de_equipe.minimumMembers) {
        throw new NotFoundError("O grupo precisa de pelo menos dois membros ativos.");
      }

      const today = todayIso();
      for (let offset = GROUP_ACHIEVEMENTS.consistencia_de_equipe.consecutiveDays - 1; offset >= 0; offset -= 1) {
        const day = addDaysIso(today, -offset);
        for (const { profile_id: memberId } of members.rows) {
          const session = await client.query<{ id: number }>(
            `insert into focus_sessions
               (profile_id, duration_minutes, target_duration_minutes, started_at, ended_at)
             values (
               $1, 10, 10,
               ($2::date::timestamp + interval '12 hours') at time zone 'America/Sao_Paulo',
               ($2::date::timestamp + interval '12 hours 10 minutes') at time zone 'America/Sao_Paulo'
             )
             returning id`,
            [memberId, day],
          );
          await client.query(
            `insert into group_focus_contributions
               (group_id, profile_id, focus_session_id, minutes, contributed_at)
             values (
               $1, $2, $3, 10,
               ($4::date::timestamp + interval '12 hours 10 minutes') at time zone 'America/Sao_Paulo'
             )`,
            [groupId, memberId, session.rows[0].id, day],
          );
        }
      }
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }

    const unlockedGroupAchievements = await checkGroupAchievements(groupId);
    return jsonOk({
      simulatedDays: GROUP_ACHIEVEMENTS.consistencia_de_equipe.consecutiveDays,
      simulatedMembers: GROUP_ACHIEVEMENTS.consistencia_de_equipe.minimumMembers,
      unlockedGroupAchievements,
    });
  });
}
