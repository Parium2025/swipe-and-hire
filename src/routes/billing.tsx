import { createFileRoute } from "@tanstack/react-router";
import Index from "@/pages/Index";

export const Route = createFileRoute("/billing")({
  component: Index,
  ssr: false,
});
