import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4 [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "border-border bg-surface-2 text-muted-foreground",
        accent: "border-transparent bg-accent-soft text-accent",
        success: "border-transparent bg-success/12 text-success",
        warning: "border-transparent bg-warning/14 text-warning",
        destructive: "border-transparent bg-destructive/12 text-destructive",
        outline: "border-border text-muted-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function Badge({ className, variant, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
