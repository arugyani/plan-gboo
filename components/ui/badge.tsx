import type * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-4",
  {
    variants: {
      variant: {
        default: "border-primary/20 bg-primary/12 text-primary",
        neutral: "border-border bg-muted text-muted-foreground",
        purple: "border-purple-400/20 bg-purple-400/12 text-purple-200",
        green: "border-emerald-400/20 bg-emerald-400/12 text-emerald-200",
        berry: "border-rose-400/20 bg-rose-400/12 text-rose-200",
        danger: "border-red-400/20 bg-red-400/12 text-red-200",
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
