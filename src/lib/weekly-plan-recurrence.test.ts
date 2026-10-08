import { describe, it } from "node:test";
import assert from "node:assert";
import { expandWeeklyPlanSeries } from "./db/weekly-plans-series";

const baseSeries = {
  repeatType: "once" as const,
  repeatDays: null,
  repeatInterval: null,
  startDate: "2026-10-05", // Monday
  endType: "never" as const,
  endDate: null,
  endCount: null,
  timezone: "America/Sao_Paulo",
};

describe("expandWeeklyPlanSeries", () => {
  // Week of Oct 5-11, 2026 (Mon-Sun)
  const week1 = "2026-10-05";
  // Week of Oct 12-18, 2026
  const week2 = "2026-10-12";
  // Week of Oct 19-25, 2026
  const week3 = "2026-10-19";

  describe("once", () => {
    it("shows only on its start date", () => {
      const series = { ...baseSeries, repeatType: "once" as const };
      const dates = expandWeeklyPlanSeries(series, week1);
      assert.deepStrictEqual(dates, ["2026-10-05"]);
    });

    it("does not show on other weeks", () => {
      const series = { ...baseSeries, repeatType: "once" as const };
      const dates = expandWeeklyPlanSeries(series, week2);
      assert.deepStrictEqual(dates, []);
    });

    it("shows on the correct week when start date is mid-week", () => {
      const series = { ...baseSeries, repeatType: "once" as const, startDate: "2026-10-07" };
      const dates = expandWeeklyPlanSeries(series, week1);
      assert.deepStrictEqual(dates, ["2026-10-07"]);
    });
  });

  describe("weekly", () => {
    it("shows on the selected weekday every week", () => {
      // Sunday = 0
      const series = { ...baseSeries, repeatType: "weekly" as const, repeatDays: [0] };
      const dates1 = expandWeeklyPlanSeries(series, week1);
      const dates2 = expandWeeklyPlanSeries(series, week2);
      assert.deepStrictEqual(dates1, ["2026-10-11"]); // Sunday of week 1
      assert.deepStrictEqual(dates2, ["2026-10-18"]); // Sunday of week 2
    });

    it("shows on multiple weekdays", () => {
      // Mon=1, Wed=3, Fri=5
      const series = { ...baseSeries, repeatType: "weekly" as const, repeatDays: [1, 3, 5] };
      const dates = expandWeeklyPlanSeries(series, week1);
      assert.deepStrictEqual(dates, ["2026-10-05", "2026-10-07", "2026-10-09"]);
    });

    it("respects start date boundary", () => {
      // Start on Oct 7 (Wed), repeat Mon/Wed/Fri
      const series = { ...baseSeries, repeatType: "weekly" as const, repeatDays: [1, 3, 5], startDate: "2026-10-07" };
      const dates = expandWeeklyPlanSeries(series, week1);
      // Should only show Wed and Fri of week 1, not Mon (before start)
      assert.deepStrictEqual(dates, ["2026-10-07", "2026-10-09"]);
    });
  });

  describe("interval", () => {
    it("shows every 2 weeks on the selected weekday", () => {
      // Sunday every 2 weeks, starting Oct 5
      const series = {
        ...baseSeries,
        repeatType: "interval" as const,
        repeatDays: [0],
        repeatInterval: 2,
      };
      const dates1 = expandWeeklyPlanSeries(series, week1);
      const dates2 = expandWeeklyPlanSeries(series, week2);
      const dates3 = expandWeeklyPlanSeries(series, week3);
      assert.deepStrictEqual(dates1, ["2026-10-11"]); // Week 0 (start week)
      assert.deepStrictEqual(dates2, []); // Week 1 (skipped)
      assert.deepStrictEqual(dates3, ["2026-10-25"]); // Week 2 (shown)
    });

    it("shows every 2 weeks on multiple weekdays", () => {
      // Mon+Wed every 2 weeks
      const series = {
        ...baseSeries,
        repeatType: "interval" as const,
        repeatDays: [1, 3],
        repeatInterval: 2,
      };
      const dates1 = expandWeeklyPlanSeries(series, week1);
      const dates2 = expandWeeklyPlanSeries(series, week2);
      assert.deepStrictEqual(dates1, ["2026-10-05", "2026-10-07"]);
      assert.deepStrictEqual(dates2, []);
    });
  });

  describe("end date", () => {
    it("stops after end date", () => {
      const series = {
        ...baseSeries,
        repeatType: "weekly" as const,
        repeatDays: [0],
        endType: "date" as const,
        endDate: "2026-10-11",
      };
      const dates1 = expandWeeklyPlanSeries(series, week1);
      const dates2 = expandWeeklyPlanSeries(series, week2);
      assert.deepStrictEqual(dates1, ["2026-10-11"]);
      assert.deepStrictEqual(dates2, []);
    });
  });

  describe("end count", () => {
    it("stops after N occurrences", () => {
      const series = {
        ...baseSeries,
        repeatType: "weekly" as const,
        repeatDays: [0],
        endType: "count" as const,
        endCount: 2,
      };
      const dates1 = expandWeeklyPlanSeries(series, week1);
      const dates2 = expandWeeklyPlanSeries(series, week2);
      const dates3 = expandWeeklyPlanSeries(series, week3);
      assert.deepStrictEqual(dates1, ["2026-10-11"]);
      assert.deepStrictEqual(dates2, ["2026-10-18"]);
      assert.deepStrictEqual(dates3, []);
    });

    it("handles count with multiple weekdays", () => {
      // Mon+Wed, count=3
      const series = {
        ...baseSeries,
        repeatType: "weekly" as const,
        repeatDays: [1, 3],
        endType: "count" as const,
        endCount: 3,
      };
      const dates1 = expandWeeklyPlanSeries(series, week1);
      const dates2 = expandWeeklyPlanSeries(series, week2);
      // Week 1: Mon (1), Wed (2)
      // Week 2: Mon (3), Wed (4 - skipped)
      assert.strictEqual(dates1.length, 2);
      assert.strictEqual(dates2.length, 1);
    });
  });

  describe("week boundaries", () => {
    it("handles month boundary correctly", () => {
      // Sep 28 - Oct 4, 2026 (Mon-Sun)
      const weekSepOct = "2026-09-28";
      const series = {
        ...baseSeries,
        repeatType: "weekly" as const,
        repeatDays: [0], // Sunday
        startDate: "2026-09-28",
      };
      const dates = expandWeeklyPlanSeries(series, weekSepOct);
      assert.deepStrictEqual(dates, ["2026-10-04"]); // Sunday Oct 4
    });

    it("handles year boundary correctly", () => {
      // Dec 29, 2026 - Jan 4, 2027 (Mon-Sun)
      // Dec 29 2026 is a Monday, so Sunday of that week is Jan 3 2027
      const weekYearBoundary = "2026-12-29";
      const series = {
        ...baseSeries,
        repeatType: "weekly" as const,
        repeatDays: [0], // Sunday
        startDate: "2026-12-29",
      };
      const dates = expandWeeklyPlanSeries(series, weekYearBoundary);
      assert.deepStrictEqual(dates, ["2027-01-03"]); // Sunday Jan 3, 2027
    });
  });

  describe("edge cases", () => {
    it("returns empty for series starting after the week", () => {
      const series = { ...baseSeries, repeatType: "weekly" as const, repeatDays: [1], startDate: "2026-10-12" };
      const dates = expandWeeklyPlanSeries(series, week1);
      assert.deepStrictEqual(dates, []);
    });

    it("returns empty for archived series (handled by DB, not expansion)", () => {
      // The expansion function doesn't know about archived state; that's filtered at DB level
      const series = { ...baseSeries, repeatType: "once" as const, startDate: "2026-10-05" };
      const dates = expandWeeklyPlanSeries(series, week1);
      assert.deepStrictEqual(dates, ["2026-10-05"]);
    });

    it("handles empty repeatDays gracefully", () => {
      const series = { ...baseSeries, repeatType: "weekly" as const, repeatDays: [] };
      const dates = expandWeeklyPlanSeries(series, week1);
      assert.deepStrictEqual(dates, []);
    });
  });
});
