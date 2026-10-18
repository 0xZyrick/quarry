/**
 * Last 12 weeks activity — GitHub-style grid from SessionShip dayKeys.
 */

export function dayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export function lastNWeekBuckets(weeks = 12, now = new Date()): string[] {
  const keys: string[] = [];
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = d.getUTCDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setUTCDate(d.getUTCDate() - diff);
  for (let i = weeks - 1; i >= 0; i--) {
    const w = new Date(d);
    w.setUTCDate(d.getUTCDate() - i * 7);
    keys.push(w.toISOString().slice(0, 10));
  }
  return keys;
}

export function weeksShipped(shipDayKeys: string[], weeks = 12, now = new Date()): boolean[] {
  const buckets = lastNWeekBuckets(weeks, now);
  const set = new Set(shipDayKeys);
  return buckets.map((monday) => {
    const start = new Date(monday + "T00:00:00.000Z");
    for (let i = 0; i < 7; i++) {
      const day = new Date(start);
      day.setUTCDate(start.getUTCDate() + i);
      if (set.has(day.toISOString().slice(0, 10))) return true;
    }
    return false;
  });
}

export function countShippedWeeks(flags: boolean[]): number {
  return flags.filter(Boolean).length;
}
