import * as React from "react";
import { createPortal } from "react-dom";
import { Toaster as Sonner, toast as sonnerToast } from "sonner";
import { CheckCircle2, AlertTriangle, Info, XCircle, Loader2 } from "lucide-react";

type ToasterProps = React.ComponentProps<typeof Sonner>;

// Centrala visningstider: bekräftelser försvinner snabbt, fel får mer tid att läsas.
const DURATIONS = { success: 2600, info: 3200, warning: 4500, error: 5500 } as const;

const patched = "__pariumDurations" as const;
if (typeof window !== "undefined" && !(sonnerToast as any)[patched]) {
  (sonnerToast as any)[patched] = true;
  (Object.keys(DURATIONS) as Array<keyof typeof DURATIONS>).forEach((kind) => {
    const original = (sonnerToast as any)[kind]?.bind(sonnerToast);
    if (!original) return;
    (sonnerToast as any)[kind] = (message: any, options?: any) =>
      original(message, { duration: DURATIONS[kind], ...(options ?? {}) });
  });
}

const IconShell = ({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "success" | "error" | "warning" | "info" | "loading";
}) => {
  const tones: Record<string, string> = {
    success: "bg-emerald-400/15 text-emerald-300 ring-emerald-400/30",
    error: "bg-red-400/15 text-red-300 ring-red-400/30",
    warning: "bg-amber-400/15 text-amber-300 ring-amber-400/30",
    info: "bg-sky-400/15 text-sky-300 ring-sky-400/30",
    loading: "bg-white/10 text-white ring-white/20",
  };
  return (
    <span
      className={`flex h-7 w-7 min-w-[1.75rem] shrink-0 grow-0 basis-7 aspect-square items-center justify-center rounded-full ring-1 ${tones[tone]}`}
    >
      {children}
    </span>
  );
};

const Toaster = ({ ...props }: ToasterProps) => {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Gör Sonner-toasts klickbara för att stänga (utan att kräva ett synligt X).
  React.useEffect(() => {
    const onPointerUp = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      const toastEl = target.closest("[data-sonner-toast]") as HTMLElement | null;
      if (!toastEl) return;

      if (target.closest("[data-button]") || target.closest("[data-close-button]")) return;

      const closeBtn = toastEl.querySelector(
        "[data-close-button]"
      ) as HTMLButtonElement | null;

      closeBtn?.click();
    };

    document.addEventListener("pointerup", onPointerUp, true);
    return () => document.removeEventListener("pointerup", onPointerUp, true);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <Sonner
      theme="dark"
      className="toaster group"
      style={{ zIndex: 99999 }}
      position="top-center"
      duration={4000}
      closeButton
      visibleToasts={3}
      expand={false}
      gap={10}
      icons={{
        success: (
          <IconShell tone="success">
            <CheckCircle2 className="h-4 w-4" />
          </IconShell>
        ),
        error: (
          <IconShell tone="error">
            <XCircle className="h-4 w-4" />
          </IconShell>
        ),
        warning: (
          <IconShell tone="warning">
            <AlertTriangle className="h-4 w-4" />
          </IconShell>
        ),
        info: (
          <IconShell tone="info">
            <Info className="h-4 w-4" />
          </IconShell>
        ),
        loading: (
          <IconShell tone="loading">
            <Loader2 className="h-4 w-4 animate-spin" />
          </IconShell>
        ),
      }}
      toastOptions={{
        closeButton: true,
        classNames: {
          toast:
            "group toast relative cursor-pointer select-none " +
            "group-[.toaster]:w-full group-[.toaster]:items-start group-[.toaster]:gap-3 " +
            "group-[.toaster]:rounded-2xl group-[.toaster]:px-4 group-[.toaster]:py-3.5 " +
            "group-[.toaster]:bg-[linear-gradient(135deg,hsl(215_60%_14%/0.92),hsl(215_70%_9%/0.94))] " +
            "group-[.toaster]:backdrop-blur-2xl group-[.toaster]:text-white " +
            "group-[.toaster]:border group-[.toaster]:border-white/12 " +
            "group-[.toaster]:shadow-[0_18px_50px_-12px_rgba(0,0,0,0.65),inset_0_1px_0_0_rgba(255,255,255,0.08)]",
          icon: "group-[.toast]:mt-0.5 group-[.toast]:mr-0 group-[.toast]:!h-7 group-[.toast]:!w-7 group-[.toast]:!min-w-[1.75rem] group-[.toast]:shrink-0 group-[.toast]:grow-0 group-[.toast]:!m-0 group-[.toast]:!mt-0.5 group-[.toast]:!mr-0 group-[.toast]:items-center group-[.toast]:justify-center",
          content: "group-[.toast]:gap-0.5",
          title:
            "group-[.toast]:text-[15px] group-[.toast]:font-semibold group-[.toast]:leading-snug group-[.toast]:tracking-[-0.01em] group-[.toast]:text-white",
          description:
            "group-[.toast]:text-[13px] group-[.toast]:leading-relaxed group-[.toast]:text-white",
          closeButton:
            "absolute inset-0 z-20 h-full w-full opacity-0 transform-none rounded-none border-0 bg-transparent p-0 m-0 pointer-events-auto hover:opacity-0 focus:opacity-0",
          actionButton:
            "relative z-30 group-[.toast]:rounded-full group-[.toast]:bg-white/12 group-[.toast]:text-white group-[.toast]:border group-[.toast]:border-white/20 group-[.toast]:font-medium",
          cancelButton:
            "relative z-30 group-[.toast]:rounded-full group-[.toast]:bg-white/8 group-[.toast]:text-white group-[.toast]:border group-[.toast]:border-white/15",
          error:
            "group-[.toaster]:!bg-[linear-gradient(135deg,hsl(0_60%_20%/0.92),hsl(0_60%_11%/0.94))] group-[.toaster]:!border-red-400/25",
          success:
            "group-[.toaster]:!bg-[linear-gradient(135deg,hsl(200_70%_18%/0.92),hsl(215_75%_10%/0.94))] group-[.toaster]:!border-sky-300/25",
          warning:
            "group-[.toaster]:!bg-[linear-gradient(135deg,hsl(38_60%_20%/0.92),hsl(30_60%_11%/0.94))] group-[.toaster]:!border-amber-300/25",
          info:
            "group-[.toaster]:!bg-[linear-gradient(135deg,hsl(215_60%_16%/0.92),hsl(215_70%_9%/0.94))] group-[.toaster]:!border-white/12",
        },
      }}
      {...props}
    />,
    document.body
  );
};

export { Toaster };
