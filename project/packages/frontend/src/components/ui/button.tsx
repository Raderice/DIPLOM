import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "../../lib/utils";

type Variant = "default" | "secondary" | "outline" | "danger";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  variant?: Variant;
}

const variantClass: Record<Variant, string> = {
  default:
    "bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-primary-foreground shadow-glow hover:brightness-105",
  secondary: "bg-gradient-to-r from-sky-500 to-blue-600 text-secondary-foreground hover:brightness-105",
  outline: "border border-border bg-white/90 text-slate-700 hover:bg-white",
  danger: "bg-gradient-to-r from-rose-600 to-red-600 text-white hover:brightness-105"
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(
          "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold tracking-wide transition duration-200 hover:-translate-y-0.5 disabled:pointer-events-none disabled:opacity-50",
          variantClass[variant],
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";
