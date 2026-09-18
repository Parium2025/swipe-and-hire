import { createFileRoute } from "@tanstack/react-router";
import ValjPlan from "@/pages/ValjPlan";

export const Route = createFileRoute("/valj-plan")({
  component: ValjPlan,
  ssr: false,
});
