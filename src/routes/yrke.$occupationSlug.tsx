import { createFileRoute } from "@tanstack/react-router";
import YrkePage from "@/pages/YrkePage";

export const Route = createFileRoute("/yrke/$occupationSlug")({
  component: YrkePage,
});
