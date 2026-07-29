import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import SiteFooter from '@/components/landing/SiteFooter';
import pariumLogo from '/lovable-uploads/79c2f9ec-4fa4-43c9-9177-5f0ce8b19f57.png';

const CANONICAL = 'https://www.parium.se/dpa';
const TITLE = 'Personuppgiftsbiträdesavtal (DPA) – Parium';
const DESCRIPTION =
  'Pariums personuppgiftsbiträdesavtal enligt GDPR art. 28 för arbetsgivarkunder: behandling, säkerhet, underbiträden, gallringsrutin och radering av kandidatdata.';
const LAST_UPDATED = '29 juli 2026';

const EASE = [0.16, 1, 0.3, 1] as const;

const sections = [
  { id: 'parter', title: '1. Parter och omfattning' },
  { id: 'behandling', title: '2. Föremålet för behandlingen' },
  { id: 'instruktioner', title: '3. Instruktioner och roller' },
  { id: 'sakerhet', title: '4. Säkerhetsåtgärder' },
  { id: 'underbitraden', title: '5. Underbiträden' },
  { id: 'overforing', title: '6. Överföring till tredjeland' },
  { id: 'bistand', title: '7. Bistånd till er som kund' },
  { id: 'incident', title: '8. Personuppgiftsincidenter' },
  { id: 'gallring', title: '9. Gallringsrutin och lagringstider' },
  { id: 'avslut', title: '10. Radering vid avslutat avtal' },
  { id: 'granskning', title: '11. Granskning och revision' },
  { id: 'kontakt', title: '12. Ikraftträdande och kontakt' },
];

export default function DpaPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const root = document.querySelector<HTMLElement>('[data-policy-scroll-root]');
    if (root) root.scrollTop = 0;
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, []);

  const handleClose = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
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
                className="pointer-events-none h-auto w-32 sm:w-36 md:w-40"
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
              Juridiskt · Bilaga till användarvillkoren
            </span>
            <h1 className="mt-4 text-4xl font-black leading-tight tracking-tight text-white sm:text-5xl">
              Personuppgiftsbiträdesavtal
            </h1>
            <p className="mt-4 text-[15px] text-white">Senast uppdaterad: {LAST_UPDATED}</p>
            <p className="mt-6 max-w-[680px] text-[16px] leading-7 text-white sm:text-[17px]">
              Det här avtalet (DPA) reglerar hur Parium AB behandlar personuppgifter för
              er räkning när ni rekryterar via Parium. Avtalet ingår som bilaga till
              Pariums användarvillkor och accepteras automatiskt när ni registrerar ett
              arbetsgivarkonto – ni behöver alltså inte signera något separat dokument.
              Behöver ni ändå en undertecknad version hör ni av er till hej@parium.se.
            </p>
          </motion.header>

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
            <Section id="parter" title="1. Parter och omfattning">
              <p>
                Avtalet gäller mellan <strong>Parium AB</strong> ("Personuppgiftsbiträdet")
                och det företag eller den organisation som har ett arbetsgivarkonto i
                Parium ("Personuppgiftsansvarig", "ni").
              </p>
              <p>
                Ni bestämmer ändamålen med behandlingen av kandidaternas personuppgifter i
                er rekrytering. Parium behandlar uppgifterna för er räkning, enligt era
                instruktioner och enligt detta avtal, i enlighet med artikel 28 i
                dataskyddsförordningen (GDPR).
              </p>
              <p className="rounded-xl bg-white/[0.05] p-4 text-[14.5px]">
                För Pariums egen behandling av kandidaters uppgifter – kontot, profilen och
                själva plattformen – är Parium personuppgiftsansvarig. Den behandlingen
                beskrivs i vår integritetspolicy.
              </p>
            </Section>

            <Section id="behandling" title="2. Föremålet för behandlingen">
              <div className="overflow-hidden rounded-2xl">
                <table className="w-full text-left text-[14px]">
                  <tbody className="divide-y divide-white/[0.06]">
                    <Row k="Ändamål" v="Rekrytering: publicering av annonser, mottagande och bedömning av ansökningar, kommunikation med kandidater och intervjubokning." />
                    <Row k="Varaktighet" v="Så länge ni har ett aktivt arbetsgivarkonto, med de gallringstider som anges i punkt 9." />
                    <Row k="Typ av uppgifter" v="Namn, kontaktuppgifter, ålder, ort, CV, presentationsvideo, arbetslivserfarenhet, svar på era urvalsfrågor, meddelanden och interna noteringar." />
                    <Row k="Kategorier av registrerade" v="Kandidater som ansökt eller visat intresse för era annonser, samt era egna användare." />
                    <Row k="Känsliga uppgifter" v="Parium efterfrågar inte känsliga personuppgifter (art. 9). Ni får inte begära sådana uppgifter via urvalsfrågor eller fritextfält." />
                  </tbody>
                </table>
              </div>
            </Section>

            <Section id="instruktioner" title="3. Instruktioner och roller">
              <ul className="space-y-2 pl-5 [list-style:disc] marker:text-secondary/70">
                <li>
                  Parium behandlar personuppgifter endast enligt era dokumenterade
                  instruktioner. Er användning av tjänstens funktioner utgör era
                  instruktioner.
                </li>
                <li>
                  Parium använder inte era kandidatdata för egen marknadsföring, försäljning
                  eller för att träna AI-modeller åt tredje part.
                </li>
                <li>
                  AI-stödet (sammanfattning av CV och bedömning mot era kriterier) tar
                  fram ett rådgivande underlag. Ingen automatisk gallring eller
                  automatiserat beslut i den mening som avses i art. 22 sker — ni fattar
                  alltid besluten om kandidaterna.
                </li>

                <li>
                  Personal hos Parium som får åtkomst till uppgifterna omfattas av
                  sekretessåtagande och får bara åtkomst när det behövs för drift och
                  support.
                </li>
                <li>
                  Om Parium enligt lag måste behandla uppgifter på annat sätt informerar vi
                  er innan behandlingen sker, om inte lagen förbjuder det.
                </li>
              </ul>
            </Section>

            <Section id="sakerhet" title="4. Säkerhetsåtgärder">
              <p>
                Parium vidtar lämpliga tekniska och organisatoriska åtgärder enligt artikel
                32 GDPR, bland annat:
              </p>
              <ul className="space-y-2 pl-5 [list-style:disc] marker:text-secondary/70">
                <li>Kryptering av trafik (TLS) och kryptering av lagrad data.</li>
                <li>
                  Behörighetsstyrning på radnivå i databasen, så att varje organisation bara
                  kommer åt kandidater kopplade till sina egna annonser.
                </li>
                <li>Rollbaserad åtkomst inom ert konto och separata inloggningar per användare.</li>
                <li>Loggning av åtkomst och förändringar samt regelbundna säkerhetskopior.</li>
                <li>Automatisk gallring av gammal data enligt punkt 9.</li>
              </ul>
            </Section>

            <Section id="underbitraden" title="5. Underbiträden">
              <p>
                Ni godkänner att Parium anlitar följande underbiträden. Vi informerar er i
                förväg vid byte eller tillägg, och ni har rätt att invända.
              </p>
              <div className="mt-4 overflow-hidden rounded-2xl">
                <table className="w-full text-left text-[14px]">
                  <thead className="bg-white/[0.08] text-[12px] uppercase tracking-wider text-white">
                    <tr>
                      <th className="px-4 py-3">Underbiträde</th>
                      <th className="px-4 py-3">Ändamål</th>
                      <th className="px-4 py-3">Plats</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    <Sub name="Supabase (Lovable Cloud)" purpose="Databas, filer och autentisering" place="Paris, Frankrike (EU)" />
                    <Sub name="Resend (via Lovable)" purpose="Utskick av transaktionsmejl" place="EU/USA (SCC)" />
                    <Sub name="Lovable AI Gateway" purpose="AI-sammanfattning av CV och bedömning mot era kriterier" place="EU/USA (SCC)" />
                    <Sub name="Stripe" purpose="Betalningar och fakturering (aktiveras när betalfunktionen lanseras)" place="EU/USA (SCC)" />

                  </tbody>
                </table>
              </div>
            </Section>

            <Section id="overforing" title="6. Överföring till tredjeland">
              <p>
                All kandidatdata lagras inom EU. Om ett underbiträde behandlar uppgifter
                utanför EU/EES sker det med EU-kommissionens standardavtalsklausuler (SCC)
                som rättslig grund, tillsammans med kompletterande skyddsåtgärder.
              </p>
            </Section>

            <Section id="bistand" title="7. Bistånd till er som kund">
              <p>
                Parium hjälper er att uppfylla era skyldigheter mot kandidaterna. Om en
                kandidat begär registerutdrag, rättelse, radering eller invänder mot
                behandlingen, kontaktar ni oss på hej@parium.se så tar vi fram eller raderar
                uppgifterna kopplade till er organisation inom 14 dagar. Vi bistår även vid
                konsekvensbedömningar (DPIA) och kontakt med Integritetsskyddsmyndigheten.
              </p>
            </Section>

            <Section id="incident" title="8. Personuppgiftsincidenter">
              <p>
                Vid en personuppgiftsincident som rör era uppgifter informerar Parium er
                utan onödigt dröjsmål och senast inom 24 timmar från att vi upptäckt den.
                Vi beskriver vad som hänt, vilka uppgifter som berörts, sannolika
                konsekvenser och vilka åtgärder vi vidtagit, så att ni hinner anmäla till
                tillsynsmyndighet inom 72 timmar.
              </p>
            </Section>

            <Section id="gallring" title="9. Gallringsrutin och lagringstider">
              <p>
                Personuppgifter sparas inte längre än nödvändigt. Parium kör en automatisk
                gallring varje natt som raderar data enligt tabellen nedan – det sker utan
                att någon behöver göra något manuellt.
              </p>
              <div className="mt-4 overflow-hidden rounded-2xl">
                <table className="w-full text-left text-[14px]">
                  <thead className="bg-white/[0.08] text-[12px] uppercase tracking-wider text-white">
                    <tr>
                      <th className="px-4 py-3">Uppgift</th>
                      <th className="px-4 py-3">Lagringstid</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    <Row k="Ansökningar och kandidatdata kopplade till en annons" v="24 månader från ansökan, därefter automatisk radering (diskrimineringslagens preskriptionstid)." />
                    <Row k="Chattar kopplade till en ansökan" v="Raderas samtidigt som ansökan, 24 månader." />
                    <Row k="Aktivitets- och statusändringslogg för kandidater" v="24 månader." />
                    <Row k="Visningsstatistik för annonser och profiler" v="12 månader." />
                    <Row k="Notiser i appen" v="6 månader." />
                    <Row k="Kandidatens egen profil och konto" v="Så länge kontot används. Efter 24 månader utan inloggning skickas en varning via e-post, och 30 dagar senare raderas kontot och all tillhörande data automatiskt. Kandidaten kan även radera hela kontot direkt i appen." />
                    <Row k="Bokförings- och fakturaunderlag" v="7 år enligt bokföringslagen." />
                  </tbody>
                </table>
              </div>
              <p className="rounded-xl bg-white/[0.05] p-4 text-[14.5px]">
                Ni kan när som helst ta bort en enskild kandidat eller en annons tidigare än
                gallringstiden – då raderas uppgifterna direkt ur er vy och ur databasen.
              </p>
            </Section>

            <Section id="avslut" title="10. Radering vid avslutat avtal">
              <p>
                När ert konto avslutas raderar Parium alla personuppgifter som behandlas för
                er räkning inom 90 dagar, med undantag för uppgifter vi enligt lag måste
                spara (till exempel fakturaunderlag). Under de 90 dagarna kan ni begära en
                export av era kandidatdata via hej@parium.se.
              </p>
            </Section>

            <Section id="granskning" title="11. Granskning och revision">
              <p>
                Parium tillhandahåller på begäran den information ni behöver för att visa
                att skyldigheterna i artikel 28 GDPR uppfylls, och möjliggör granskning en
                gång per år eller vid misstanke om avvikelse. Granskning ska aviseras minst
                30 dagar i förväg och får inte störa driften för andra kunder.
              </p>
            </Section>

            <Section id="kontakt" title="12. Ikraftträdande och kontakt">
              <p>
                Avtalet gäller från det att ni registrerar ett arbetsgivarkonto och så länge
                Parium behandlar personuppgifter för er räkning. Vid ändringar informerar vi
                er via e-post och på den här sidan minst 30 dagar i förväg.
              </p>
              <p className="mt-4 rounded-xl bg-white/[0.05] p-4 text-[14.5px]">
                <strong>Parium AB</strong>
                <br />
                E-post:{' '}
                <a href="mailto:hej@parium.se" className="text-secondary underline underline-offset-2">
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

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <motion.section
      id={id}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.7, ease: EASE }}
      className="scroll-mt-36 sm:scroll-mt-40"
    >
      <h2 className="text-2xl font-bold tracking-tight text-white sm:text-[26px]">{title}</h2>
      <div className="mt-4 space-y-3 text-[15.5px] leading-7 text-white sm:text-[16px]">{children}</div>
    </motion.section>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <tr className="text-white">
      <td className="w-[38%] px-4 py-3 align-top font-semibold">{k}</td>
      <td className="px-4 py-3 align-top">{v}</td>
    </tr>
  );
}

function Sub({ name, purpose, place }: { name: string; purpose: string; place: string }) {
  return (
    <tr className="text-white">
      <td className="px-4 py-3 align-top font-semibold">{name}</td>
      <td className="px-4 py-3 align-top">{purpose}</td>
      <td className="px-4 py-3 align-top">{place}</td>
    </tr>
  );
}
