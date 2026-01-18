import { useTheme } from "next-themes"
import { Toaster as Sonner, toast } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      style={{ zIndex: 99999 }}
      duration={2000}
      closeButton
      richColors
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-slate-900/85 group-[.toaster]:backdrop-blur-xl group-[.toaster]:text-white group-[.toaster]:border group-[.toaster]:border-white/20 group-[.toaster]:shadow-lg cursor-pointer",
          description: "group-[.toast]:text-white",
          actionButton:
            "group-[.toast]:bg-white/10 group-[.toast]:text-white group-[.toast]:border group-[.toast]:border-white/20",
          cancelButton:
            "group-[.toast]:bg-white/10 group-[.toast]:text-white group-[.toast]:border group-[.toast]:border-white/20",
          closeButton: "group-[.toast]:bg-white/10 group-[.toast]:text-white group-[.toast]:border group-[.toast]:border-white/20 hover:group-[.toast]:bg-white/20",
        },
      }}
      {...props}
    />
  )
}

export { Toaster, toast }
