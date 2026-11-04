import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "outline" | "success" | "warning" | "destructive";
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        {
          "border-transparent bg-primary text-primary-foreground":
            variant === "default",
          "border-transparent bg-secondary text-secondary-foreground border border-border":
            variant === "secondary",
          "text-foreground border border-border": variant === "outline",
          "border-transparent bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20":
            variant === "success",
          "border-transparent bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20":
            variant === "warning",
          "border-transparent bg-destructive/15 text-destructive border border-destructive/20":
            variant === "destructive",
        },
        className
      )}
      {...props}
    />
  );
}

export { Badge };

