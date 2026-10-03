import { UserButton } from "@clerk/nextjs";
import { AppShell } from "@/components/shell/app-shell";
import { Avatar } from "@/components/ui/avatar";
import { isDemo } from "@/lib/demo";
import { isAdmin, requireUser } from "@/lib/user";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <AppShell
      credits={user.credits}
      reelCredits={user.reelCredits}
      email={user.email ?? ""}
      isAdmin={isAdmin(user.id)}
      demo={isDemo}
      userSlot={isDemo ? <Avatar seed={user.email ?? user.id} size={28} /> : <UserButton />}
    >
      {children}
    </AppShell>
  );
}
