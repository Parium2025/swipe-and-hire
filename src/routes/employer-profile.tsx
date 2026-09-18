import { createFileRoute } from "@tanstack/react-router";
import Index from "@/pages/Index";

export const Route = createFileRoute("/employer-profile")({
  component: Index,
  ssr: false,
});
