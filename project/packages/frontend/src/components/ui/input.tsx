import * as React from "react";
import { cn } from "../../lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, hasError, ...props }, ref) => {
  return (
    <input
      ref={ref}
      aria-invalid={hasError ? "true" : undefined}
      className={cn(
        "flex h-11 w-full rounded-xl border bg-input px-4 py-2",
        "text-sm text-foreground outline-none transition-all duration-150",
        "placeholder:text-muted-foreground/60",
        "hover:border-border/80",
        "focus:ring-2 focus:ring-offset-0",
        "disabled:pointer-events-none disabled:opacity-40",
        hasError
          ? "border-danger/70 focus:border-danger focus:ring-danger/20"
          : "border-border focus:border-primary/70 focus:ring-primary/20",
        className
      )}
      {...props}
    />
  );
});

Input.displayName = "Input";
