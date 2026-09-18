import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AlertTriangle, CheckCircle2, Loader2, Users } from "lucide-react";

type Status = "idle" | "working" | "success" | "error";

const TeamInvite = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const token = searchParams.get("token") || "";

  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string>("");
  const [organizationName, setOrganizationName] = useState<string | null>(null);
  const attempted = useRef(false);

  const accept = useCallback(async () => {
    setStatus("working");
    try {
      const { data, error } = await supabase.functions.invoke("team-invite-accept", {
        body: { token },
      });

      if (error) {
        // Edge errors carry the server message in the response body.
        let serverMessage = "Inbjudan kunde inte accepteras.";
        const context = (error as { context?: Response }).context;
        if (context && typeof context.json === "function") {
          try {
            const body = await context.json();
            if (typeof body?.error === "string") serverMessage = body.error;
          } catch {
            // Fall back to the generic message.
          }
        }
        setStatus("error");
        setMessage(serverMessage);
        return;
      }

      setOrganizationName((data as { organizationName?: string | null })?.organizationName ?? null);
      setStatus("success");
    } catch {
      setStatus("error");
      setMessage("Något gick fel. Försök igen om en stund.");
    }
  }, [token]);

  useEffect(() => {
    if (authLoading || attempted.current) return;
    if (!token) {
      attempted.current = true;
      setStatus("error");
      setMessage("Länken saknar en giltig inbjudningskod.");
      return;
    }
    if (!user) {
      attempted.current = true;
      const destination = `/team-invite?token=${encodeURIComponent(token)}`;
      try {
        sessionStorage.setItem("parium-auth-return-to", destination);
      } catch {
        // Navigation state below still carries the destination in this tab.
      }
      navigate("/auth", { state: { returnTo: destination }, replace: true });
      return;
    }
    attempted.current = true;
    void accept();
  }, [accept, authLoading, navigate, token, user]);

  return (
    <main className="min-h-screen bg-parium-gradient flex items-center justify-center px-4 py-8 text-primary-foreground">
      <Helmet>
        <title>Teaminbjudan – Parium</title>
        <meta name="description" content="Acceptera din inbjudan och gå med i teamet på Parium." />
      </Helmet>
      <section className="w-full max-w-md rounded-lg border border-white/15 bg-white/[0.07] p-6 shadow-2xl backdrop-blur-md sm:p-8">
        <div className="mb-8 flex items-center justify-center gap-2">
          <Users className="h-5 w-5 shrink-0 text-secondary" />
          <span className="font-semibold leading-none text-white">Parium</span>
        </div>

        {(status === "idle" || status === "working" || authLoading) && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-white" />
            <p className="text-sm text-white">Kontrollerar din inbjudan…</p>
          </div>
        )}

        {status === "success" && (
          <>
            <div className="mb-3 flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-secondary/30 bg-secondary/10">
                <CheckCircle2 className="h-[18px] w-[18px] text-secondary" />
              </span>
              <h1 className="min-w-0 text-2xl font-semibold text-white">Välkommen till teamet</h1>
            </div>
            <p className="mb-7 break-words text-sm leading-6 text-white sm:text-base">
              Du är nu medlem i {organizationName || "organisationen"}. Du kommer åt teamets annonser
              och kandidater direkt.
            </p>
            <Button
              type="button"
              variant="secondary"
              className="w-full rounded-full text-white [&_svg]:text-white"
              onClick={() => navigate("/dashboard")}
            >
              Till översikten
            </Button>
          </>
        )}

        {status === "error" && (
          <>
            <div className="mb-3 flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-destructive/40 bg-destructive/15">
                <AlertTriangle className="h-[18px] w-[18px] text-white" />
              </span>
              <h1 className="min-w-0 text-2xl font-semibold text-white">Inbjudan kunde inte användas</h1>
            </div>
            <p className="mb-7 break-words text-sm leading-6 text-white sm:text-base">{message}</p>
            <Button
              type="button"
              variant="secondary"
              className="w-full rounded-full text-white [&_svg]:text-white"
              onClick={() => navigate("/")}
            >
              Till startsidan
            </Button>
          </>
        )}

        <Link to="/" className="mt-5 block text-center text-sm text-white underline-offset-4 hover:underline">
          Till startsidan
        </Link>
      </section>
    </main>
  );
};

export default TeamInvite;
