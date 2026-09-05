import type * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-4",
  {
    variants: {
      variant: {
        default: "border-primary/25 bg-primary/10 text-primary",
        neutral: "border-border bg-muted text-muted-foreground",
        purple:
          "border-violet-400/25 bg-violet-400/10 text-violet-700 dark:text-violet-300",
        green:
          "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
        berry:
          "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300",
        danger:
          "border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
