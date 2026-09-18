import { createFileRoute } from "@tanstack/react-router";
import AudienceLanding from "@/pages/AudienceLanding";

export const Route = createFileRoute("/jobbsokare")({
  component: () => <AudienceLanding key="job_seeker" audience="job_seeker" />,
});
