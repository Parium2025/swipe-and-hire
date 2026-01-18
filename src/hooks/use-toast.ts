// Konsoliderad toast-hook som använder Sonner istället för Radix
// Detta ger ett enhetligt toast-system genom hela appen

import { toast as sonnerToast, ExternalToast } from "sonner";

interface ToastOptions {
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
  action?: React.ReactNode;
  duration?: number;
}

// Wrapper-funktion som matchar det gamla API:t men använder Sonner
function toast({ title, description, variant, action, duration }: ToastOptions) {
  const message = title || description || "";
  const options: ExternalToast = {
    description: title ? description : undefined,
    action: action as ExternalToast["action"],
    duration,
  };

  if (variant === "destructive") {
    return sonnerToast.error(message, options);
  }

  return sonnerToast(message, options);
}

// Hook för bakåtkompatibilitet - returnerar samma API som tidigare
function useToast() {
  return {
    toast,
    dismiss: sonnerToast.dismiss,
    toasts: [], // Sonner hanterar state internt
  };
}

export { useToast, toast };
