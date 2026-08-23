// Konsoliderad toast-hook som använder Sonner istället för Radix
// Detta ger ett enhetligt toast-system genom hela appen

import { toast as sonnerToast, ExternalToast } from "sonner";

interface ToastOptions {
  title?: string;
  description?: string;
  variant?: "default" | "destructive" | "success" | "warning";
  action?: React.ReactNode;
  duration?: number;
  /** Gör notisen klickbar i notiscentret – navigerar hit vid klick. */
  route?: string;
}

// Wrapper-funktion som matchar det gamla API:t men använder Sonner
function toast({ title, description, variant, action, duration, route }: ToastOptions) {
  const message = title || description || "";
  const options: ExternalToast = {
    description: title ? description : undefined,
    action: action as ExternalToast["action"],
    // Skicka bara med duration när den faktiskt är satt — annars skriver
    // undefined över våra centrala visningstider i sonner.tsx.
    ...(duration !== undefined ? { duration } : {}),
    ...(route ? { route } : {}),
  } as ExternalToast;

  if (variant === "destructive") {
    return sonnerToast.error(message, options);
  }

  if (variant === "success") {
    return sonnerToast.success(message, options);
  }

  if (variant === "warning") {
    return sonnerToast.warning(message, options);
  }

  // Standardnotiser får samma premiumstil (ikon + ton) som info istället för
  // en tom, mörk ruta.
  return sonnerToast.info(message, options);
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
