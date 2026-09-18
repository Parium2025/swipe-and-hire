import { createFileRoute } from "@tanstack/react-router";
import JobbKommun from "@/pages/JobbKommun";

export const Route = createFileRoute("/kommun/$kommunSlug")({
  component: JobbKommun,
});
