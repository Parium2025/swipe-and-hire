/**
 * Vardagsnamn → canonical yrke.
 *
 * Mål: när användaren söker "ambulansförare", "städa", "pizzabagare",
 * "lokalvårdare", "truckförare" osv. ska sökmotorn hitta rätt yrkes-
 * sida — även om SCB-namnet är något annat ("Ambulanssjukvårdare",
 * "Städare", "Bagare", "Truck- och lagerförare").
 *
 * VIKTIGT:
 *   - Aliaserna skapar INGA nya URL:er. De är ett rent söklager.
 *   - Värdet (canonical) MÅSTE matcha exakt ett yrkesnamn i antingen
 *     `OCCUPATIONS` (handskrivna SEO-sidor) eller `OCCUPATION_CATEGORIES`
 *     (auto-genererade sidor), annars gör aliaset ingen nytta.
 *   - Inga duplicerade sidor → ingen Google-cannibalisering.
 *
 * Lägg gärna till fler löpande — varje rad är en konvertering till.
 */

export interface OccupationAlias {
  /** Vad användaren skriver (gemener, ingen normalisering — vi normaliserar i sökmotorn). */
  alias: string;
  /** Canonical yrkesnamn som finns i OCCUPATIONS eller OCCUPATION_CATEGORIES. */
  canonical: string;
}

export const OCCUPATION_ALIASES: OccupationAlias[] = [
  // ─── Vård ───────────────────────────────────────────────
  { alias: 'ambulansförare', canonical: 'Ambulanssjukvårdare' },
  { alias: 'ambulanspersonal', canonical: 'Ambulanssjukvårdare' },
  { alias: 'sjukvårdare', canonical: 'Ambulanssjukvårdare' },
  { alias: 'undersköterska', canonical: 'Undersköterska' },
  { alias: 'usk', canonical: 'Undersköterska' },
  { alias: 'sjuksköterska', canonical: 'Sjuksköterska' },
  { alias: 'ssk', canonical: 'Sjuksköterska' },
  { alias: 'vårdbiträde', canonical: 'Vårdbiträde' },
  { alias: 'hemtjänst', canonical: 'Vårdbiträde' },
  { alias: 'tandsköterska', canonical: 'Tandsköterska' },
  { alias: 'barnmorska', canonical: 'Barnmorska' },
  { alias: 'fysioterapeut', canonical: 'Fysioterapeut och sjukgymnast' },
  { alias: 'sjukgymnast', canonical: 'Fysioterapeut och sjukgymnast' },

  // ─── Transport ───────────────────────────────────────────
  { alias: 'lastbilschaufför', canonical: 'Lastbilsförare' },
  { alias: 'lastbilsförare', canonical: 'Lastbilsförare' },
  { alias: 'truckförare', canonical: 'Truckförare' },
  { alias: 'truckchaufför', canonical: 'Truckförare' },
  { alias: 'taxichaufför', canonical: 'Taxiförare' },
  { alias: 'taxiförare', canonical: 'Taxiförare' },
  { alias: 'busschaufför', canonical: 'Buss- och spårvagnsförare' },
  { alias: 'bussförare', canonical: 'Buss- och spårvagnsförare' },
  { alias: 'budbil', canonical: 'Budbilsförare' },
  { alias: 'kurir', canonical: 'Budbilsförare' },
  { alias: 'pilot', canonical: 'Pilot' },
  { alias: 'flygkapten', canonical: 'Pilot' },

  // ─── Restaurang / kök ────────────────────────────────────
  { alias: 'kock', canonical: 'Kock' },
  { alias: 'kallskänka', canonical: 'Kock och kallskänka' },
  { alias: 'pizzabagare', canonical: 'Pizzabagare' },
  { alias: 'pizzakock', canonical: 'Pizzabagare' },
  { alias: 'bagare', canonical: 'Bagare och konditorer' },
  { alias: 'konditor', canonical: 'Bagare och konditorer' },
  { alias: 'servitör', canonical: 'Servitör' },
  { alias: 'servitris', canonical: 'Servitör' },
  { alias: 'bartender', canonical: 'Bartender' },
  { alias: 'diskare', canonical: 'Kock' },

  // ─── Butik / försäljning ────────────────────────────────
  { alias: 'butiksbiträde', canonical: 'Butikssäljare' },
  { alias: 'butikssäljare', canonical: 'Butikssäljare' },
  { alias: 'butikspersonal', canonical: 'Butikssäljare' },
  { alias: 'kassörska', canonical: 'Kassapersonal' },
  { alias: 'kassör', canonical: 'Kassapersonal' },
  { alias: 'bilförsäljare', canonical: 'Bilförsäljare' },
  { alias: 'biluthyrare', canonical: 'Bilförsäljare' },
  { alias: 'fastighetsmäklare', canonical: 'Fastighetsmäklare' },
  { alias: 'mäklare', canonical: 'Fastighetsmäklare' },
  { alias: 'telefonförsäljare', canonical: 'Telefonförsäljare' },
  { alias: 'säljare', canonical: 'Företagssäljare' },

  // ─── Städ / fastighet ───────────────────────────────────
  { alias: 'städare', canonical: 'Städare' },
  { alias: 'städa', canonical: 'Städare' },
  { alias: 'lokalvårdare', canonical: 'Städare' },
  { alias: 'städerska', canonical: 'Städare' },
  { alias: 'fastighetsskötare', canonical: 'Fastighetsskötare' },
  { alias: 'vaktmästare', canonical: 'Fastighetsskötare' },

  // ─── Bygg / hantverk ────────────────────────────────────
  { alias: 'snickare', canonical: 'Snickare' },
  { alias: 'träarbetare', canonical: 'Snickare' },
  { alias: 'elektriker', canonical: 'Elektriker' },
  { alias: 'elinstallatör', canonical: 'Elektriker' },
  { alias: 'målare', canonical: 'Målare' },
  { alias: 'rörmokare', canonical: 'Rörmokare' },
  { alias: 'vvs', canonical: 'Rörmokare' },
  { alias: 'vvs-montör', canonical: 'Rörmokare' },
  { alias: 'plattsättare', canonical: 'Plattsättare' },
  { alias: 'svetsare', canonical: 'Svetsare' },
  { alias: 'murare', canonical: 'Murare' },
  { alias: 'takläggare', canonical: 'Takmontör' },
  { alias: 'golvläggare', canonical: 'Golvläggare' },

  // ─── Industri / fordon ──────────────────────────────────
  { alias: 'bilmekaniker', canonical: 'Bilmekaniker' },
  { alias: 'mekaniker', canonical: 'Bilmekaniker' },
  { alias: 'fordonsmekaniker', canonical: 'Motorfordonsmekaniker och fordonsreparatör' },
  { alias: 'verkstadsmekaniker', canonical: 'Motorfordonsmekaniker och fordonsreparatör' },
  { alias: 'flygmekaniker', canonical: 'Flygmekaniker' },
  { alias: 'maskinförare', canonical: 'Anläggningsmaskinförare' },
  { alias: 'grävmaskinist', canonical: 'Anläggningsmaskinförare' },

  // ─── IT ──────────────────────────────────────────────────
  { alias: 'programmerare', canonical: 'Mjukvaru- och systemutvecklare' },
  { alias: 'utvecklare', canonical: 'Mjukvaru- och systemutvecklare' },
  { alias: 'webbutvecklare', canonical: 'Mjukvaru- och systemutvecklare' },
  { alias: 'frontendutvecklare', canonical: 'Mjukvaru- och systemutvecklare' },
  { alias: 'backendutvecklare', canonical: 'Mjukvaru- och systemutvecklare' },
  { alias: 'systemutvecklare', canonical: 'Mjukvaru- och systemutvecklare' },
  { alias: 'it-tekniker', canonical: 'IT-tekniker' },
  { alias: 'support', canonical: 'IT-tekniker' },

  // ─── Kontor / admin ─────────────────────────────────────
  { alias: 'sekreterare', canonical: 'Administratör' },
  { alias: 'administratör', canonical: 'Administratör' },
  { alias: 'kontorist', canonical: 'Administratör' },
  { alias: 'receptionist', canonical: 'Receptionist' },
  { alias: 'reception', canonical: 'Receptionist' },
  { alias: 'personlig assistent', canonical: 'Personlig assistent' },
  { alias: 'pa', canonical: 'Personlig assistent' },

  // ─── Lager / logistik ──────────────────────────────────
  { alias: 'lagerarbetare', canonical: 'Lagerarbetare' },
  { alias: 'plockare', canonical: 'Lagerarbetare' },
  { alias: 'paketerare', canonical: 'Lagerarbetare' },

  // ─── Säkerhet ───────────────────────────────────────────
  { alias: 'väktare', canonical: 'Väktare och ordningsvakter' },
  { alias: 'ordningsvakt', canonical: 'Väktare och ordningsvakter' },
  { alias: 'dörrvakt', canonical: 'Väktare och ordningsvakter' },
  { alias: 'polis', canonical: 'Polis' },
  { alias: 'brandman', canonical: 'Brandmän' },

  // ─── Pedagogik ──────────────────────────────────────────
  { alias: 'lärare', canonical: 'Grundskollärare' },
  { alias: 'gymnasielärare', canonical: 'Gymnasielärare' },
  { alias: 'förskollärare', canonical: 'Förskollärare' },
  { alias: 'barnskötare', canonical: 'Barnskötare' },
  { alias: 'dagispersonal', canonical: 'Barnskötare' },
  { alias: 'fritidspedagog', canonical: 'Fritidspedagog' },

  // ─── Skönhet ────────────────────────────────────────────
  { alias: 'frisör', canonical: 'Frisör' },
  { alias: 'hårklippare', canonical: 'Frisör' },
  { alias: 'barberare', canonical: 'Frisör' },
  { alias: 'massör', canonical: 'Massör och massageterapeut' },
  { alias: 'naglar', canonical: 'Hudterapeut' },

  // ─── Militär ────────────────────────────────────────────
  { alias: 'soldat', canonical: 'Soldat' },
  { alias: 'officer', canonical: 'Officer' },

  // ─── Övrigt vanliga ────────────────────────────────────
  { alias: 'florist', canonical: 'Florist' },
  { alias: 'blomster', canonical: 'Florist' },
  { alias: 'jordbrukare', canonical: 'Jordbrukare' },
  { alias: 'bonde', canonical: 'Jordbrukare' },
  { alias: 'djurskötare', canonical: 'Djurskötare' },
];

/**
 * Indexerat alias-lookup. Returnerar canonical yrke om aliaset matchar
 * (exakt eller prefix). Används i sökmotorn för att expandera frågan.
 */
const normalize = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/å/g, 'a')
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o');

const ALIAS_INDEX: Map<string, string> = (() => {
  const map = new Map<string, string>();
  for (const { alias, canonical } of OCCUPATION_ALIASES) {
    map.set(normalize(alias), canonical);
  }
  return map;
})();

/** Returnerar canonical yrke för ett exakt alias, eller null. */
export const lookupOccupationAlias = (query: string): string | null => {
  const norm = normalize(query.trim());
  if (!norm) return null;
  return ALIAS_INDEX.get(norm) ?? null;
};

/** Returnerar alla canonical-yrken vars alias innehåller (prefix/substring) query. */
export const findOccupationAliases = (query: string): string[] => {
  const norm = normalize(query.trim());
  if (norm.length < 2) return [];
  const out = new Set<string>();
  for (const [alias, canonical] of ALIAS_INDEX) {
    if (alias.includes(norm) || norm.includes(alias)) {
      out.add(canonical);
    }
  }
  return Array.from(out);
};
