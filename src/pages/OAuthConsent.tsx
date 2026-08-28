import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

type OAuthNamespace = {
  getAuthorizationDetails: (id: string) => Promise<{ data: any; error: any }>;
  approveAuthorization: (id: string) => Promise<{ data: any; error: any }>;
  denyAuthorization: (id: string) => Promise<{ data: any; error: any }>;
};

function oauthApi(): OAuthNamespace {
  return (supabase.auth as unknown as { oauth: OAuthNamespace }).oauth;
}

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) {
        setError("Länken saknar authorization_id.");
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = `/auth?next=${encodeURIComponent(next)}`;
        return;
      }
      const { data, error: detailsError } = await oauthApi().getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (detailsError) {
        setError(detailsError.message);
        return;
      }
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    const api = oauthApi();
    const { data, error: decisionError } = approve
      ? await api.approveAuthorization(authorizationId)
      : await api.denyAuthorization(authorizationId);
    if (decisionError) {
      setBusy(false);
      setError(decisionError.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("Auktoriseringsservern skickade ingen vidarelänk.");
      return;
    }
    window.location.href = target;
  }

  const clientName = details?.client?.name ?? "Appen";

  return (
    <main className="min-h-screen bg-gradient-parium flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl shadow-2xl">
        {error ? (
          <>
            <h1 className="text-xl font-semibold text-white">Kunde inte läsa förfrågan</h1>
            <p className="mt-2 text-sm text-white break-words">{error}</p>
          </>
        ) : !details ? (
          <p className="text-sm text-white">Laddar…</p>
        ) : (
          <>
            <h1 className="text-xl font-semibold text-white break-words">
              Anslut {clientName} till ditt Parium-konto
            </h1>
            <p className="mt-3 text-sm text-white break-words">
              {clientName} får läsa och använda Parium som dig via de verktyg som appen erbjuder. Du kan
              när som helst koppla bort anslutningen igen.
            </p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={busy}
                onClick={() => decide(false)}
                className="px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 touch-manipulation bg-white/5 text-white border border-white/10 md:hover:bg-white/10 disabled:opacity-50"
              >
                Neka
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => decide(true)}
                className="px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 touch-manipulation bg-white text-primary md:hover:bg-white/90 disabled:opacity-50"
              >
                Godkänn
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
