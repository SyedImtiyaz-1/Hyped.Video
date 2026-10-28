import { UserButton } from "@clerk/nextjs";
import { RecipeModalProvider } from "@/components/recipes/recipe-modal";
import { AppShell } from "@/components/shell/app-shell";
import { Avatar } from "@/components/ui/avatar";
import { isDemo } from "@/lib/demo";
import { studioAvailable } from "@/lib/studio";
import { isAdmin, requireUser } from "@/lib/user";

// Every dashboard page can open a recipe in a modal over itself.
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [user, studio] = await Promise.all([requireUser(), studioAvailable()]);
  return (
    <AppShell
      credits={user.credits}
      reelCredits={user.reelCredits}
      email={user.email ?? ""}
      isAdmin={isAdmin(user.id)}
      demo={isDemo}
      userSlot={isDemo ? <Avatar seed={user.email ?? user.id} size={28} /> : <UserButton />}
    >
      <RecipeModalProvider credits={user.credits} studioAvailable={studio}>
        {children}
      </RecipeModalProvider>
    </AppShell>
  );
}
