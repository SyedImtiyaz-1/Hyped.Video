import { Bell, KeyRound, Palette } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { PageBody, PageHeader } from "@/components/ui/page";
import { BRAND } from "@/lib/brand";
import { getDb } from "@/lib/db";
import { isDemo } from "@/lib/demo";
import { formatDateTime } from "@/lib/format";
import { getRepoTokenPublicKey } from "@/lib/repo-token-key";
import { requireUser } from "@/lib/user";
import { PrivateRepos } from "./private-repos";

export const metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireUser();
  const [publicKey, saved] = await Promise.all([
    getRepoTokenPublicKey(),
    isDemo ? null : getDb().then((db) => db.repoToken.findUnique({ where: { userId: user.id }, select: { hint: true, createdAt: true, lastUsedAt: true } })),
  ]);
  return (
    <>
      <PageHeader narrow title="Settings" description="Your account, notifications and integrations." />
      <PageBody className="max-w-[880px] space-y-6">
        <Card>
          <CardHeader title="Account" description="Sign-in methods and profile are managed from the account menu in the sidebar." />
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={user.email ?? ""} readOnly disabled />
            </div>
            <div>
              <Label htmlFor="since">Member since</Label>
              <Input id="since" value={formatDateTime(user.createdAt)} readOnly disabled />
            </div>
          </CardContent>
        </Card>

        <PrivateRepos
          userId={user.id}
          publicKey={publicKey}
          saved={saved && { hint: saved.hint, createdAt: saved.createdAt.toISOString(), lastUsedAt: saved.lastUsedAt?.toISOString() ?? null }}
          demo={isDemo}
        />

        <SoonCard icon={<Bell />} title="Notifications" description="Email me when a video is ready or a render fails." />
        <SoonCard icon={<Palette />} title="Brand kit" description="Upload your logo, colors, fonts and voice once. Every video uses them." />
        <SoonCard icon={<KeyRound />} title="API keys" description="Create videos from your own code, CI or a GitHub Action." />

        <Card className="border-red-400">
          <CardHeader title="Delete account" description="Permanently remove your account, videos and credit history." />
          <CardFooter className="border-red-400 bg-red-100 text-red-900">
            <span>This can&apos;t be undone. We&apos;ll confirm by email.</span>
            <a href={`mailto:${BRAND.supportEmail}?subject=Delete%20my%20account`} className={buttonClasses({ variant: "error", size: "sm" })}>
              Request deletion
            </a>
          </CardFooter>
        </Card>
      </PageBody>
    </>
  );
}

function SoonCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <Card>
      <CardContent className="flex items-start gap-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-gray-alpha-400 text-gray-900 [&_svg]:size-4">{icon}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold">{title}</h3>
            <Badge>Coming soon</Badge>
          </div>
          <p className="mt-1 text-sm text-gray-900">{description}</p>
        </div>
        <Button size="sm" disabled>
          Configure
        </Button>
      </CardContent>
    </Card>
  );
}
