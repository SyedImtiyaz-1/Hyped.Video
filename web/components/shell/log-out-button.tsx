"use client";
import { SignOutButton } from "@clerk/nextjs";
import { LogOut } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/** Logs out and returns to the homepage: an icon for the sidebar, a labelled button elsewhere. Needs Clerk (not in demo mode). */
export function LogOutButton({ variant = "button", className }: { variant?: "icon" | "button"; className?: string }) {
  return (
    <SignOutButton redirectUrl="/">
      {variant === "icon" ? (
        <button type="button" aria-label="Log out" title="Log out" className={cn("flex size-8 shrink-0 items-center justify-center rounded-md text-gray-900 transition-colors hover:bg-gray-alpha-200 hover:text-gray-1000", className)}>
          <LogOut className="size-4" />
        </button>
      ) : (
        <button type="button" className={cn(buttonClasses({ size: "sm" }), className)}>
          <LogOut />
          Log out
        </button>
      )}
    </SignOutButton>
  );
}
