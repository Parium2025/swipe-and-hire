import { createFileRoute } from "@tanstack/react-router";
import JobbCity from "@/pages/JobbCity";

export const Route = createFileRoute("/jobb/$citySlug/")({
  component: JobbCity,
});
