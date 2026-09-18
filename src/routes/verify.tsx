import { createFileRoute } from "@tanstack/react-router";
import EmailVerification from "@/pages/EmailVerification";

export const Route = createFileRoute("/verify")({
  component: EmailVerification,
  ssr: false,
});
