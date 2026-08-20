import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Bell, ChevronRight, Mail } from "lucide-react";
import { Helmet } from "react-helmet-async";
import { useAuth } from "@/hooks/useAuth";

/**
 * Tidigare låg en "Avprenumerera"-knapp här som verifierade en token direkt
 * vid sidladdning. Den togs bort: användaren styr i stället sina utskick i
 * notisinställningarna, så inget hinner blinka eller låsa sig i UI:t.
 */
const Unsubscribe = () => {
  const navigate = useNavigate();
  const { user, profile, userRole, loading } = useAuth();

  const openNotificationSettings = () => {
    const role = (profile as { role?: string } | null)?.role ?? userRole?.role;
    const destination = role === 'employer' ? '/settings#notifications' : '/profile#notifications';

    if (user) {
      navigate(destination);
      return;
    }

    try {
      sessionStorage.setItem('parium-auth-return-to', destination);
    } catch {
      // Navigation state below still carries the destination in this tab.
    }
    navigate('/auth', { state: { returnTo: destination } });
  };

  return (
    <main className="min-h-screen bg-parium-gradient flex items-center justify-center px-4 py-8 text-primary-foreground">
      <Helmet>
        <title>Hantera dina mejl – Parium</title>
        <meta name="description" content="Styr vilka mejl och notiser du får från Parium i dina notisinställningar." />
      </Helmet>
      <section className="w-full max-w-md rounded-lg border border-white/15 bg-white/[0.07] p-6 shadow-2xl backdrop-blur-md sm:p-8">
        <div className="mb-8 flex items-center justify-center gap-2">
          <Mail className="h-5 w-5 shrink-0 text-secondary" />
          <span className="font-semibold leading-none text-white">Parium</span>
        </div>


        <div className="mb-3 flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-secondary/30 bg-secondary/10">
            <Bell className="h-[18px] w-[18px] text-secondary" />
          </span>
          <h1 className="text-2xl font-semibold text-white">Hantera dina utskick</h1>
        </div>
        <p className="mb-7 text-sm leading-6 text-white sm:text-base">
          Du väljer själv vilka mejl och notiser du vill få. Allt styrs i dina notisinställningar — slå av
          det du inte vill ha och slå på det igen när du vill.
        </p>

        <Button
          type="button"
          variant="secondary"
          className="w-full rounded-full text-white [&_svg]:text-white"
          onClick={openNotificationSettings}
          disabled={loading}
        >
          {loading ? 'Kontrollerar inloggning…' : 'Öppna notisinställningar'}
          {!loading && <ChevronRight className="h-4 w-4 text-white" />}
        </Button>

        <Link to="/" className="mt-5 block text-center text-sm text-white underline-offset-4 hover:underline">
          Till startsidan
        </Link>
      </section>
    </main>
  );
};

export default Unsubscribe;
