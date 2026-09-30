import { NextResponse } from "next/server";
import { listVideos } from "@/lib/data";
import { hostOf } from "@/lib/format";
import { requireUser } from "@/lib/user";

// Live results for the sidebar search: the signed-in user's matching videos, newest first.
export async function GET(req: Request) {
  const user = await requireUser();
  const q = new URL(req.url).searchParams.get("q")?.trim().slice(0, 100) ?? "";
  if (!q) return NextResponse.json({ videos: [] });
  const jobs = await listVideos(user.id, { q, take: 6 });
  return NextResponse.json({
    videos: jobs.map((j) => ({ id: j.id, title: hostOf(j.sourceUrl), status: j.status, posterUrl: j.posterUrl, createdAt: j.createdAt, revision: Boolean(j.parentJobId) })),
  });
}
