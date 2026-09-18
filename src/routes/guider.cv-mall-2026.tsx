import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/guider/cv-mall-2026")({
  beforeLoad: () => {
    throw redirect({ to: "/guider", replace: true });
  },
});
