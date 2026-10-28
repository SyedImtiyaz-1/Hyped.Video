import { getDb } from "./db";

/** One week of sign-ups and how far they got: a first video (any, and within a day of signing up) and a purchase. */
export type FunnelWeek = { week: Date; signups: number; madeVideo: number; within24h: number; bought: number };

const DAY = 86_400_000;

/** Monday 00:00 UTC of the week `t` is in. */
const weekOf = (t: Date) => {
  const d = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d;
};

/**
 * The launch funnel by week of sign-up, newest first, from our own records (no tracking): who signed up, who made a
 * first video (and within 24 hours), who bought a pack. Admins (the owner's tests) are left out. Visits come from
 * Cloudflare Web Analytics, which counts them without cookies.
 */
export async function funnelByWeek(weeks: number, admins: string[]): Promise<FunnelWeek[]> {
  const db = await getDb();
  const since = weekOf(new Date(Date.now() - (weeks - 1) * 7 * DAY));
  const users = await db.user.findMany({
    where: { createdAt: { gte: since }, id: { notIn: admins } },
    select: {
      createdAt: true,
      jobs: { select: { createdAt: true }, orderBy: { createdAt: "asc" }, take: 1 },
      ledger: { where: { reason: { startsWith: "purchase:" } }, select: { id: true }, take: 1 },
    },
  });
  const rows = new Map<number, FunnelWeek>();
  for (let k = 0; k < weeks; k++) {
    const week = new Date(since.getTime() + k * 7 * DAY);
    rows.set(week.getTime(), { week, signups: 0, madeVideo: 0, within24h: 0, bought: 0 });
  }
  for (const u of users) {
    const row = rows.get(weekOf(u.createdAt).getTime());
    if (!row) continue;
    row.signups++;
    const first = u.jobs[0]?.createdAt;
    if (first) row.madeVideo++;
    if (first && first.getTime() - u.createdAt.getTime() <= DAY) row.within24h++;
    if (u.ledger.length) row.bought++;
  }
  return [...rows.values()].reverse();
}
