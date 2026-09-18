import { createFileRoute } from "@tanstack/react-router";
import GuiderHub from "@/pages/GuiderHub";

export const Route = createFileRoute("/guider/")({
  component: GuiderHub,
});
