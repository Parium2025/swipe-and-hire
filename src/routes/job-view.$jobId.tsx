import { createFileRoute } from "@tanstack/react-router";
import Index from "@/pages/Index";

export const Route = createFileRoute("/job-view/$jobId")({
  component: Index,
  ssr: false,
});
