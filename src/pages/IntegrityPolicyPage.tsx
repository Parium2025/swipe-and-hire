import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import SiteFooter from '@/components/landing/SiteFooter';
import { openCookieSettings } from '@/components/CookieBanner';
import pariumLogo from '/lovable-uploads/79c2f9ec-4fa4-43c9-9177-5f0ce8b19f57.png';

const CANONICAL = 'https://www.parium.se/integritetspolicy';
const TITLE = 'Integritetspolicy – Parium';
const DESCRIPTION =
  'Så hanterar Parium dina personuppgifter enligt GDPR. Läs om vilka uppgifter vi samlar in, varför, hur länge de lagras och vilka rättigheter du har.';
const LAST_UPDATED = '4 juli 2026';

const EASE = [0.16, 1, 0.3, 1] as const;

type Section = {
  id: string;
  title: string;
};

const sections: Section[] = [
  { id: 'ansvarig', title: '1. Personuppgiftsansvarig' },
  { id: 'uppgifter', title: '2. Vilka personuppgifter vi behandlar' },
  { id: 'andamal', title: '3. Ändamål och rättslig grund' },
  { id: 'delning', title: '4. Delning av uppgifter' },
  { id: 'lagring', title: '5. Lagringstid' },
  { id: 'sakerhet', title: '6. Säkerhet' },
  { id: 'cookies', title: '7. Cookies och liknande tekniker' },
  { id: 'rattigheter', title: '8. Dina rättigheter enligt GDPR' },
  { id: 'andringar', title: '9. Ändringar av policyn' },
  { id: 'kontakt', title: '10. Kontakt' },
];

export default function IntegrityPolicyPage() {
  const navigate = useNavigate();
  useEffect(() => {
    const root = document.querySelector<HTMLElement>('[data-policy-scroll-root]');
    if (root) root.scrollTop = 0;
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, []);

  const handleClose = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  const scrollPolicySection = (id: string) => {
    const root = document.querySelector<HTMLElement>('[data-policy-scroll-root]');
    const target = document.getElementById(id);
    if (!target) return;

    if (root) {
      const top = root.scrollTop + target.getBoundingClientRect().top - 144;
      root.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    } else {
      const top = window.scrollY + target.getBoundingClientRect().top - 144;
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    }

    window.history.replaceState(null, '', `#${id}`);
  };

  return (
    <>
      <Helmet>
        <title>{TITLE}</title>
        <meta name="description" content={DESCRIPTION} />
        <link rel="canonical" href={CANONICAL} />
        <meta property="og:title" content={TITLE} />
        <meta property="og:description" content={DESCRIPTION} />
        <meta property="og:type" content="article" />
        <meta name="twitter:card" content="summary" />
      </Helmet>

      <div
        data-policy-scroll-root
        className="fixed inset-0 z-0 overflow-y-auto overflow-x-hidden bg-primary text-white"
        style={{
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain',
          scrollPaddingTop: 'calc(env(safe-area-inset-top, 0px) + 9.5rem)',
        }}
      >
        <header
          className="fixed inset-x-0 top-0 z-40"
          style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 18px)' }}
        >
          <div className="mx-auto flex max-w-[1400px] items-center justify-between px-4 sm:px-6 md:px-10">
            <button
              type="button"
              onClick={handleClose}
              aria-label="Tillbaka"
              className="flex items-center gap-2 rounded-full transition-opacity hover:opacity-80 active:opacity-70"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <img
                src={pariumLogo}
                alt="Parium"
                width={256}
                height={256}
                draggable={false}
                className="h-auto w-32 sm:w-36 md:w-40 pointer-events-none"
              />
            </button>
            <button
              type="button"
              onClick={handleClose}
              aria-label="Stäng och gå tillbaka"
              className="group relative inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.06] text-white backdrop-blur-xl transition hover:bg-white/[0.12] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              <X className="h-5 w-5" strokeWidth={2.2} />
            </button>
          </div>
        </header>

        <div className="mx-auto w-full max-w-[880px] px-5 pb-28 pt-36 sm:px-8 sm:pt-40 md:px-12">
          <motion.header
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: EASE }}
          >
            <span className="text-xs font-bold uppercase tracking-[0.32em] text-secondary/85">
              Juridiskt
            </span>
            <h1 className="mt-4 text-4xl font-black leading-tight tracking-tight text-white sm:text-5xl">
              Integritetspolicy
            </h1>
            <p className="mt-4 text-[15px] text-white">
              Senast uppdaterad: {LAST_UPDATED}
            </p>
            <p className="mt-6 max-w-[680px] text-[16px] leading-7 text-white sm:text-[17px]">
              Din integritet är viktig för oss. I den här policyn förklarar Parium AB
              vilka personuppgifter vi behandlar om dig, varför vi gör det, hur länge
              uppgifterna sparas och vilka rättigheter du har enligt
              dataskyddsförordningen (GDPR).
            </p>
          </motion.header>

          {/* Innehållsförteckning */}
          <nav
            aria-label="Innehåll"
            className="mt-10 rounded-2xl bg-white/[0.04] p-5 backdrop-blur-xl sm:p-6"
          >
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-secondary/85">
              Innehåll
            </p>
            <ol className="mt-3 grid gap-1.5 sm:grid-cols-2">
              {sections.map((s) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      scrollPolicySection(s.id);
                    }}
                    className="text-[14px] text-white underline-offset-4 transition hover:text-secondary hover:underline"
                  >
                    {s.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="mt-12 space-y-12">
            <Section id="ansvarig" title="1. Personuppgiftsansvarig">
              <p>
                Personuppgiftsansvarig för behandlingen av dina personuppgifter är:
              </p>
              <p className="mt-3 rounded-xl bg-white/[0.05] p-4 text-[14.5px]">
                <strong>Parium AB</strong>
                <br />
                E-post:{' '}
                <a
                  href="mailto:hej@parium.se"
                  className="text-secondary underline underline-offset-2"
                >
                  hej@parium.se
                </a>
              </p>
            </Section>

            <Section id="uppgifter" title="2. Vilka personuppgifter vi behandlar">
              <p>
                Vi behandlar endast de uppgifter som behövs för att tjänsten ska
                fungera och för att du ska få så mycket värde som möjligt av Parium.
                Beroende på hur du använder tjänsten kan följande uppgifter samlas in:
              </p>
              <ul className="mt-4 space-y-2 pl-5 [list-style:disc] marker:text-secondary/70">
                <li>
                  <strong>Kontouppgifter:</strong> namn, e-postadress, telefonnummer,
                  lösenord (krypterat) och roll (jobbsökare eller arbetsgivare).
                </li>
                <li>
                  <strong>Profiluppgifter (jobbsökare):</strong> CV, presentationsvideo,
                  arbetslivserfarenhet, utbildning, önskad ort, önskad lön och
                  tillgänglighet.
                </li>
                <li>
                  <strong>Företagsuppgifter (arbetsgivare):</strong> företagsnamn,
                  organisationsnummer, logotyp, kontaktperson och jobbannonser.
                </li>
                <li>
                  <strong>Kommunikation:</strong> meddelanden mellan dig och
                  arbetsgivare/kandidater samt supportärenden.
                </li>
                <li>
                  <strong>Betaluppgifter:</strong> vid uppgradering till Premium
                  hanteras kortuppgifter av vår betalleverantör (Stripe). Vi lagrar
                  aldrig fullständiga kortnummer.
                </li>
                <li>
                  <strong>Teknisk data:</strong> IP-adress, enhetstyp, webbläsare och
                  hur du använder tjänsten (klick, sökningar, sessionslängd).
                </li>
              </ul>
            </Section>

            <Section id="andamal" title="3. Ändamål och rättslig grund">
              <p>
                Vi behandlar dina uppgifter för följande ändamål och med följande
                rättsliga grunder:
              </p>
              <div className="mt-4 overflow-hidden rounded-2xl">
                <table className="w-full text-left text-[14px]">
                  <thead className="bg-white/[0.08] text-[12px] uppercase tracking-wider text-white">
                    <tr>
                      <th className="px-4 py-3">Ändamål</th>
                      <th className="px-4 py-3">Rättslig grund</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    <Row
                      what="Tillhandahålla tjänsten och ditt konto"
                      basis="Avtal"
                    />
                    <Row
                      what="Koppla samman kandidater och arbetsgivare"
                      basis="Avtal"
                    />
                    <Row
                      what="Hantera betalningar och fakturering"
                      basis="Avtal och rättslig förpliktelse"
                    />
                    <Row
                      what="Svara på supportfrågor"
                      basis="Berättigat intresse"
                    />
                    <Row
                      what="Förbättra och utveckla tjänsten"
                      basis="Berättigat intresse"
                    />
                    <Row
                      what="Skicka nyhetsbrev och marknadsföring"
                      basis="Samtycke"
                    />
                    <Row
                      what="Statistik och analys via cookies"
                      basis="Samtycke"
                    />
                  </tbody>
                </table>
              </div>
            </Section>

            <Section id="delning" title="4. Delning av uppgifter">
              <p>
                Vi säljer aldrig dina uppgifter. Vi delar dem endast med de aktörer
                som är nödvändiga för att tjänsten ska fungera:
              </p>
              <ul className="mt-4 space-y-2 pl-5 [list-style:disc] marker:text-secondary/70">
                <li>
                  <strong>Andra användare av Parium:</strong> som jobbsökare delas din
                  profil endast med arbetsgivare du själv aktivt visat intresse för.
                  Som arbetsgivare syns dina annonser publikt.
                </li>
                <li>
                  <strong>Underleverantörer (personuppgiftsbiträden):</strong> Supabase
                  (databas och autentisering, EU), Lovable Cloud (e-postutskick via
                  notify.parium.se), Stripe (betalningar).
                </li>
                <li>
                  <strong>Myndigheter:</strong> om vi enligt lag är skyldiga att lämna
                  ut uppgifter.
                </li>
              </ul>
              <p className="mt-4">
                All behandling sker inom EU/EES. Om en underleverantör tillfälligt
                behöver överföra data utanför EU sker det med lämpliga skyddsåtgärder
                enligt GDPR (t.ex. EU:s standardavtalsklausuler).
              </p>
            </Section>

            <Section id="lagring" title="5. Lagringstid">
              <p>
                Vi sparar dina uppgifter endast så länge det behövs för det ändamål de
                samlades in för:
              </p>
              <ul className="mt-4 space-y-2 pl-5 [list-style:disc] marker:text-secondary/70">
                <li>
                  <strong>Aktivt konto:</strong> så länge du använder tjänsten.
                </li>
                <li>
                  <strong>Inaktivt konto:</strong> efter 24 månader utan
                  inloggning mejlar vi dig en varning. Loggar du inte in inom 30
                  dagar raderas kontot och all din data permanent.
                </li>
                <li>
                  <strong>Jobbansökningar och tillhörande chattar:</strong> raderas
                  automatiskt 24 månader efter att ansökan skickades.
                </li>
                <li>
                  <strong>Notiser:</strong> 6 månader.{' '}
                  <strong>Visningsstatistik</strong> (vem som sett en annons eller
                  profil): 12 månader.
                </li>

                <li>
                  <strong>Bokföringsunderlag (fakturor):</strong> 7 år enligt
                  bokföringslagen.
                </li>
                <li>
                  <strong>Supportärenden:</strong> upp till 24 månader efter att
                  ärendet avslutats.
                </li>
              </ul>
            </Section>

            <Section id="sakerhet" title="6. Säkerhet">
              <p>
                Vi arbetar systematiskt med informationssäkerhet. All data lagras
                krypterat, både i vila och under överföring (TLS/HTTPS). Åtkomst till
                personuppgifter är begränsad till behörig personal och skyddas med
                stark autentisering. Vi använder europeiska leverantörer med hög
                säkerhetsstandard.
              </p>
              <p className="mt-4">
                Om det trots våra åtgärder skulle ske en personuppgiftsincident
                kommer vi att anmäla det till Integritetsskyddsmyndigheten inom 72
                timmar och, om incidenten innebär hög risk för dig, informera dig
                direkt.
              </p>
            </Section>

            <Section id="cookies" title="7. Cookies och liknande tekniker">
              <p>
                Parium använder cookies för att sidan ska fungera, komma ihåg dina
                val och (med ditt samtycke) för statistik och marknadsföring. Vi
                delar in cookies i fyra kategorier:
              </p>
              <div className="mt-4 space-y-3">
                <CookieCat
                  title="Nödvändiga"
                  desc="Krävs för att sidan ska fungera — inloggning, sessioner och säkerhet. Kan inte stängas av."
                />
                <CookieCat
                  title="Preferenser"
                  desc="Kommer ihåg dina val, t.ex. språk och sparade filter."
                />
                <CookieCat
                  title="Statistik & analys"
                  desc="Anonymiserad data om hur sidan används. Ingen enskild person kan identifieras."
                />
                <CookieCat
                  title="Marknadsföring"
                  desc="Låter oss visa mer relevanta annonser och mäta våra kampanjer."
                />
              </div>
              <p className="mt-5">
                Du kan när som helst ändra dina cookie-val:
              </p>
              <button
                type="button"
                onClick={openCookieSettings}
                className="mt-3 inline-flex min-h-[44px] items-center rounded-xl border border-secondary/40 bg-secondary/15 px-5 text-sm font-bold text-secondary transition hover:bg-secondary/25"
              >
                Öppna cookie-inställningar
              </button>
            </Section>

            <Section id="rattigheter" title="8. Dina rättigheter enligt GDPR">
              <p>Enligt dataskyddsförordningen har du rätt att:</p>
              <ul className="mt-4 space-y-2 pl-5 [list-style:disc] marker:text-secondary/70">
                <li>
                  <strong>Få tillgång</strong> till de uppgifter vi har om dig
                  (registerutdrag).
                </li>
                <li>
                  <strong>Rätta</strong> felaktiga eller ofullständiga uppgifter.
                </li>
                <li>
                  <strong>Radera</strong> dina uppgifter (”rätten att bli glömd”).
                </li>
                <li>
                  <strong>Begränsa</strong> vår behandling av dina uppgifter.
                </li>
                <li>
                  <strong>Invända</strong> mot behandling som sker med stöd av
                  berättigat intresse.
                </li>
                <li>
                  <strong>Dataportabilitet</strong> — få ut dina uppgifter i ett
                  strukturerat, maskinläsbart format.
                </li>
                <li>
                  <strong>Återkalla samtycke</strong> när som helst — det påverkar
                  inte lagligheten av behandling som skett innan återkallelsen.
                </li>
              </ul>
              <p className="mt-4">
                Kontakta oss på{' '}
                <a
                  href="mailto:hej@parium.se"
                  className="text-secondary underline underline-offset-2"
                >
                  hej@parium.se
                </a>{' '}
                för att utöva någon av dessa rättigheter. Du har också rätt att lämna
                klagomål till Integritetsskyddsmyndigheten (
                <a
                  href="https://www.imy.se"
                  target="_blank"
                  rel="noreferrer"
                  className="text-secondary underline underline-offset-2"
                >
                  imy.se
                </a>
                ) om du anser att vi behandlar dina uppgifter felaktigt.
              </p>
            </Section>

            <Section id="andringar" title="9. Ändringar av policyn">
              <p>
                Vi kan komma att uppdatera den här policyn för att spegla ändringar
                i tjänsten eller lagstiftning. Vid större ändringar informerar vi
                dig via e-post eller genom en tydlig notis i appen. Datumet högst
                upp visar när policyn senast uppdaterades.
              </p>
            </Section>

            <Section id="kontakt" title="10. Kontakt">
              <p>
                Har du frågor om denna policy eller om hur vi behandlar dina
                uppgifter? Hör av dig, så svarar vi inom 24 timmar på vardagar.
              </p>
              <p className="mt-4 rounded-xl bg-white/[0.05] p-4 text-[14.5px]">
                <strong>Parium AB</strong>
                <br />
                E-post:{' '}
                <a
                  href="mailto:hej@parium.se"
                  className="text-secondary underline underline-offset-2"
                >
                  hej@parium.se
                </a>
              </p>
            </Section>
          </div>
        </div>

        <SiteFooter />
      </div>
    </>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      id={id}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.7, ease: EASE }}
      className="scroll-mt-36 sm:scroll-mt-40"
    >
      <h2 className="text-2xl font-bold tracking-tight text-white sm:text-[26px]">
        {title}
      </h2>
      <div className="mt-4 space-y-3 text-[15.5px] leading-7 text-white sm:text-[16px]">
        {children}
      </div>
    </motion.section>
  );
}

function Row({ what, basis }: { what: string; basis: string }) {
  return (
    <tr className="text-white">
      <td className="px-4 py-3 align-top">{what}</td>
      <td className="px-4 py-3 align-top text-white">{basis}</td>
    </tr>
  );
}

function CookieCat({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-xl bg-white/[0.05] p-4">
      <p className="text-sm font-bold text-white">{title}</p>
      <p className="mt-1 text-[13.5px] leading-6 text-white">{desc}</p>
    </div>
  );
}
