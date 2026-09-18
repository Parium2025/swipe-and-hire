import { createFileRoute } from "@tanstack/react-router";
import YrkenHub from "@/pages/YrkenHub";

export const Route = createFileRoute("/yrken")({
  component: YrkenHub,
});
