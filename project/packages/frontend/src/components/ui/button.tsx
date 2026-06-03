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
    "bg-primary text-primary-foreground shadow-glow hover:bg-[#e3b941]",
  secondary: "bg-secondary text-secondary-foreground hover:bg-[#336b4c]",
  outline: "border border-border bg-transparent text-foreground hover:border-[#f2c94c] hover:text-[#f2c94c]",
  danger: "bg-[#d35d5d] text-white hover:bg-[#c84d4d]"
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(
          "inline-flex min-h-[44px] items-center justify-center rounded-full px-4 py-2 text-sm font-semibold tracking-wide transition duration-200 hover:-translate-y-0.5 disabled:pointer-events-none disabled:opacity-50",
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





