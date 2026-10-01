// Emails a customer when their video or reel is done: ready, with the watch and share links, or failed, with the
// credits back. Sent through Cloudflare Email Sending from notify.hyped.video, a subdomain with its own SPF, DKIM and
// DMARC records, so the root domain's mail (Hostinger) is untouched. Replies go to the support inbox.
import type { createDb } from "@launchreel/core";
import { customerError } from "@launchreel/core/engines";
import { reelError } from "@launchreel/core/reel";
import { templateById } from "@launchreel/core/templates";

type Db = ReturnType<typeof createDb>;

const RATIO: Record<string, string> = { landscape: "16:9", vertical: "9:16", square: "1:1" };
const LIME = "#C8F135";
const INK = "#0A0A0A";

const hostOf = (url: string) => {
  try {
    const u = new URL(url);
    return u.hostname === "github.com" ? u.pathname.replace(/^\/|\/$/g, "") : u.hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
// A line of copy as HTML: escaped, with its links clickable and allowed to wrap (a long URL would widen the card).
const paragraph = (line: string) =>
  `<p style="margin:0 0 12px;font-size:15px;line-height:1.55;color:#3f3f46;overflow-wrap:anywhere">${esc(line).replace(/https:\/\/[^\s<]+/g, (u) => `<a href="${u}" style="color:${INK};word-break:break-all">${u}</a>`)}</p>`;

/**
 * Sends the one email a finished job gets. Does nothing for a job that isn't finished or a customer with no email.
 * Returns the job's status, so the caller knows whether to alert the owner too.
 */
export async function sendJobEmail(env: Env, db: Db, jobId: string): Promise<string | null> {
  const job = await db.job.findUnique({ where: { id: jobId }, include: { user: { select: { email: true } } } });
  const to = job?.user?.email;
  if (!job || (job.status !== "SUCCEEDED" && job.status !== "FAILED")) return job?.status ?? null;
  if (!to) return job.status;

  const app = env.APP_URL;
  const reel = job.kind === "reel";
  const what = reel ? "reel" : job.parentJobId ? "revised video" : "video";
  const product = reel ? null : hostOf(job.sourceUrl);
  const page = `${app}/dashboard/videos/${job.id}`;
  let subject: string;
  let lines: string[];
  let button: { href: string; label: string };
  let poster: string | null = null;

  if (job.status === "SUCCEEDED") {
    const template = templateById(job.template);
    const detail = [template?.name, RATIO[job.format] ?? job.format, `${job.durationSec}s`].filter(Boolean).join(" · ");
    subject = product ? `Your ${what} for ${product} is ready` : `Your ${what} is ready`;
    lines = [`${detail}.`, `Share it with this link, which previews well on X, LinkedIn and WhatsApp: ${app}/v/${job.id}`];
    button = { href: page, label: "Watch and download" };
    poster = job.posterUrl;
  } else {
    const reason = reel ? reelError(job.error) : customerError(job.error);
    const credits = `${job.creditsCost} credit${job.creditsCost === 1 ? "" : "s"}`;
    subject = `Your ${what} didn't finish, and your credits are back`;
    lines = [product ? `We couldn't finish your ${what} for ${product}. ${reason}` : `We couldn't finish your ${what}. ${reason}`, `Your ${credits} went straight back to your account.`];
    button = { href: reel ? `${app}/dashboard/reels` : `${app}/dashboard/new`, label: "Try again" };
  }

  const footer = `You're getting this because you made a ${reel ? "reel" : "video"} on ${env.BRAND_NAME}. Questions? Just reply.`;
  const text = [subject, "", ...lines, "", `${button.label}: ${button.href}`, "", "—", footer, `${env.BRAND_NAME} · Nagpur, India`].join("\n");
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(subject)}</title></head><body style="margin:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${INK}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;table-layout:fixed;background:#ffffff;border-radius:12px;overflow:hidden">
<tr><td style="background:${INK};padding:18px 28px;color:${LIME};font-weight:700;font-size:16px;letter-spacing:0.02em">${esc(env.BRAND_NAME)}</td></tr>
${poster ? `<tr><td style="padding:0"><a href="${esc(page)}"><img src="${esc(poster)}" alt="Your ${esc(what)}" width="520" style="display:block;width:100%;height:auto;border:0"></a></td></tr>` : ""}
<tr><td style="padding:28px">
<h1 style="margin:0 0 12px;font-size:22px;line-height:1.3">${esc(subject)}</h1>
${lines.map(paragraph).join("\n")}
<p style="margin:24px 0 4px"><a href="${esc(button.href)}" style="display:inline-block;background:${LIME};color:${INK};font-weight:600;font-size:15px;text-decoration:none;padding:12px 20px;border-radius:8px">${esc(button.label)}</a></p>
</td></tr>
<tr><td style="padding:18px 28px;border-top:1px solid #e4e4e7;font-size:12px;line-height:1.5;color:#71717a">${esc(footer)}<br>${esc(env.BRAND_NAME)} · Nagpur, India</td></tr>
</table></td></tr></table></body></html>`;

  await env.EMAIL.send({ to, from: { email: env.EMAIL_FROM, name: env.BRAND_NAME }, replyTo: env.SUPPORT_EMAIL, subject, html, text });
  return job.status;
}

/**
 * Tells the owner a render failed or stalled (the customer already got their credits back): enough to find it in the
 * admin page, and no customer details beyond the account id.
 */
export async function sendFailureAlert(env: Env, db: Db, jobId: string): Promise<void> {
  const job = await db.job.findUnique({ where: { id: jobId } });
  if (!job || job.status !== "FAILED") return;
  const what = job.kind === "reel" ? "Reel" : job.parentJobId ? "Revision" : "Video";
  const source = job.kind === "reel" ? "an upload" : hostOf(job.sourceUrl);
  const text = [
    `${what} ${job.id} failed: ${source}, ${job.quality}, ${job.format} ${job.durationSec}s, ${job.creditsCost} credit(s) refunded.`,
    `Error: ${(job.error ?? "none recorded").slice(0, 600)}`,
    `Account: ${job.userId}`,
    `Started ${job.startedAt?.toISOString() ?? "never"}, finished ${job.finishedAt?.toISOString() ?? "never"}, attempts ${job.attempts}.`,
    "",
    `Admin: ${env.APP_URL}/dashboard/admin`,
  ].join("\n");
  const subject = `${env.BRAND_NAME}: ${what.toLowerCase()} failed (${source})`;
  await env.EMAIL.send({ to: env.ALERT_EMAIL, from: { email: env.EMAIL_FROM, name: `${env.BRAND_NAME} alerts` }, subject, text, html: `<pre style="font:13px/1.5 ui-monospace,Menlo,monospace;white-space:pre-wrap">${esc(text)}</pre>` });
}
