import { createFileRoute } from "@tanstack/react-router";
import JobbCityYrke from "@/pages/JobbCityYrke";

export const Route = createFileRoute("/jobb/$citySlug/$occupationSlug")({
  component: JobbCityYrke,
});
