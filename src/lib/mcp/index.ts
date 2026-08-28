import { auth, defineMcp } from "@lovable.dev/mcp-js";
import whoamiTool from "./tools/whoami";
import searchJobsTool from "./tools/search-jobs";
import getJobTool from "./tools/get-job";
import listMyJobPostingsTool from "./tools/list-my-job-postings";
import listJobApplicationsTool from "./tools/list-job-applications";
import listMyApplicationsTool from "./tools/list-my-applications";

// OAuth-utfärdaren måste vara den direkta Supabase-värden, byggd från projekt-id
// (Vite ersätter värdet vid build och den är därför import-säker).
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "parium-ab",
  title: "parium-ab",
  version: "0.1.0",
  instructions:
    "Verktyg för Parium — svensk jobbplattform. Sök jobb, hämta annonsdetaljer, se dina egna annonser och ansökningar. Alla verktyg körs som den inloggade användaren och respekterar plattformens behörigheter.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    whoamiTool,
    searchJobsTool,
    getJobTool,
    listMyJobPostingsTool,
    listJobApplicationsTool,
    listMyApplicationsTool,
  ],
});
