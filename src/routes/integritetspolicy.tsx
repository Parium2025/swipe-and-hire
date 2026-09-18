import { createFileRoute } from "@tanstack/react-router";
import IntegrityPolicyPage from "@/pages/IntegrityPolicyPage";

export const Route = createFileRoute("/integritetspolicy")({
  component: IntegrityPolicyPage,
});
