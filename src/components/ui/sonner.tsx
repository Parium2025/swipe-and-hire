import * as React from "react";
import { createPortal } from "react-dom";
import { useTheme } from "next-themes";
import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      style={{ zIndex: 99999 }}
      duration={4000}
      closeButton
      richColors
      toastOptions={{
        classNames: {
          toast:
            "group toast relative group-[.toaster]:bg-slate-900/85 group-[.toaster]:backdrop-blur-xl group-[.toaster]:text-white group-[.toaster]:border group-[.toaster]:border-white/20 group-[.toaster]:shadow-lg cursor-pointer select-none",
          // Gör hela toasten klickbar utan att visa ett X
          closeButton:
            "absolute inset-0 h-full w-full opacity-0 hover:opacity-0 focus:opacity-0",
          description: "group-[.toast]:text-white",
          actionButton:
            "relative z-10 group-[.toast]:bg-white/10 group-[.toast]:text-white group-[.toast]:border group-[.toast]:border-white/20",
          cancelButton:
            "relative z-10 group-[.toast]:bg-white/10 group-[.toast]:text-white group-[.toast]:border group-[.toast]:border-white/20",
        },
      }}
      {...props}
    />,
    document.body
  );
};

export { Toaster };
