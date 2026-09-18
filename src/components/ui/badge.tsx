import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
   "inline-flex items-center justify-center rounded-full border px-2.5 py-1 text-xs font-semibold outline-hidden focus:outline-hidden focus-visible:outline-hidden focus:ring-0 focus-visible:ring-0 [text-rendering:optimizeLegibility] [-webkit-font-smoothing:antialiased] [backface-visibility:hidden]",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground",
        outline: "text-foreground",
        glass:
          "bg-white/10 border-white/25 text-white",
        glassDestructive:
          "bg-red-500/40 border-red-400/50 text-red-200",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(badgeVariants({ variant }), className)}
        {...props}
      />
    )
  }
)
Badge.displayName = "Badge"

export { Badge, badgeVariants }
