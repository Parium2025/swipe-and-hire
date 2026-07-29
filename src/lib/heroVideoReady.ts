/**
 * Hero-video readiness gate (kallstart-serialisering).
 *
 * Varför: vid en kallstart på /jobbsokare konkurrerar tre saker om samma
 * bandbredd och decode-budget under de första sekunderna — hero-telefonens
 * video, galleriets 8 videor och Spline-scenen. På en laptop med integrerad
 * GPU (t.ex. Intel i5 / Iris Xe) delar video-decode och shader-kompilering
 * samma budget som kompositorn använder för scroll, vilket gör att första
 * intrycket känns trögt. Vid andra besöket ligger allt i HTTP-cachen och
 * problemet försvinner — det är alltså rent en förstagångs-budget.
 *
 * Lösning: hero-videon (som är above the fold och därmed det användaren
 * faktiskt tittar på) får ostörd start. Galleriets warmup väntar tills hero
 * rapporterar `canplay`, och startar sedan precis som förut.
 *
 * VIKTIGT: detta ändrar bara *när* galleriets warmup startar — inte *vad*
 * den gör. Plattformsprofilerna (antal samtidiga strömmar, lätta källor,
 * LERP/pin-höjder för touch och Apple) rörs inte alls.
 */

let ready = false;
const waiters = new Set<() => void>();

/** Absolut tak: warmup får aldrig blockeras mer än så här länge. */
const MAX_WAIT_MS = 2000;

export const markHeroVideoReady = () => {
  if (ready) return;
  ready = true;
  waiters.forEach((cb) => {
    try {
      cb();
    } catch {
      // Best-effort only.
    }
  });
  waiters.clear();
};

export const isHeroVideoReady = () => ready;

/**
 * Kör `cb` när hero-videon är redo — eller senast efter MAX_WAIT_MS, så att
 * galleriet aldrig fastnar om hero saknas, failar eller blockeras av sparläge.
 * Returnerar en cleanup-funktion.
 */
export const whenHeroVideoReady = (cb: () => void): (() => void) => {
  if (ready || typeof window === 'undefined') {
    cb();
    return () => {};
  }

  let done = false;
  const run = () => {
    if (done) return;
    done = true;
    waiters.delete(run);
    window.clearTimeout(timer);
    cb();
  };

  const timer = window.setTimeout(run, MAX_WAIT_MS);
  waiters.add(run);

  return () => {
    done = true;
    waiters.delete(run);
    window.clearTimeout(timer);
  };
};
