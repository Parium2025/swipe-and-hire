import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex appearance-none select-none items-center justify-center gap-2 whitespace-nowrap text-sm font-medium outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 active:outline-none active:ring-0 active:ring-offset-0 active:shadow-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 transition-all duration-150 [-webkit-tap-highlight-color:transparent] [-webkit-touch-callout:none]",
  {
    variants: {
      variant: {
        default: "rounded-md bg-primary text-primary-foreground md:hover:bg-primary/90 active:scale-[0.97] active:bg-primary/80",
        destructive:
          "rounded-md bg-destructive text-destructive-foreground md:hover:bg-destructive md:hover:shadow-lg md:hover:scale-[1.02] active:scale-[0.97] active:bg-destructive/90",
        destructiveSoft:
          "rounded-full border border-destructive/40 bg-destructive/20 text-white md:hover:!border-destructive/50 md:hover:!bg-destructive/30 md:hover:!text-white active:scale-[0.97] active:bg-destructive/40",
        outline:
          "rounded-md border border-input bg-background md:hover:bg-accent md:hover:text-accent-foreground active:scale-[0.97] active:bg-accent/80",
        // Neutral outline without accent hover for precise per-button control
        outlineNeutral:
          "rounded-md border border-input bg-transparent md:hover:bg-transparent md:hover:text-inherit active:scale-[0.97]",
        secondary:
          "rounded-md bg-secondary text-secondary-foreground md:hover:bg-secondary/80 active:scale-[0.97] active:bg-secondary/70",
        ghost: "rounded-md md:hover:bg-accent md:hover:text-accent-foreground active:scale-[0.97] active:bg-accent/50",
        link: "text-primary underline-offset-4 md:hover:underline active:opacity-70",
        // 🎨 Glassmorphism oval style - with touch feedback
        glass:
          "rounded-full bg-white/5 backdrop-blur-[2px] border border-white/20 text-white focus:ring-0 focus-visible:ring-0 outline-none focus:outline-none focus-visible:outline-none active:scale-[0.97] active:border-white/30",
        // Glass variant with amber accent (for save/warning actions)
        glassAmber:
          "rounded-full bg-amber-500/20 backdrop-blur-sm border border-amber-500/40 text-white focus:ring-0 focus-visible:ring-0 outline-none focus:outline-none focus-visible:outline-none active:scale-[0.97] active:bg-amber-500/40",
        // Glass variant with green accent (for success/confirm actions)
        glassGreen:
          "rounded-full bg-green-500/20 backdrop-blur-sm border border-green-500/40 text-white focus:ring-0 focus-visible:ring-0 outline-none focus:outline-none focus-visible:outline-none active:scale-[0.97] active:bg-green-500/40",
        // Glass variant with red accent (for destructive actions)
        glassRed:
          "rounded-full bg-red-500/20 backdrop-blur-sm border border-red-500/40 text-white focus:ring-0 focus-visible:ring-0 outline-none focus:outline-none focus-visible:outline-none active:scale-[0.97] active:bg-red-500/40",
        // Glass variant with blue accent (for info/primary actions)
        glassBlue:
          "rounded-full bg-blue-500/20 backdrop-blur-sm border border-blue-500/40 text-white focus:ring-0 focus-visible:ring-0 outline-none focus:outline-none focus-visible:outline-none active:scale-[0.97] active:bg-blue-500/40",
        // Glass variant with yellow accent (for warning/reviewing actions)
        glassYellow:
          "rounded-full bg-yellow-500/20 backdrop-blur-sm border border-yellow-500/40 text-white focus:ring-0 focus-visible:ring-0 outline-none focus:outline-none focus-visible:outline-none active:scale-[0.97] active:bg-yellow-500/40",
        // Glass variant with purple accent (for messaging/communication actions)
        glassPurple:
          "rounded-full bg-purple-500/20 backdrop-blur-sm border border-purple-500/40 text-white focus:ring-0 focus-visible:ring-0 outline-none focus:outline-none focus-visible:outline-none active:scale-[0.97] active:bg-purple-500/40",
      },
      size: {
        default: "h-[var(--control-height)] px-4 py-2",
        sm: "h-[var(--control-height-sm)] px-3",
        lg: "h-[var(--control-height)] px-8",
        icon: "h-[var(--icon-button-size)] w-[var(--icon-button-size)] p-0 shrink-0 aspect-square",
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
