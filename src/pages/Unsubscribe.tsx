import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, Check, X, Mail } from "lucide-react";
import { Helmet } from "react-helmet-async";

type State =
  | { kind: "loading" }
  | { kind: "valid"; email: string }
  | { kind: "already" }
  | { kind: "invalid"; message: string }
  | { kind: "confirming" }
  | { kind: "success" };

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

const Unsubscribe = () => {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    if (!token) {
      setState({ kind: "invalid", message: "Länken saknar en giltig token." });
      return;
    }
    (async () => {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`,
          { headers: { apikey: SUPABASE_ANON_KEY } }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setState({ kind: "invalid", message: data?.error || "Länken är ogiltig eller har gått ut." });
          return;
        }
        if (data?.alreadyUnsubscribed) {
          setState({ kind: "already" });
        } else {
          setState({ kind: "valid", email: data?.email || "" });
        }
      } catch {
        setState({ kind: "invalid", message: "Vi kunde inte verifiera länken. Försök igen." });
      }
    })();
  }, [token]);

  const handleConfirm = async () => {
    setState({ kind: "confirming" });
    try {
      const { data, error } = await supabase.functions.invoke("handle-email-unsubscribe", {
        body: { token },
      });
      if (error) throw error;
      if (data?.success) setState({ kind: "success" });
      else setState({ kind: "invalid", message: "Något gick fel. Försök igen." });
    } catch {
      setState({ kind: "invalid", message: "Något gick fel. Försök igen." });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#001F3D] to-[#002a52] flex items-center justify-center px-4">
      <Helmet>
        <title>Avprenumerera – Parium</title>
        <meta name="description" content="Avprenumerera från mail från Parium." />
      </Helmet>
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
        <div className="flex items-center gap-2 mb-6">
          <Mail className="w-5 h-5 text-[#001F3D]" />
          <span className="font-bold text-[#001F3D] tracking-tight">Parium</span>
        </div>

        {state.kind === "loading" && (
          <div className="text-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-[#001F3D] mx-auto mb-3" />
            <p className="text-slate-600">Verifierar länken…</p>
          </div>
        )}

        {state.kind === "valid" && (
          <>
            <h1 className="text-2xl font-bold text-[#001F3D] mb-2">Avprenumerera?</h1>
            <p className="text-slate-600 mb-6">
              Du håller på att avprenumerera{" "}
              {state.email ? <strong>{state.email}</strong> : "denna adress"} från alla mail från Parium.
            </p>
            <Button onClick={handleConfirm} className="w-full bg-[#001F3D] hover:bg-[#002a52] text-white">
              Bekräfta avprenumeration
            </Button>
            <Link to="/" className="block text-center text-sm text-slate-500 mt-4 hover:underline">
              Avbryt
            </Link>
          </>
        )}

        {state.kind === "confirming" && (
          <div className="text-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-[#001F3D] mx-auto mb-3" />
            <p className="text-slate-600">Avprenumererar…</p>
          </div>
        )}

        {state.kind === "success" && (
          <div className="text-center py-4">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <Check className="w-6 h-6 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-[#001F3D] mb-2">Avprenumererad</h1>
            <p className="text-slate-600 mb-6">
              Du kommer inte att få fler mail från Parium. Du kan alltid slå på notiser igen i din profil.
            </p>
            <Link to="/">
              <Button variant="outline" className="w-full">Tillbaka till Parium</Button>
            </Link>
          </div>
        )}

        {state.kind === "already" && (
          <div className="text-center py-4">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
              <Check className="w-6 h-6 text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-[#001F3D] mb-2">Redan avprenumererad</h1>
            <p className="text-slate-600 mb-6">Denna adress är redan avprenumererad från våra mail.</p>
            <Link to="/">
              <Button variant="outline" className="w-full">Tillbaka till Parium</Button>
            </Link>
          </div>
        )}

        {state.kind === "invalid" && (
          <div className="text-center py-4">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <X className="w-6 h-6 text-red-600" />
            </div>
            <h1 className="text-2xl font-bold text-[#001F3D] mb-2">Ogiltig länk</h1>
            <p className="text-slate-600 mb-6">{state.message}</p>
            <Link to="/">
              <Button variant="outline" className="w-full">Tillbaka till Parium</Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default Unsubscribe;
