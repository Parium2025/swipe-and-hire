import { createFileRoute } from "@tanstack/react-router";
import TeamInvite from "@/pages/TeamInvite";

export const Route = createFileRoute("/team-invite")({
  component: TeamInvite,
  ssr: false,
});
