import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/annonser")({
  beforeLoad: () => {
    throw redirect({ to: "/jobb", replace: true });
  },
});
