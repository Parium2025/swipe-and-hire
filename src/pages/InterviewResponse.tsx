import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { CalendarCheck, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Publik svarssida för intervjuinbjudan. Kandidaten kommer hit från mejlet och
 * bekräftar sitt svar här — sidan ligger på parium.se så att den alltid visas
 * som en riktig sida, oavsett mejlklient.
 */
const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/interview-response`;

type Phase = 'confirm' | 'sending' | 'done' | 'error';
// Permanenta spärrar: ett nytt tryck kan aldrig lyckas, så "Försök igen" döljs.
type DeadReason = 'started' | 'expired' | 'closed' | null;

const InterviewResponse = () => {
  const [params] = useSearchParams();
  // Egna intervjutokens får ett tydligt namn så den globala auth-hanteringen
  // aldrig kan misstolka dem som lösenordsåterställning. Behåll fallback för
  // redan utskickade länkar.
  const token = params.get('interview_token') ?? params.get('token') ?? '';
  const answer = params.get('answer') === 'no' ? 'no' : 'yes';
  const accept = answer === 'yes';

  const validLink = useMemo(
    () => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token),
    [token],
  );

  const [phase, setPhase] = useState<Phase>('confirm');
  const [message, setMessage] = useState('');
  const [deadReason, setDeadReason] = useState<DeadReason>(null);

  const submit = async () => {
    setPhase('sending');
    try {
      const response = await fetch(FUNCTIONS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, answer }),
      });
      const data = await response.json().catch(() => null) as
        | { ok?: boolean; reason?: string | null; already?: boolean; jobTitle?: string | null }
        | null;

      if (!data?.ok) {
        const reason = data?.reason ?? '';
        setMessage(
          reason === 'expired'
            ? 'Länken har gått ut. Logga in i Parium för att svara på intervjun.'
            : reason === 'started'
              ? 'Intervjun har redan börjat, så länken går inte längre att använda. Kontakta arbetsgivaren i Parium om något har hänt.'
              : reason === 'closed'
                ? 'Intervjun är inte längre öppen för svar. Logga in i Parium för att se vad som gäller.'
                : 'Svaret kunde inte registreras just nu. Försök igen om en stund eller svara inne i Parium.',
        );
        setPhase('error');
        return;
      }

      const suffix = data.jobTitle ? ` för ${data.jobTitle}` : '';
      setMessage(
        accept
          ? `${data.already ? 'Du hade redan tackat ja' : 'Du har tackat ja'} till intervjun${suffix}. Arbetsgivaren har fått besked.`
          : `${data.already ? 'Du hade redan tackat nej' : 'Du har tackat nej'} till intervjun${suffix}. Arbetsgivaren har fått besked.`,
      );
      setPhase('done');
    } catch {
      setMessage('Svaret kunde inte registreras just nu. Kontrollera din uppkoppling och försök igen.');
      setPhase('error');
    }
  };

  const heading = !validLink
    ? 'Länken fungerar inte'
    : phase === 'done'
      ? accept ? 'Tack – du är anmäld' : 'Tack för ditt besked'
      : accept ? 'Tacka ja till intervjun' : 'Tacka nej till intervjun';

  return (
    <main className="min-h-screen bg-parium-gradient flex items-center justify-center px-4 py-8 text-primary-foreground">
      <Helmet>
        <title>Svara på intervjuinbjudan – Parium</title>
        <meta name="description" content="Bekräfta om intervjutiden passar. Arbetsgivaren får ditt svar direkt." />
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>

      <section className="w-full max-w-md rounded-lg border border-white/15 bg-white/[0.07] p-6 shadow-2xl backdrop-blur-md sm:p-8">
        <div className="mb-8 flex items-center justify-center gap-2">
          <Mail className="h-5 w-5 shrink-0 text-secondary" />
          <span className="font-semibold leading-none text-white">Parium</span>
        </div>

        <div className="mb-3 flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-secondary/30 bg-secondary/10">
            <CalendarCheck className="h-[18px] w-[18px] text-secondary" />
          </span>
          <h1 className="text-2xl font-semibold text-white">{heading}</h1>
        </div>

        <p className="mb-7 text-sm leading-6 text-white sm:text-base">
          {!validLink
            ? 'Länken är ofullständig eller felaktig. Logga in i Parium för att svara på intervjun.'
            : phase === 'confirm' || phase === 'sending'
              ? 'Bekräfta ditt svar så meddelas arbetsgivaren direkt.'
              : message}
        </p>

        {validLink && (phase === 'confirm' || phase === 'sending' || phase === 'error') && (
          <Button
            type="button"
            variant="secondary"
            className="w-full rounded-full text-white [&_svg]:text-white"
            onClick={submit}
            disabled={phase === 'sending'}
          >
            {phase === 'sending'
              ? 'Skickar svar…'
              : phase === 'error'
                ? 'Försök igen'
                : accept
                  ? 'Ja, jag kommer'
                  : 'Nej, jag kan inte'}
          </Button>
        )}

        <Link to="/" className="mt-5 block text-center text-sm text-white underline-offset-4 hover:underline">
          Till startsidan
        </Link>
      </section>
    </main>
  );
};

export default InterviewResponse;
