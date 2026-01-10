import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex appearance-none select-none items-center justify-center gap-2 whitespace-nowrap text-sm font-medium outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 active:outline-none active:ring-0 active:ring-offset-0 active:shadow-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "rounded-md bg-primary text-primary-foreground md:hover:bg-primary/90 transition-colors duration-150",
        destructive:
          "rounded-md bg-destructive text-destructive-foreground md:hover:bg-destructive md:hover:shadow-lg md:hover:scale-[1.02] transition-all",
        destructiveSoft:
          "rounded-full bg-red-500/20 text-white border border-red-500/40 md:hover:bg-red-500/30 md:hover:border-red-500/50 transition-all duration-300",
        outline:
          "rounded-md border border-input bg-background md:hover:bg-accent md:hover:text-accent-foreground transition-colors duration-150",
        // Neutral outline without accent hover for precise per-button control
        outlineNeutral:
          "rounded-md border border-input bg-transparent md:hover:bg-transparent md:hover:text-inherit transition-colors duration-150",
        secondary:
          "rounded-md bg-secondary text-secondary-foreground md:hover:bg-secondary/80 transition-colors duration-150",
        ghost: "rounded-md md:hover:bg-accent md:hover:text-accent-foreground transition-colors duration-150",
        link: "text-primary underline-offset-4 md:hover:underline",
        // 🎨 Glassmorphism oval style - NO hover/active color shifts (prevents "flash")
        glass:
          "rounded-full bg-white/5 backdrop-blur-[2px] border border-white/20 text-white transition-colors duration-150 focus:ring-0 focus-visible:ring-0 outline-none focus:outline-none focus-visible:outline-none",
        // Glass variant with amber accent (for save/warning actions)
        glassAmber:
          "rounded-full bg-amber-500/20 backdrop-blur-sm border border-amber-500/40 text-white transition-colors duration-150 focus:ring-0 focus-visible:ring-0 outline-none focus:outline-none focus-visible:outline-none",
        // Glass variant with green accent (for success/confirm actions)
        glassGreen:
          "rounded-full bg-green-500/20 backdrop-blur-sm border border-green-500/40 text-white transition-colors duration-150 focus:ring-0 focus-visible:ring-0 outline-none focus:outline-none focus-visible:outline-none",
        // Glass variant with red accent (for destructive actions)
        glassRed:
          "rounded-full bg-red-500/20 backdrop-blur-sm border border-red-500/40 text-white transition-colors duration-150 focus:ring-0 focus-visible:ring-0 outline-none focus:outline-none focus-visible:outline-none",
        // Glass variant with blue accent (for info/primary actions)
        glassBlue:
          "rounded-full bg-blue-500/20 backdrop-blur-sm border border-blue-500/40 text-white transition-colors duration-150 focus:ring-0 focus-visible:ring-0 outline-none focus:outline-none focus-visible:outline-none",
        // Glass variant with yellow accent (for warning/reviewing actions)
        glassYellow:
          "rounded-full bg-yellow-500/20 backdrop-blur-sm border border-yellow-500/40 text-white transition-colors duration-150 focus:ring-0 focus-visible:ring-0 outline-none focus:outline-none focus-visible:outline-none",
      },
      size: {
        default: "min-h-touch md:h-10 px-4 py-2",
        sm: "min-h-touch md:h-9 px-3",
        lg: "min-h-touch md:h-11 px-8",
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
