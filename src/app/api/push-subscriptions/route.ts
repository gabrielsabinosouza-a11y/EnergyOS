import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { handleRoute, jsonOk, readJsonBody } from "@/lib/http";
import { ensureUserBootstrap } from "@/lib/db/bootstrap";
import pool from "@/lib/db";

export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    await ensureUserBootstrap(profileId);

    const result = await pool.query(`
      select endpoint, p256dh, auth, device_name, active
      from push_subscriptions
      where profile_id = $1 and active = true
    `, [profileId]);

    return jsonOk({ subscriptions: result.rows });
  });
}

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    await ensureUserBootstrap(profileId);

    const body = await readJsonBody(request);
    const { endpoint, p256dh, auth, deviceName } = body;

    if (!endpoint || !p256dh || !auth) {
      return jsonOk({ error: "Missing required fields" }, 400);
    }

    // Store or update subscription
    await pool.query(`
      insert into push_subscriptions (profile_id, endpoint, p256dh, auth, device_name, active)
      values ($1, $2, $3, $4, $5, true)
      on conflict (endpoint)
      do update set p256dh = excluded.p256dh, auth = excluded.auth, device_name = excluded.device_name, active = true, last_used_at = now()
    `, [profileId, endpoint, p256dh, auth, deviceName ?? null]);

    return jsonOk({ ok: true });
  });
}

export async function DELETE(request: NextRequest) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    await ensureUserBootstrap(profileId);

    const body = await readJsonBody(request);
    const { endpoint } = body;

    if (!endpoint) {
      return jsonOk({ error: "Missing endpoint" }, 400);
    }

    await pool.query(
      `update push_subscriptions set active = false where profile_id = $1 and endpoint = $2`,
      [profileId, endpoint]
    );

    return jsonOk({ ok: true });
  });
}