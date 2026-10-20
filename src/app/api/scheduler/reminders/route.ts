import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { handleRoute, jsonOk } from "@/lib/http";
import pool from "@/lib/db";

/**
 * Scheduler endpoint for sending reminders.
 * Runs every minute via cron or can be called manually.
 * Secured with SECRET_HEADER environment variable.
 */
export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    // Security check - require secret header
    const authHeader = request.headers.get("Authorization") || request.headers.get("x-scheduler-secret");
    const expectedSecret = process.env.SCHEDULER_SECRET;

    if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
      return jsonOk({ error: "Unauthorized" }, 401);
    }

    // Get current time in America/Sao_Paulo
    const nowInSP = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const nowInUTC = new Date(nowInSP.toISOString());

    // Find reminders due in the last minute window
    // We look for plans whose start_time - reminder_offset_min falls within the current minute
    const minuteWindowStart = new Date(nowInUTC);
    minuteWindowStart.setSeconds(0, 0);
    const minuteWindowEnd = new Date(minuteWindowStart);
    minuteWindowEnd.setSeconds(59, 999);

    // Query for occurrences with reminders due now
    // This needs to handle both legacy weekly_plans and recurring series
    const result = await pool.query(`
      with reminder_window as (
        select
          w.id as plan_id,
          w.profile_id,
          w.title,
          w.reminder_offset_min,
          w.start_time,
          w.plan_date,
          null as series_id,
          null as occurrence_id,
          w.category_id,
          c.name as category_name,
          c.color as category_color
        from weekly_plans w
        join categories c on c.id = w.category_id
        where w.reminder_offset_min is not null
          and w.reminder_offset_min >= 0
          and w.completed_at is null

        union all

        select
          occ.id as plan_id,
          s.profile_id,
          coalesce(occ.override_title, s.title) as title,
          coalesce(occ.reminder_offset_min, s.reminder_offset_min) as reminder_offset_min,
          coalesce(occ.override_start_time, s.start_time) as start_time,
          occ.occurrence_date as plan_date,
          s.id as series_id,
          occ.id as occurrence_id,
          s.category_id,
          c.name as category_name,
          c.color as category_color
        from weekly_plan_series s
        join categories c on c.id = s.category_id
        left join weekly_plan_occurrences occ on occ.series_id = s.id and occ.skipped = false and occ.completed_at is null
        where s.reminder_offset_min is not null
          and s.reminder_offset_min >= 0
          and s.archived = false
      )
      select * from reminder_window
      where reminder_offset_min is not null
        and start_time is not null
    `);

    const dueReminders = result.rows;

    // For each due reminder, check if we've already sent it
    const sentReminders = [];

    for (const reminder of dueReminders) {
      const startTime = reminder.start_time;
      const offsetMin = reminder.reminder_offset_min;

      // Calculate the reminder time
      const [hours, minutes] = startTime.split(':').map(Number);
      const planDateTime = new Date(reminder.plan_date);
      planDateTime.setHours(hours, minutes, 0, 0);

      const reminderTime = new Date(planDateTime);
      reminderTime.setMinutes(reminderTime.getMinutes() - offsetMin);

      // Check if this reminder is due now (within the current minute window)
      const reminderTimeUTC = new Date(reminderTime.toLocaleString("en-US", { timeZone: "UTC" }));
      if (reminderTimeUTC < minuteWindowStart || reminderTimeUTC > minuteWindowEnd) {
        continue;
      }

      // Create idempotency key
      const referenceKey = `${reminder.series_id || reminder.plan_id}:${reminder.plan_date}:${offsetMin}min`;
      const channel = 'in_app'; // We'll use in-app first, push later

      // Check if we've already sent this reminder
      const existing = await pool.query(
        `select id from reminder_deliveries where reference_key = $1 and channel = $2 and delivery_status = 'sent'`,
        [referenceKey, channel]
      );

      if (existing.rows.length > 0) {
        continue; // Already sent
      }

      // Send in-app notification via service worker
      // We store a record that will be picked up by the running app
      await pool.query(
        `insert into reminder_deliveries (reference_key, plan_title, profile_id, reminder_offset_min, scheduled_at, sent_at, delivery_status, channel, series_id, occurrence_id)
         values ($1, $2, $3, $4, $5, $5, 'sent', $6, $7, $8)`,
        [
          referenceKey,
          reminder.title,
          reminder.profile_id,
          offsetMin,
          nowInUTC,
          channel,
          reminder.series_id,
          reminder.occurrence_id,
        ]
      );

      sentReminders.push({
        planTitle: reminder.title,
        planDate: reminder.plan_date,
        startTime: startTime,
        offsetMin: offsetMin,
        profileId: reminder.profile_id,
      });
    }

    return jsonOk({
      success: true,
      remindersSent: sentReminders.length,
      reminders: sentReminders,
    });
  });
}

export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    // Health check endpoint
    return jsonOk({ status: "ok", timestamp: new Date().toISOString() });
  });
}