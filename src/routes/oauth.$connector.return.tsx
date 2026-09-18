import { createFileRoute } from "@tanstack/react-router";
import OAuthReturn from "@/pages/oauth/OAuthReturn";

export const Route = createFileRoute("/oauth/$connector/return")({
  component: OAuthReturn,
  ssr: false,
});
