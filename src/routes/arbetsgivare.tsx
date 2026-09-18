import { createFileRoute } from "@tanstack/react-router";
import AudienceLanding from "@/pages/AudienceLanding";

export const Route = createFileRoute("/arbetsgivare")({
  component: () => <AudienceLanding key="employer" audience="employer" />,
});
