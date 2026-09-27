import Link from "next/link";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "tertiary" | "error";
type Size = "sm" | "md" | "lg";
type Style = { variant?: Variant; size?: Size; className?: string };

export function buttonClasses({ variant = "secondary", size = "md", className }: Style = {}) {
  return cn(
    "inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-colors",
    "disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
    size === "sm" && "h-8 px-3 text-sm",
    size === "md" && "h-10 px-4 text-sm",
    size === "lg" && "h-12 px-6 text-base",
    variant === "primary" && "bg-gray-1000 text-background-100 hover:bg-gray-1000/85",
    variant === "secondary" && "border border-gray-alpha-400 bg-background-100 text-gray-1000 hover:bg-gray-alpha-100",
    variant === "tertiary" && "text-gray-1000 hover:bg-gray-alpha-200",
    variant === "error" && "bg-red-800 text-white hover:bg-red-900",
    className,
  );
}

export function Button({ variant, size, className, ...props }: React.ComponentProps<"button"> & Style) {
  return <button className={buttonClasses({ variant, size, className })} {...props} />;
}

export function ButtonLink({ variant, size, className, ...props }: React.ComponentProps<typeof Link> & Style) {
  return <Link className={buttonClasses({ variant, size, className })} {...props} />;
}
