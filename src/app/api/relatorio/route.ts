import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { handleRoute, jsonOk } from "@/lib/http";
import { listCheckins, averagesForRange } from "@/lib/db/checkins";
import { dailyCompletions, computeStreak } from "@/lib/db/tasks";
import { listInsights } from "@/lib/db/insights";
import { addDaysIso, todayIso } from "@/lib/db/dates";

export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    const daysParam = request.nextUrl.searchParams.get("days");
    const days = daysParam ? parseInt(daysParam, 10) : 7;
    
    const today = todayIso();
    const fromDate = addDaysIso(today, -days + 1);
    
    const [checkins, completions, currentStreak] = await Promise.all([
      listCheckins(profileId, fromDate, today),
      dailyCompletions(profileId, fromDate, today),
      computeStreak(profileId, today),
    ]);

    // Calculate weekly comparison
    const thisWeekStart = addDaysIso(today, -6);
    const lastWeekStart = addDaysIso(today, -13);
    const lastWeekEnd = addDaysIso(today, -7);
    
    const [thisWeekAvg, lastWeekAvg] = await Promise.all([
      averagesForRange(profileId, thisWeekStart, today),
      averagesForRange(profileId, lastWeekStart, lastWeekEnd),
    ]);

    // Calculate streak stats (mock for now, would need historical data)
    const streakInfo = {
      currentStreak: currentStreak.currentStreak,
      bestStreak: currentStreak.currentStreak, // Would need historical tracking
      totalDays: checkins.length,
    };

    const weeklyComparison = {
      thisWeek: {
        sleep: thisWeekAvg.sleepHours ?? 0,
        study: thisWeekAvg.studyMinutes ?? 0,
        tasks: thisWeekAvg.daysWithCheckin > 0 
          ? Math.round((completions.filter(c => c.date >= thisWeekStart).reduce((sum, c) => sum + c.completed, 0) / 
             completions.filter(c => c.date >= thisWeekStart).reduce((sum, c) => sum + c.total, 0)) * 100)
          : 0,
      },
      lastWeek: {
        sleep: lastWeekAvg.sleepHours ?? 0,
        study: lastWeekAvg.studyMinutes ?? 0,
        tasks: lastWeekAvg.daysWithCheckin > 0 
          ? Math.round((completions.filter(c => c.date >= lastWeekStart && c.date <= lastWeekEnd).reduce((sum, c) => sum + c.completed, 0) / 
             completions.filter(c => c.date >= lastWeekStart && c.date <= lastWeekEnd).reduce((sum, c) => sum + c.total, 0)) * 100)
          : 0,
      },
    };

    return jsonOk({
      checkins,
      completions: completions.map(c => ({
        date: c.date,
        due_date: c.date, // Add for compatibility
        completed: c.completed,
        total: c.total
      })),
      streakInfo,
      weeklyComparison,
    });
  });
}