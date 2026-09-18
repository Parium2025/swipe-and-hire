import { createFileRoute } from "@tanstack/react-router";
import Index from "@/pages/Index";

export const Route = createFileRoute("/job-details/$jobId")({
  component: Index,
  ssr: false,
});
