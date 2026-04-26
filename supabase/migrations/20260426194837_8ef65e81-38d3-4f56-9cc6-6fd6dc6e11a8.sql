-- Disable unused GraphQL API/introspection surface so anonymous users cannot discover public schema objects there.
DROP EXTENSION IF EXISTS pg_graphql;

-- Remove broad duplicate attachment upload policy. The stricter owner-folder policy remains:
-- "Users can upload message attachments" requires bucket_id = 'message-attachments'
-- and the first storage path segment to match the authenticated user's id.
DROP POLICY IF EXISTS "Authenticated users can upload message attachments" ON storage.objects;