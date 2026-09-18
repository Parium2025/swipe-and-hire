import { createFileRoute } from "@tanstack/react-router";
import KommunHub from "@/pages/KommunHub";

export const Route = createFileRoute("/kommuner")({
  component: KommunHub,
});
