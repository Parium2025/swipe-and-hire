import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import LandingNav from '@/components/LandingNav';
import SiteFooter from '@/components/landing/SiteFooter';
import { syncBrowserChrome } from '@/lib/browserChrome';

const AboutPage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    syncBrowserChrome('/om-oss');

    const title = 'Om Parium – Jobbappen som matchar människor och företag';
    document.title = title;

    const setMeta = (name: string, content: string, attr = 'name') => {
      let el = document.querySelector(`meta[${attr}="${name}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, name);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    const desc =
      'Parium är jobbappen som matchar rätt person med rätt jobb – snabbt, mänskligt och utan onödig friktion. Läs mer om oss, vår vision och hur vi jobbar.';
    setMeta('description', desc);
    setMeta('og:title', title, 'property');
    setMeta('og:description', desc, 'property');
    setMeta('og:type', 'website', 'property');
    setMeta('og:url', 'https://parium.se/om-oss', 'property');
    setMeta('twitter:title', title);
    setMeta('twitter:description', desc);
    setMeta('twitter:card', 'summary_large_image');
    setMeta('robots', 'index, follow, max-image-preview:large');

    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = 'https://parium.se/om-oss';
  }, []);

  const handleLogin = () => {
    sessionStorage.setItem('parium-skip-splash', '1');
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-primary text-white">
      <LandingNav onLoginClick={handleLogin} />

      <main className="mx-auto max-w-3xl px-6 pb-24 pt-28 sm:px-8 sm:pt-32">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-secondary">
          Om Parium
        </p>
        <h1 className="mt-3 text-4xl font-extrabold leading-[1.05] tracking-tight text-white sm:text-5xl">
          Vi bygger jobbappen som faktiskt matchar.
        </h1>
        <p className="mt-6 text-lg leading-8 text-white">
          Parium föddes ur en enkel insikt: jobbsökandet är trasigt. Kandidater försvinner i CV-högar, arbetsgivare drunknar i ansökningar som inte passar, och de bästa matchningarna sker av en slump. Det ville vi ändra på.
        </p>

        <section className="mt-14">
          <h2 className="text-2xl font-bold tracking-tight text-white">Vår vision</h2>
          <p className="mt-4 text-[17px] leading-8 text-white">
            Att varje person ska hitta ett jobb där de blommar – och varje företag ska hitta människor som faktiskt vill vara där. Inga floskler, inga gissningar. Bara rätt match.
          </p>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-bold tracking-tight text-white">Hur vi jobbar</h2>
          <ul className="mt-4 space-y-4 text-[17px] leading-8 text-white">
            <li>
              <span className="font-semibold text-white">Människan först.</span> Videoprofiler, riktiga röster och äkta personligheter – inte bara stela CV:n.
            </li>
            <li>
              <span className="font-semibold text-white">Snabbhet utan kompromiss.</span> Vi bygger som om Apple och Spotify hade gjort det. Pixel-perfekt, polerat och blixtsnabbt.
            </li>
            <li>
              <span className="font-semibold text-white">Kvalitet före kvantitet.</span> Vi lovar inte att besvara dig inom 24 timmar – vi lovar att leverera när vi gör det.
            </li>
          </ul>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-bold tracking-tight text-white">Bolaget</h2>
          <p className="mt-4 text-[17px] leading-8 text-white">
            Parium drivs av Parium AB, ett svenskt techbolag med säte i Sverige. Vi är ett litet, fokuserat team som bygger produkten, support, design och kod – tillsammans.
          </p>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-bold tracking-tight text-white">Kontakta oss</h2>
          <p className="mt-4 text-[17px] leading-8 text-white">
            Har du frågor, idéer eller vill jobba med oss?
          </p>
          <a
            href="mailto:hej@parium.se"
            className="mt-4 inline-flex min-h-touch items-center text-lg font-semibold text-secondary underline-offset-4 hover:underline"
          >
            hej@parium.se
          </a>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
};

export default AboutPage;
