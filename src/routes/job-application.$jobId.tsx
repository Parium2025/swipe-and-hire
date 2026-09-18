import { createFileRoute } from "@tanstack/react-router";
import JobApplication from "@/pages/JobApplication";

export const Route = createFileRoute("/job-application/$jobId")({
  component: JobApplication,
  ssr: false,
});
