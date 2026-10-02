import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { forgetInvite, rememberInvite } from "@/lib/pendingTeamInvite";
import { AlertTriangle, CheckCircle2, Loader2, Users } from "lucide-react";

type Status = "idle" | "working" | "success" | "error" | "needs-auth" | "wrong-account" | "already-accepted";

interface InvitePreview { email: string; organizationName: string | null; accountExists: boolean; alreadyAccepted?: boolean }

const readServerError = async (error: unknown, fallback: string) => {
  const context = (error as { context?: Response }).context;
  if (context && typeof context.json === "function") {
    try {
      const body = await context.json();
      if (typeof body?.error === "string") return body.error as string;
    } catch { /* fallback */ }
  }
  return fallback;
};

const TeamInvite = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading, refreshProfile, signOut } = useAuth();
  const token = searchParams.get("token") || "";

  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string>("");
  const [organizationName, setOrganizationName] = useState<string | null>(null);
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const attempted = useRef(false);
  const destination = `/team-invite?token=${encodeURIComponent(token)}`;

  const accept = useCallback(async () => {
    setStatus("working");
    try {
      const { data, error } = await supabase.functions.invoke("team-invite-accept", {
        body: { token },
      });

      if (error) {
        const serverMessage = await readServerError(error, "Inbjudan kunde inte accepteras.");
        if ((error as { context?: Response }).context?.status !== 403) forgetInvite();
        setStatus("error");
        setMessage(serverMessage);
        return;
      }

      forgetInvite();
      // Läs om profilen så välkomstguiden direkt vet att bolagets uppgifter är ärvda.
      await refreshProfile();
      navigate('/home', { replace: true });
    } catch {
      setStatus("error");
      setMessage("Något gick fel. Försök igen om en stund.");
    }
  }, [token, refreshProfile]);

  // Förhandsvisningen kräver ingen inloggning. Den hämtas direkt med den
  // publika nyckeln och en tidsgräns, så en gammal/trasig inloggning i
  // webbläsaren aldrig kan få sidan att snurra i evighet.
  const [previewState, setPreviewState] = useState<"loading" | "ready" | "failed">("loading");
  const [authWaitExpired, setAuthWaitExpired] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Länken saknar en giltig inbjudningskod.");
      setPreviewState("failed");
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 12000);
    setPreviewState("loading");
    void (async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/team-invite-accept`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ token, preview: true }),
          signal: controller.signal,
        });
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok || !data?.email) {
          if (res.status !== 403) forgetInvite();
          setStatus("error");
          setMessage(typeof data?.error === "string" ? data.error : "Inbjudan kunde inte hittas.");
          setPreviewState("failed");
          return;
        }
        const info = data as InvitePreview;
        setPreview(info);
        setOrganizationName(info.organizationName);
        setPreviewState("ready");
        if (info.alreadyAccepted) {
          forgetInvite();
          setStatus("already-accepted");
        }
      } catch {
        if (cancelled) return;
        setStatus("error");
        setMessage("Det tog för lång tid att kontrollera inbjudan. Kontrollera anslutningen och försök igen.");
        setPreviewState("failed");
      } finally {
        window.clearTimeout(timer);
      }
    })();
    return () => { cancelled = true; controller.abort(); window.clearTimeout(timer); };
  }, [token, retryKey]);

  // Vänta högst 6 s på inloggningsstatus; därefter behandlas besökaren som utloggad.
  useEffect(() => {
    if (!authLoading) return;
    const t = window.setTimeout(() => setAuthWaitExpired(true), 6000);
    return () => window.clearTimeout(t);
  }, [authLoading]);

  useEffect(() => {
    if (previewState !== "ready" || !preview || attempted.current) return;
    if (authLoading && !authWaitExpired) return;
    attempted.current = true;
    if (!user) {
      setStatus("needs-auth");
      return;
    }
    if ((user.email || "").toLowerCase() !== preview.email.toLowerCase()) {
      setStatus("wrong-account");
      return;
    }
    void accept();
  }, [accept, authLoading, authWaitExpired, preview, previewState, user]);

  const retry = useCallback(() => {
    attempted.current = false;
    setStatus("idle");
    setMessage("");
    setRetryKey((k) => k + 1);
  }, []);

  const goToAuth = useCallback(() => {
    rememberInvite(destination);
    try { sessionStorage.setItem("parium-auth-return-to", destination); } catch { /* localStorage covers it */ }
    const register = preview ? !preview.accountExists : false;
    navigate(register ? "/auth?mode=register&role=employer" : "/auth", {
      state: { returnTo: destination, ...(preview ? { email: preview.email } : {}), ...(register ? { mode: "register", role: "employer" } : {}) },
      replace: true,
    });
  }, [destination, navigate, preview]);

  const switchAccount = useCallback(async () => {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      goToAuth();
    }
  }, [goToAuth, signOut]);

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

        {(status === "idle" || status === "working") && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-white" />
            <p className="text-sm text-white">Kontrollerar din inbjudan…</p>
          </div>
        )}

        {(status === "needs-auth" || status === "wrong-account") && preview && (
          <>
            <div className="mb-3 flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-secondary/30 bg-secondary/10">
                <Users className="h-[18px] w-[18px] text-secondary" />
              </span>
              <h1 className="min-w-0 break-words text-2xl font-semibold text-white">
                Inbjudan till {preview.organizationName || "teamet"}
              </h1>
            </div>
            <p className="mb-7 break-words text-sm leading-6 text-white sm:text-base">
              {status === "wrong-account"
                ? `Du är inloggad som ${user?.email ?? "ett annat konto"}. Inbjudan gäller ${preview.email}. Logga ut och fortsätt med rätt adress.`
                : preview.accountExists
                  ? `Logga in med ${preview.email} för att gå med i teamet.`
                  : `Skapa ett konto med ${preview.email} för att gå med i teamet. Företagsuppgifterna hämtas från bolaget.`}
            </p>
            <Button
              type="button"
              variant="secondary"
              disabled={signingOut}
              className="w-full rounded-full text-white [&_svg]:text-white"
              onClick={status === "wrong-account" ? () => void switchAccount() : goToAuth}
            >
              {status === "wrong-account"
                ? "Logga ut och fortsätt"
                : preview.accountExists ? "Logga in" : "Skapa konto"}
            </Button>
          </>
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
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-0 bg-red-500/80">
                <AlertTriangle className="h-[18px] w-[18px] text-white" />
              </span>
              <h1 className="min-w-0 text-2xl font-semibold text-white">Inbjudan kunde inte användas</h1>
            </div>
            <p className="mb-7 break-words text-sm leading-6 text-white sm:text-base">{message}</p>
            <Button
              type="button"
              variant="secondary"
              className="w-full rounded-full text-white [&_svg]:text-white"
              onClick={retry}
            >
              Försök igen
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="mt-2 w-full rounded-full text-white hover:text-white"
              onClick={() => navigate("/")}
            >
              Till startsidan
            </Button>
          </>
        )}
      </section>
    </main>
  );
};

export default TeamInvite;
