import { createFileRoute } from "@tanstack/react-router";
import GuidePage from "@/pages/GuidePage";

export const Route = createFileRoute("/guider/$slug")({
  component: GuidePage,
});
