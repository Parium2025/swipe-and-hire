import { createFileRoute } from "@tanstack/react-router";
import InterviewResponse from "@/pages/InterviewResponse";

export const Route = createFileRoute("/intervjusvar")({
  component: InterviewResponse,
  ssr: false,
});
