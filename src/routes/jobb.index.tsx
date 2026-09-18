import { createFileRoute } from "@tanstack/react-router";
import JobbHub from "@/pages/JobbHub";

export const Route = createFileRoute("/jobb/")({
  component: JobbHub,
});
