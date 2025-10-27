import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors duration-150 outline-none focus:outline-none focus-visible:outline-none focus:ring-0 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground md:hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground md:hover:bg-red-700 md:hover:shadow-lg transition-all",
        outline:
          "border border-input bg-background md:hover:bg-accent md:hover:text-accent-foreground",
        // Neutral outline without accent hover for precise per-button control
        outlineNeutral:
          "border border-input bg-transparent md:hover:bg-transparent md:hover:text-inherit",
        secondary:
          "bg-secondary text-secondary-foreground md:hover:bg-secondary/80",
        ghost: "md:hover:bg-accent md:hover:text-accent-foreground",
        link: "text-primary underline-offset-4 md:hover:underline",
      },
      size: {
        default: "min-h-touch md:h-10 px-4 py-2",
        sm: "min-h-touch md:h-9 rounded-md px-3",
        lg: "min-h-touch md:h-11 rounded-md px-8",
        icon: "min-h-touch min-w-touch md:h-10 md:w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
