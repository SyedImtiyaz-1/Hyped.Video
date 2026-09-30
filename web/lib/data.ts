import type { CreditEntry, Job, JobStatus } from "@launchreel/core";
import { getDb } from "./db";
import { demoJobs, demoLedger, isDemo } from "./demo";

export type StatusFilter = "all" | "ready" | "rendering" | "queued" | "failed";

const FILTER_STATUSES: Record<Exclude<StatusFilter, "all">, JobStatus[]> = {
  ready: ["SUCCEEDED"],
  rendering: ["RUNNING"],
  queued: ["QUEUED"],
  failed: ["FAILED"],
};

export function parseStatus(value: string | undefined): StatusFilter {
  return value && value in FILTER_STATUSES ? (value as StatusFilter) : "all";
}

export async function listVideos(userId: string, opts: { status?: StatusFilter; q?: string; take?: number } = {}): Promise<Job[]> {
  const statuses = opts.status && opts.status !== "all" ? FILTER_STATUSES[opts.status] : undefined;
  const q = opts.q?.trim().toLowerCase() || undefined;
  const take = opts.take ?? 50;
  if (isDemo) {
    return demoJobs().filter((j) => (!statuses || statuses.includes(j.status)) && (!q || [j.sourceUrl, j.notes, j.shareCopy].some((v) => v?.toLowerCase().includes(q)))).slice(0, take);
  }
  const db = await getDb();
  return db.job.findMany({
    where: {
      userId,
      ...(statuses && { status: { in: statuses } }),
      // Search matches the site or repo, the customer's notes and the share copy.
      ...(q && { OR: [{ sourceUrl: { contains: q, mode: "insensitive" as const } }, { notes: { contains: q, mode: "insensitive" as const } }, { shareCopy: { contains: q, mode: "insensitive" as const } }] }),
    },
    orderBy: { createdAt: "desc" },
    take,
  });
}

export async function getVideo(userId: string, id: string): Promise<{ job: Job; parent: Job | null; revisions: Job[] } | null> {
  if (isDemo) {
    const jobs = demoJobs();
    const job = jobs.find((j) => j.id === id);
    if (!job) return null;
    return { job, parent: jobs.find((j) => j.id === job.parentJobId) ?? null, revisions: jobs.filter((j) => j.parentJobId === id) };
  }
  const db = await getDb();
  const job = await db.job.findFirst({ where: { id, userId } });
  if (!job) return null;
  const [parent, revisions] = await Promise.all([
    job.parentJobId ? db.job.findFirst({ where: { id: job.parentJobId, userId } }) : Promise.resolve(null),
    db.job.findMany({ where: { parentJobId: id, userId }, orderBy: { createdAt: "desc" } }),
  ]);
  return { job, parent, revisions };
}

const DAY_MS = 86_400_000;

async function recentJobs(userId: string, days: number): Promise<Job[]> {
  const since = new Date(Date.now() - days * DAY_MS);
  if (isDemo) return demoJobs().filter((j) => j.createdAt >= since);
  return (await getDb()).job.findMany({ where: { userId, createdAt: { gte: since } }, orderBy: { createdAt: "desc" } });
}

export async function getStats(userId: string) {
  const jobs = await recentJobs(userId, 31);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const done = jobs.filter((j) => j.status === "SUCCEEDED");
  const failed = jobs.filter((j) => j.status === "FAILED");
  const renderTimes = done.map((j) => j.computeSeconds).filter((s): s is number => s != null);
  return {
    videosThisMonth: jobs.filter((j) => j.createdAt >= monthStart && !j.parentJobId).length,
    revisionsThisMonth: jobs.filter((j) => j.createdAt >= monthStart && j.parentJobId).length,
    successRate: done.length + failed.length ? done.length / (done.length + failed.length) : null,
    avgRenderSeconds: renderTimes.length ? renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length : null,
    inProgress: jobs.filter((j) => j.status === "QUEUED" || j.status === "RUNNING").length,
  };
}

export async function getUsage(userId: string) {
  const [jobs, ledger] = await Promise.all([
    recentJobs(userId, 30),
    isDemo ? Promise.resolve(demoLedger()) : getDb().then((db) => db.creditEntry.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 100 })),
  ]);
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(Date.now() - (29 - i) * DAY_MS);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const daily = days.map((day) => {
    const next = day.getTime() + DAY_MS;
    const onDay = jobs.filter((j) => j.createdAt.getTime() >= day.getTime() && j.createdAt.getTime() < next);
    return { day, videos: onDay.filter((j) => !j.parentJobId).length, revisions: onDay.filter((j) => j.parentJobId).length };
  });
  const since30 = Date.now() - 30 * DAY_MS;
  const spent30 = ledger.filter((e) => e.delta < 0 && e.createdAt.getTime() >= since30 && e.reason.startsWith("job:")).reduce((a, e) => a - e.delta, 0);
  return { daily, ledger: ledger as CreditEntry[], spent30 };
}
