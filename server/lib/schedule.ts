import type { CourseInterval } from "../types/writing";

/** IANA zone for schedule anchor (doc 09). */
export const DEFAULT_TZ = "Asia/Tokyo";

/** Map DB enum → Postgres interval literal (allowlisted; never from raw client strings). */
export function courseIntervalToIntervalLiteral(interval: CourseInterval): string {
  switch (interval) {
    case "interval_1d":
      return "1 day";
    case "interval_2d":
      return "2 days";
    case "interval_3d":
      return "3 days";
    case "interval_1w":
      return "7 days";
    case "interval_10d":
      return "10 days";
    case "interval_2w":
      return "14 days";
    default: {
      const _never: never = interval;
      return _never;
    }
  }
}

export function assertIsoDateOnly(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    throw new Error("startDate must be YYYY-MM-DD");
  }
  return value.trim();
}

export function intervalToMs(interval: CourseInterval): number {
  const d = 24 * 60 * 60 * 1000;
  switch (interval) {
    case "interval_1d":
      return d;
    case "interval_2d":
      return 2 * d;
    case "interval_3d":
      return 3 * d;
    case "interval_1w":
      return 7 * d;
    case "interval_10d":
      return 10 * d;
    case "interval_2w":
      return 14 * d;
    default: {
      const _never: never = interval;
      return _never;
    }
  }
}

/**
 * JS preview of unlock times (tests / sanity checks). Production uses Postgres in bulkInsertWritingSessions.
 * Implemented for Asia/Tokyo only (no DST); matches the SQL path for that zone.
 */
export function computeSessionUnlockTimes(
  startDateIso: string,
  interval: CourseInterval,
  timeZone: string = DEFAULT_TZ
): Date[] {
  const stepMs = intervalToMs(interval);
  const anchor = startOfDayInTokyo(assertIsoDateOnly(startDateIso), timeZone);
  const out: Date[] = [];
  for (let i = 0; i < 10; i++) {
    out.push(new Date(anchor.getTime() + i * stepMs));
  }
  return out;
}

function startOfDayInTokyo(isoDate: string, timeZone: string): Date {
  if (timeZone !== DEFAULT_TZ) {
    throw new Error("computeSessionUnlockTimes: only Asia/Tokyo is implemented in JS");
  }
  const [y, m, d] = isoDate.split("-").map((s) => parseInt(s, 10));
  const utcMs = Date.UTC(y, m - 1, d, 0, 0, 0, 0) - 9 * 60 * 60 * 1000;
  return new Date(utcMs);
}
