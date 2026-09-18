import { createFileRoute } from "@tanstack/react-router";
import MediaMigration from "@/pages/MediaMigration";

export const Route = createFileRoute("/migrate-media")({
  component: MediaMigration,
  ssr: false,
});
