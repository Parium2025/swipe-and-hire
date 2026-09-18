import { createFileRoute } from "@tanstack/react-router";
import EmailRedirect from "@/pages/EmailRedirect";

export const Route = createFileRoute("/email-redirect")({
  component: EmailRedirect,
  ssr: false,
});
