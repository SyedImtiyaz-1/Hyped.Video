import { cn } from "@/lib/cn";

const field =
  "w-full rounded-md border border-gray-alpha-400 bg-background-100 text-sm text-gray-1000 placeholder:text-gray-700 transition-[border-color,box-shadow] hover:border-gray-alpha-500 focus:border-gray-alpha-600 focus:outline-none focus:ring-4 focus:ring-gray-alpha-200 focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-700";

export function Input({ className, prefix, suffix, ...props }: Omit<React.ComponentProps<"input">, "prefix"> & { prefix?: React.ReactNode; suffix?: React.ReactNode }) {
  if (!prefix && !suffix) return <input className={cn(field, "h-10 px-3", className)} {...props} />;
  return (
    <div className="relative flex items-center">
      {prefix && <span className="pointer-events-none absolute left-3 flex text-gray-900 [&_svg]:size-4">{prefix}</span>}
      <input className={cn(field, "h-10", prefix ? "pl-9" : "pl-3", suffix ? "pr-12" : "pr-3", className)} {...props} />
      {suffix && <span className="absolute right-2 flex">{suffix}</span>}
    </div>
  );
}

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea className={cn(field, "min-h-20 px-3 py-2.5 leading-relaxed", className)} {...props} />;
}

export function Label({ className, ...props }: React.ComponentProps<"label">) {
  return <label className={cn("mb-1.5 block text-[13px] font-medium text-gray-900", className)} {...props} />;
}
