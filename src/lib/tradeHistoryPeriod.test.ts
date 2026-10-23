import { describe, expect, it } from "vitest";
import {
  getPeriodStart,
  getTradeHistoryTime,
  tradeMatchesHistoryPeriod,
  type HistoryPeriod,
} from "@/lib/tradeHistoryPeriod";

const now = new Date(2026, 9, 23, 14, 8, 0); // Friday Oct 23, 2026 2:08 PM local

function trade(partial: { closeTime?: string; openTime?: string; date?: string }) {
  return { date: "2026-10-01", ...partial };
}

describe("getPeriodStart", () => {
  it("returns null for all", () => {
    expect(getPeriodStart("all", now)).toBeNull();
  });

  it("starts today at local midnight", () => {
    expect(getPeriodStart("today", now)).toEqual(new Date(2026, 9, 23));
  });

  it("starts this week on Monday", () => {
    expect(getPeriodStart("thisWeek", now)).toEqual(new Date(2026, 9, 19));
  });

  it("starts this month on the 1st", () => {
    expect(getPeriodStart("thisMonth", now)).toEqual(new Date(2026, 9, 1));
  });

  it("starts this year on Jan 1", () => {
    expect(getPeriodStart("thisYear", now)).toEqual(new Date(2026, 0, 1));
  });

  it("uses rolling windows for last 24h / 7d / 30d", () => {
    expect(getPeriodStart("last24h", now)).toEqual(new Date(2026, 9, 22, 14, 8, 0));
    expect(getPeriodStart("last7d", now)).toEqual(new Date(2026, 9, 16, 14, 8, 0));
    expect(getPeriodStart("last30d", now)).toEqual(new Date(2026, 8, 23, 14, 8, 0));
  });
});

describe("getTradeHistoryTime", () => {
  it("prefers close time, then open time, then the date key", () => {
    expect(getTradeHistoryTime(trade({
      closeTime: "2026-10-23T18:00:00.000Z",
      openTime: "2026-10-22T18:00:00.000Z",
      date: "2026-10-01",
    }))).toBe(new Date("2026-10-23T18:00:00.000Z").getTime());

    expect(getTradeHistoryTime(trade({
      openTime: "2026-10-22T18:00:00.000Z",
      date: "2026-10-01",
    }))).toBe(new Date("2026-10-22T18:00:00.000Z").getTime());

    expect(getTradeHistoryTime(trade({ date: "2026-10-20" }))).toBe(new Date(2026, 9, 20).getTime());
  });
});

describe("tradeMatchesHistoryPeriod", () => {
  const cases: { period: HistoryPeriod; included: string; excluded: string }[] = [
    { period: "today", included: "2026-10-23T12:00:00", excluded: "2026-10-22T23:00:00" },
    { period: "thisWeek", included: "2026-10-19T00:30:00", excluded: "2026-10-18T23:00:00" },
    { period: "thisMonth", included: "2026-10-01T00:30:00", excluded: "2026-09-30T23:00:00" },
    { period: "thisYear", included: "2026-01-01T00:30:00", excluded: "2025-12-31T23:00:00" },
    { period: "last24h", included: "2026-10-22T14:08:00", excluded: "2026-10-22T14:07:00" },
    { period: "last7d", included: "2026-10-16T14:08:00", excluded: "2026-10-16T14:07:00" },
    { period: "last30d", included: "2026-09-23T14:08:00", excluded: "2026-09-23T14:07:00" },
  ];

  it.each(cases)("$period includes the start and excludes just before it", ({ period, included, excluded }) => {
    expect(tradeMatchesHistoryPeriod(trade({ closeTime: included }), period, now)).toBe(true);
    expect(tradeMatchesHistoryPeriod(trade({ closeTime: excluded }), period, now)).toBe(false);
  });

  it("includes every dated trade when period is all", () => {
    expect(tradeMatchesHistoryPeriod(trade({ date: "2019-01-01" }), "all", now)).toBe(true);
  });
});
