import React, { useRef, useEffect, useLayoutEffect } from 'react';

// ---------------------------------------------------------------------------
// Scrollminne per KeepAlive-vy — modulnivå + sessionStorage
// ---------------------------------------------------------------------------
// Ligger utanför komponenten så positionen överlever remount av hela Index
// (t.ex. vid rollbyte, auth-refresh eller en snabb omladdning).
const KEEPALIVE_SCROLL_KEY = 'parium-keepalive-scroll';
const keepAliveScroll = new Map<string, number>();

try {
  const raw = sessionStorage.getItem(KEEPALIVE_SCROLL_KEY);
  if (raw) {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
          keepAliveScroll.set(key, value);
        }
      }
    }
  }
} catch { /* ignorera trasig/otillgänglig sessionStorage */ }

const persistKeepAliveScroll = () => {
  try {
    sessionStorage.setItem(
      KEEPALIVE_SCROLL_KEY,
      JSON.stringify(Object.fromEntries(keepAliveScroll)),
    );
  } catch { /* quota/privat läge — minnet i RAM räcker */ }
};

const setKeepAliveScroll = (key: string, top: number) => {
  if (!Number.isFinite(top) || top < 0) return;
  if (keepAliveScroll.get(key) === top) return;
  keepAliveScroll.set(key, top);
  // Detaljvyer (/job-details/:id) skapar en ny nyckel per annons — håll
  // minnet litet genom att alltid släppa de äldsta.
  while (keepAliveScroll.size > 50) {
    const oldest = keepAliveScroll.keys().next().value as string | undefined;
    if (oldest === undefined) break;
    keepAliveScroll.delete(oldest);
  }
  persistKeepAliveScroll();
};


const getKeepAliveScroll = (key: string) => keepAliveScroll.get(key) ?? 0;

interface KeepAliveProps {

  activeKey: string;
  render: (key: string) => React.ReactNode;
  /** Keys to keep alive across navigation. If not provided, only current key is rendered. */
  keepKeys?: string[];
  /** Optional enter delay to let surrounding UI transitions finish before content fades in. */
  enterDelayMs?: number;
}

/**
 * Persistent-mount container.
 *
 * When `keepKeys` is provided, every key listed there stays mounted in the DOM
 * for the lifetime of this component — only `display` is toggled. This means:
 *  - Zero remount cost when navigating between cached pages
 *  - All internal state (scroll position, filters, expanded cards) is preserved
 *  - Data fetching only happens once per session
 *
 * Critical fix vs old version: cached nodes are stored ONCE in a ref and reused
 * verbatim. Previously the active node was re-created on every render, which
 * defeated the whole purpose of caching.
 */
export function KeepAlive({ activeKey, render, keepKeys, enterDelayMs = 0 }: KeepAliveProps) {
  // No caching mode: just render the active view (legacy behaviour)
  if (!keepKeys || keepKeys.length === 0) {
    return (
      <div className="relative w-full h-full flex flex-col min-h-0">
        <div className="flex-1 min-h-0 flex flex-col">
          {render(activeKey)}
        </div>
      </div>
    );
  }

  return (
    <KeepAliveCached activeKey={activeKey} render={render} keepKeys={keepKeys} enterDelayMs={enterDelayMs} />
  );
}

function KeepAliveCached({
  activeKey,
  render,
  keepKeys,
  enterDelayMs,
}: Required<Pick<KeepAliveProps, 'activeKey' | 'render' | 'keepKeys' | 'enterDelayMs'>>) {
  // Persistent cache of mounted nodes — survives the entire session
  const cacheRef = useRef<Map<string, React.ReactNode>>(new Map());
  // Track which keys we've ever mounted (so we can render in stable order)
  const mountedKeysRef = useRef<string[]>([]);
  // Force a re-render when we mount a new key
  const [, setTick] = React.useState(0);
  const [displayedKey, setDisplayedKey] = React.useState(activeKey);
  const [isEntered, setIsEntered] = React.useState(true);
  const [isAnimating, setIsAnimating] = React.useState(false);
  const isFirstActivationRef = React.useRef(true);
  // Nycklar som monterats i den här renderingen och alltså aldrig visats förut.
  // Endast de ska tona in; redan besökta vyer byts synkront utan animation.
  const freshKeysRef = useRef<Set<string>>(new Set());

  // -------------------------------------------------------------------------
  // Scrollminne per vy
  // -------------------------------------------------------------------------
  // Sidorna ligger kvar i DOM:en men delar EN scroll-container. Utan minne
  // hamnar man därför alltid högst upp när man kommer tillbaka. Positionen
  // sparas per vy och läggs tillbaka i samma bildruta som vyn visas igen.
  //
  // Minnet ligger på modulnivå + sessionStorage. Skälet: en dold vy har
  // display:none och därmed noll layout — när den visas igen kan listan vara
  // lägre än den var (bilder/virtualisering hinner inte mäta) och webbläsaren
  // klipper scrollTop till max. Vi håller därför kvar målet tills höjden
  // faktiskt räcker till, och tappar aldrig värdet om komponenten remountas.
  const previousDisplayedKeyRef = useRef(activeKey);
  const settleRef = useRef<{ cancel: () => void } | null>(null);

  // Endast skal som uttryckligen lämnat över scrollen till KeepAlive
  // (arbetsgivarens shell) hanteras här. Jobbsökarsidan sköts som tidigare av
  // den globala ScrollRestoration — vi rör inte den.
  const getScrollContainer = () => {
    const container = document.querySelector<HTMLElement>('[data-main-scroll-container="true"]');
    if (!container || container.dataset.scrollManaged !== 'keepalive') return null;
    return container;
  };

  const applyScroll = (container: HTMLElement, target: number) => {
    const previousBehavior = container.style.scrollBehavior;
    container.style.scrollBehavior = 'auto';
    container.scrollTop = target;
    container.style.scrollBehavior = previousBehavior;
  };

  // Håll kvar exakt läge tills innehållet vuxit klart (max ~2 s), och släpp
  // omedelbart om användaren själv rör skärmen.
  const holdPosition = (container: HTMLElement, target: number) => {
    settleRef.current?.cancel();
    if (target <= 0) return;

    const start = performance.now();
    let frame = 0;
    let stableFrames = 0;
    let cancelled = false;

    const release = () => {
      if (frame) cancelAnimationFrame(frame);
      container.removeEventListener('touchstart', onGesture);
      container.removeEventListener('wheel', onGesture);
      container.removeEventListener('pointerdown', onGesture);
      settleRef.current = null;
    };

    function onGesture() {
      cancelled = true;
      release();
    }

    const tick = () => {
      if (cancelled) return;
      if (performance.now() - start > 2000) return release();

      if (Math.abs(container.scrollTop - target) <= 1) {
        stableFrames += 1;
        if (stableFrames >= 5) return release();
      } else {
        stableFrames = 0;
        applyScroll(container, target);
      }
      frame = requestAnimationFrame(tick);
    };

    container.addEventListener('touchstart', onGesture, { passive: true });
    container.addEventListener('wheel', onGesture, { passive: true });
    container.addEventListener('pointerdown', onGesture, { passive: true });
    settleRef.current = { cancel: () => { cancelled = true; release(); } };
    frame = requestAnimationFrame(tick);
  };

  // Läs av positionen kontinuerligt medan en vy är synlig, så att den senaste
  // kända positionen finns även om bytet sker utan layout-effekt-ordning.
  useEffect(() => {
    const container = getScrollContainer();
    if (!container) return;
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        setKeepAliveScroll(displayedKey, container.scrollTop);
      });
    };
    // Snapshot direkt när användaren rör ett kort: navigeringen kan ske innan
    // nästa rAF hinner köras.
    const onPointerDown = () => setKeepAliveScroll(displayedKey, container.scrollTop);
    container.addEventListener('scroll', onScroll, { passive: true });
    container.addEventListener('pointerdown', onPointerDown, { passive: true });
    return () => {
      container.removeEventListener('scroll', onScroll);
      container.removeEventListener('pointerdown', onPointerDown);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [displayedKey]);

  // `activeKey` ändras innan den fördröjda vyväxlingen. Ta därför den säkra
  // snapshotten här medan den gamla sidan fortfarande har full layout och
  // exakt scrollTop. Om vi väntar tills `displayedKey` ändras har React redan
  // satt den gamla, höga listan till display:none; webbläsaren hinner då klippa
  // den delade scroll-containern till 0 och skriva över rätt position.
  useLayoutEffect(() => {
    if (activeKey === displayedKey) return;
    const container = getScrollContainer();
    if (!container) return;
    setKeepAliveScroll(displayedKey, container.scrollTop);
  }, [activeKey, displayedKey]);

  // Återställ även vid allra första monteringen (t.ex. efter en omladdning
  // eller när hela Index remountas) — annars tappas positionen helt.
  useLayoutEffect(() => {
    const container = getScrollContainer();
    if (!container) return;
    const target = getKeepAliveScroll(displayedKey);
    if (target > 0) {
      applyScroll(container, target);
      holdPosition(container, target);
    }
    return () => settleRef.current?.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    const container = getScrollContainer();
    if (!container) return;
    const previousKey = previousDisplayedKeyRef.current;
    if (previousKey === displayedKey) return;
    previousDisplayedKeyRef.current = displayedKey;

    settleRef.current?.cancel();
    const target = getKeepAliveScroll(displayedKey);
    applyScroll(container, target);
    holdPosition(container, target);
  }, [displayedKey]);


  // 🚀 Synkron växling för redan besökta vyer (t.ex. krysset i en annonsvy →
  // tillbaka till annonslistan). Tidigare kördes bytet i en `useEffect`, alltså
  // EFTER att webbläsaren målat en bildruta där routen redan var listan men
  // annonsvyn fortfarande syntes — det var blixten användaren såg. Nu sker
  // bytet före paint, så övergången är en enda ren bildruta.
  useLayoutEffect(() => {
    if (isFirstActivationRef.current) return;
    if (activeKey === displayedKey) return;
    if (freshKeysRef.current.has(activeKey)) return; // ny vy → tona in nedan
    setDisplayedKey(activeKey);
    setIsEntered(true);
    setIsAnimating(false);
  }, [activeKey, displayedKey]);

  useEffect(() => {
    if (isFirstActivationRef.current) {
      isFirstActivationRef.current = false;
      setDisplayedKey(activeKey);
      freshKeysRef.current.delete(activeKey);

      setIsEntered(true);
      setIsAnimating(false);
      return;
    }

    if (activeKey === displayedKey) {
      // Säkerhet: garantera att vi alltid är fully entered om vi inte byter route
      setIsEntered(true);
      return;
    }

    // 🚀 Om mål-sidan redan är cacheaad (monterad tidigare) → instant swap utan fade.
    // Användaren upplever annars en "uppdaterar"-känsla vid varje flikbyte mellan
    // redan besökta sidor. Endast första monteringen av en ny sida ska animeras.
    if (cacheRef.current.has(activeKey)) {
      setDisplayedKey(activeKey);
      setIsEntered(true);
      setIsAnimating(false);
      return;
    }

    let raf1 = 0;
    let raf2 = 0;
    let safetyTimer = 0;
    const delayTimer = window.setTimeout(() => {
      // 1) Byt synlig nod och sätt start-state (osynlig)
      setDisplayedKey(activeKey);
      setIsEntered(false);
      setIsAnimating(true);

      // 2) Dubbel rAF garanterar att browsern committar start-framen
      //    innan vi flippar till slut-state. Utan detta kan transitionen
      //    "hoppas över" under hög last → fade missas.
      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => {
          setIsEntered(true);
        });
      });

      // 3) Safety-net: oavsett om transitionend fyrar eller ej, tvinga
      //    fully entered efter max (delay + 800ms) så att vi aldrig
      //    fastnar i halvtransparent läge.
      safetyTimer = window.setTimeout(() => {
        setIsEntered(true);
        setIsAnimating(false);
      }, 800);
    }, enterDelayMs);

    return () => {
      window.clearTimeout(delayTimer);
      window.clearTimeout(safetyTimer);
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [activeKey, displayedKey, enterDelayMs]);

  // Mount the active key on demand if it isn't cached yet
  useEffect(() => {
    if (!cacheRef.current.has(activeKey)) {
      cacheRef.current.set(activeKey, render(activeKey));
      mountedKeysRef.current = [...mountedKeysRef.current, activeKey];
      setTick((t) => t + 1);
    }
  }, [activeKey, render]);

  // Synchronously seed the active key on the very first render so we don't
  // flash an empty frame
  if (!cacheRef.current.has(activeKey)) {
    cacheRef.current.set(activeKey, render(activeKey));
    if (!mountedKeysRef.current.includes(activeKey)) {
      mountedKeysRef.current = [...mountedKeysRef.current, activeKey];
    }
  }

  // Drop cached nodes that are no longer in keepKeys (and not the active one)
  useEffect(() => {
    const allowed = new Set([...keepKeys, activeKey, displayedKey]);
    let changed = false;
    for (const key of Array.from(cacheRef.current.keys())) {
      if (!allowed.has(key)) {
        cacheRef.current.delete(key);
        changed = true;
      }
    }
    if (changed) {
      mountedKeysRef.current = mountedKeysRef.current.filter((k) => allowed.has(k));
      setTick((t) => t + 1);
    }
  }, [activeKey, displayedKey, keepKeys]);

  return (
    <div className="relative w-full h-full flex flex-col min-h-0">
      {mountedKeysRef.current.map((key) => {
        const isDisplayed = key === displayedKey;
        const enterClasses = isEntered
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 translate-y-2 pointer-events-none';
        return (
          <div
            key={key}
            style={
              isDisplayed
                ? { willChange: isAnimating ? 'opacity, transform' : 'auto' }
                : { display: 'none' }
            }
            className={
              isDisplayed
                ? `flex-1 min-h-0 flex flex-col transform-gpu transition-[opacity,transform] duration-500 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] ${enterClasses}`
                : ''
            }
            aria-hidden={!isDisplayed}
            onTransitionEnd={(e) => {
              if (!isDisplayed) return;
              if (e.propertyName !== 'opacity') return;
              setIsAnimating(false);
              setIsEntered(true);
            }}
          >
            {cacheRef.current.get(key)}
          </div>
        );
      })}
    </div>
  );
}

export default KeepAlive;
