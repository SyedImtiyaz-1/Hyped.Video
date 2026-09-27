import { cn } from "@/lib/cn";

export function EmptyState({ icon, title, description, action, className }: { icon: React.ReactNode; title: string; description: string; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-16 text-center", className)}>
      <div className="mb-4 flex size-12 items-center justify-center rounded-full border border-gray-alpha-400 bg-background-100 text-gray-900 [&_svg]:size-5">{icon}</div>
      <h3 className="text-base font-semibold text-gray-1000">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-gray-900">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
