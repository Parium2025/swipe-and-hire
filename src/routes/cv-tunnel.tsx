import { createFileRoute } from "@tanstack/react-router";
import CvTunnel from "@/pages/CvTunnel";

export const Route = createFileRoute("/cv-tunnel")({
  component: CvTunnel,
  ssr: false,
});
