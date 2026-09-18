import { createFileRoute } from "@tanstack/react-router";
import DpaPage from "@/pages/DpaPage";

export const Route = createFileRoute("/dpa")({
  component: DpaPage,
});
