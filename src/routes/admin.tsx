import { createFileRoute } from "@tanstack/react-router";
import Index from "@/pages/Index";

export const Route = createFileRoute("/admin")({
  component: Index,
  ssr: false,
});
