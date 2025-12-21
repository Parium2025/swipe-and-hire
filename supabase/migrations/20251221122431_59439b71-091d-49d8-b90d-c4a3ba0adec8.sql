-- Security linter fix: reinstall pg_net into the extensions schema (it is not relocatable).
-- This extension isn't used by our app code; reinstalling resolves "Extension in Public".

DROP EXTENSION IF EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
