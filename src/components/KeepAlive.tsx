import React, { useRef, useEffect } from 'react';

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

  useEffect(() => {
    if (isFirstActivationRef.current) {
      isFirstActivationRef.current = false;
      setDisplayedKey(activeKey);
      setIsEntered(true);
      setIsAnimating(false);
      return;
    }

    if (activeKey === displayedKey) {
      // Säkerhet: garantera att vi alltid är fully entered om vi inte byter route
      setIsEntered(true);
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
