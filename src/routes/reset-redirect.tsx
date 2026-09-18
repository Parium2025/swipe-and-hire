import { createFileRoute } from "@tanstack/react-router";
import ResetRedirect from "@/pages/ResetRedirect";

export const Route = createFileRoute("/reset-redirect")({
  component: ResetRedirect,
  ssr: false,
});
