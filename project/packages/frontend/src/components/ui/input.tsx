import * as React from "react";
import { cn } from "../../lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => {
  return (
    <input
      ref={ref}
      className={cn(
        "flex h-11 w-full rounded-xl border border-border bg-input px-4 py-2",
        "text-sm text-foreground outline-none transition-all duration-150",
        "placeholder:text-muted-foreground/60",
        "hover:border-border/80",
        "focus:border-primary/70 focus:ring-2 focus:ring-primary/20",
        "disabled:pointer-events-none disabled:opacity-40",
        className
      )}
      {...props}
    />
  );
});

Input.displayName = "Input";
