import { cn } from "@/lib/cn";

/** Full-width header band with the page title, like Vercel's dashboard pages. */
export function PageHeader({ title, description, actions, children, narrow }: { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; children?: React.ReactNode; narrow?: boolean }) {
  return (
    <div className="border-b border-gray-alpha-400 bg-background-100">
      <div className={cn("mx-auto flex flex-col", narrow ? "max-w-[880px]" : "max-w-[1200px]", " gap-4 px-4 py-8 md:flex-row md:items-end md:justify-between md:px-8 md:py-10")}>
        <div className="min-w-0">
          <h1 className="text-[28px] font-semibold leading-9 tracking-[-0.04em] text-gray-1000 md:text-[32px] md:leading-10">{title}</h1>
          {description && <p className="mt-1.5 text-sm text-gray-900 md:text-base">{description}</p>}
          {children}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function PageBody({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("mx-auto w-full max-w-[1200px] px-4 py-8 md:px-8", className)} {...props} />;
}

export function SectionTitle({ children, actions }: { children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-4">
      <h2 className="text-base font-semibold tracking-tight text-gray-1000">{children}</h2>
      {actions}
    </div>
  );
}
