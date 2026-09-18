import { createFileRoute } from "@tanstack/react-router";
import AboutPage from "@/pages/AboutPage";

export const Route = createFileRoute("/om-oss")({
  component: AboutPage,
});
