"use client";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

const OPTIONS = [
  { value: "system", icon: Monitor, label: "System theme" },
  { value: "light", icon: Sun, label: "Light theme" },
  { value: "dark", icon: Moon, label: "Dark theme" },
] as const;

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return (
    <div role="radiogroup" aria-label="Theme" className={cn("inline-flex h-8 items-center gap-0.5 rounded-full border border-gray-alpha-400 bg-background-100 p-0.5", className)}>
      {OPTIONS.map(({ value, icon: Icon, label }) => {
        const active = mounted && theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => setTheme(value)}
            className={cn("flex size-6 items-center justify-center rounded-full transition-colors", active ? "bg-gray-alpha-200 text-gray-1000" : "text-gray-900 hover:text-gray-1000")}
          >
            <Icon className="size-3.5" />
          </button>
        );
      })}
    </div>
  );
}
