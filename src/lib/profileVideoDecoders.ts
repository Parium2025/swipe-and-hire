/**
 * Decoder-budget för profilvideor (kandidatavatarer, kanban, listor).
 *
 * Landningssidan har sedan tidigare skydd mot dekoder-svält via
 * `videoPlatform`, men kandidatvyerna monterar potentiellt dussintals
 * <video>-element. Varje spelande video tar en hårdvarudekoder ur GPU:ns pool
 * — särskilt liten på Windows med extern skärm och på Android. Blir poolen
 * tom slutar nya videor att spela (svart/fryst ram) utan felmeddelande.
 *
 * Den här modulen håller ett globalt register över spelande profilvideor och
 * pausar den äldsta när taket nås (LRU), så att den video användaren precis
 * tryckte på alltid får en dekoder.
 */

import { getMaxConcurrentVideos, shouldFreeDecodersOnLeave } from '@/lib/videoPlatform';

type StopFn = () => void;

/** Insättningsordningen i en Map är stabil → första posten är äldst. */
const playing = new Map<symbol, StopFn>();

/** Profilvideor är sekundära; lämna alltid budget kvar åt övrigt innehåll. */
const profileVideoBudget = () => Math.max(1, Math.min(4, getMaxConcurrentVideos() - 2));

/**
 * Registrera att en profilvideo börjat spela. Pausar äldsta videor tills
 * budgeten håller. Returnerar en avregistreringsfunktion.
 */
export const acquireProfileVideoDecoder = (token: symbol, stop: StopFn): void => {
  playing.delete(token);
  playing.set(token, stop);

  const budget = profileVideoBudget();
  while (playing.size > budget) {
    const oldest = playing.keys().next();
    if (oldest.done) break;
    const stopOldest = playing.get(oldest.value);
    playing.delete(oldest.value);
    try {
      stopOldest?.();
    } catch {
      // ignorera – videon kan redan vara avmonterad
    }
  }
};

/** Avregistrera en profilvideo (pausad, avslutad eller avmonterad). */
export const releaseProfileVideoDecoder = (token: symbol): void => {
  playing.delete(token);
};

/**
 * Ska dekodern frigöras helt när videon stoppas?
 *
 * På Windows/Android/sparläge räcker det inte att pausa – elementet håller
 * kvar dekodern. `load()` släpper den och kostar bara en snabb återinitiering
 * nästa gång användaren trycker play.
 */
export const shouldReleaseDecoderOnStop = (): boolean => shouldFreeDecodersOnLeave();
