import { UserButton } from "@clerk/nextjs";
import { PLANS } from "@launchreel/core";
import { AppShell } from "@/components/shell/app-shell";
import { Avatar } from "@/components/ui/avatar";
import { isDemo } from "@/lib/demo";
import { isAdmin, requireUser } from "@/lib/user";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const plan = PLANS[user.plan];
  return (
    <AppShell
      plan={user.plan}
      planName={plan.name}
      credits={user.credits}
      monthlyCredits={plan.creditsPerMonth || 2}
      email={user.email ?? ""}
      isAdmin={isAdmin(user.id)}
      demo={isDemo}
      userSlot={isDemo ? <Avatar seed={user.email ?? user.id} size={28} /> : <UserButton />}
    >
      {children}
    </AppShell>
  );
}
