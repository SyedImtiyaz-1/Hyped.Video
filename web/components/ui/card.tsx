import { cn } from "@/lib/cn";

export function Card({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("rounded-xl border border-gray-alpha-400 bg-background-100", className)} {...props} />;
}

export function CardHeader({ title, description, actions, className }: { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start justify-between gap-4 border-b border-gray-alpha-400 px-5 py-4", className)}>
      <div className="min-w-0">
        <h3 className="text-base font-semibold tracking-tight text-gray-1000">{title}</h3>
        {description && <p className="mt-0.5 text-sm text-gray-900">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("p-5", className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-wrap items-center justify-between gap-3 rounded-b-xl border-t border-gray-alpha-400 bg-background-200 px-5 py-3 text-sm text-gray-900", className)}
      {...props}
    />
  );
}
