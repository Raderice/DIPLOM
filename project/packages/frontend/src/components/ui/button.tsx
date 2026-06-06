import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "../../lib/utils";

type Variant = "default" | "secondary" | "outline" | "ghost" | "danger";
type Size    = "sm" | "md" | "lg" | "icon";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?:   boolean;
  variant?:   Variant;
  size?:      Size;
  isLoading?: boolean;
}

const variantClass: Record<Variant, string> = {
  default:
    "bg-primary text-primary-foreground shadow-glow hover:bg-[#e3b941] active:bg-[#d4a820]",
  secondary:
    "bg-secondary text-secondary-foreground hover:bg-[#27915a] active:bg-[#237d4f]",
  outline:
    "border border-border bg-transparent text-foreground hover:border-primary/60 hover:text-primary active:bg-primary/5",
  ghost:
    "bg-transparent text-muted-foreground hover:bg-white/5 hover:text-foreground",
  danger:
    "bg-danger text-white hover:bg-[#c84444] active:bg-[#b83d3d]"
};

const sizeClass: Record<Size, string> = {
  sm:   "h-9  min-h-[36px] min-w-[44px] px-3 text-xs",
  md:   "h-11 min-h-[44px] min-w-[44px] px-4 text-sm",
  lg:   "h-12 min-h-[48px] px-6 text-base",
  icon: "h-11 min-h-[44px] w-11 min-w-[44px] p-0"
};

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
    </svg>
  );
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "md", asChild = false, isLoading, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        disabled={disabled ?? isLoading}
        aria-busy={isLoading ? "true" : undefined}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-xl font-semibold tracking-wide",
          "transition-all duration-150 select-none",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "disabled:pointer-events-none disabled:opacity-40",
          "active:scale-[0.97]",
          variantClass[variant],
          sizeClass[size],
          className
        )}
        {...props}
      >
        {isLoading ? <><Spinner />{children}</> : children}
      </Comp>
    );
  }
);

Button.displayName = "Button";
