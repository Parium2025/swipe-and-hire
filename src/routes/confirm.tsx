import { createFileRoute } from "@tanstack/react-router";
import EmailConfirm from "@/pages/EmailConfirm";

export const Route = createFileRoute("/confirm")({
  component: EmailConfirm,
  ssr: false,
});
