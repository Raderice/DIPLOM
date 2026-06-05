import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "../../lib/utils";

type Variant = "default" | "secondary" | "outline" | "ghost" | "danger";
type Size    = "sm" | "md" | "lg" | "icon";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?:  boolean;
  variant?:  Variant;
  size?:     Size;
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
  sm:   "h-8  min-h-[32px] px-3 text-xs",
  md:   "h-10 min-h-[40px] px-4 text-sm",
  lg:   "h-12 min-h-[48px] px-6 text-base",
  icon: "h-10 min-h-[40px] w-10 p-0"
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "md", asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-xl font-semibold tracking-wide",
          "transition-all duration-150 select-none",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
          "disabled:pointer-events-none disabled:opacity-40",
          "active:scale-[0.97]",
          variantClass[variant],
          sizeClass[size],
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";
