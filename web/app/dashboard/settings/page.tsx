import { Bell, KeyRound, Palette } from "lucide-react";
import { LogOutButton } from "@/components/shell/log-out-button";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { PageBody, PageHeader } from "@/components/ui/page";
import { BRAND } from "@/lib/brand";
import { isDemo } from "@/lib/demo";
import { formatDateTime } from "@/lib/format";
import { requireUser } from "@/lib/user";

export const metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireUser();
  return (
    <>
      <PageHeader narrow title="Settings" description="Your account, notifications and integrations." />
      <PageBody className="max-w-[880px] space-y-6">
        <Card>
          <CardHeader title="Account" description="Manage sign-in methods and your profile from the account menu: your picture, at the top on phones and at the bottom of the sidebar on larger screens." />
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
          {!isDemo && (
            <CardFooter>
              <span>Log out of {BRAND.name} on this device.</span>
              <LogOutButton />
            </CardFooter>
          )}
        </Card>

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
