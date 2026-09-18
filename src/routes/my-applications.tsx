import { createFileRoute } from "@tanstack/react-router";
import Index from "@/pages/Index";

export const Route = createFileRoute("/my-applications")({
  component: Index,
  ssr: false,
});
