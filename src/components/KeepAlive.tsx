import React, { useRef, useEffect } from 'react';

interface KeepAliveProps {
  activeKey: string;
  render: (key: string) => React.ReactNode;
  /** Keys to keep alive across navigation. If not provided, only current key is rendered. */
  keepKeys?: string[];
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
export function KeepAlive({ activeKey, render, keepKeys }: KeepAliveProps) {
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
    <KeepAliveCached activeKey={activeKey} render={render} keepKeys={keepKeys} />
  );
}

function KeepAliveCached({
  activeKey,
  render,
  keepKeys,
}: Required<Pick<KeepAliveProps, 'activeKey' | 'render' | 'keepKeys'>>) {
  // Persistent cache of mounted nodes — survives the entire session
  const cacheRef = useRef<Map<string, React.ReactNode>>(new Map());
  // Track which keys we've ever mounted (so we can render in stable order)
  const mountedKeysRef = useRef<string[]>([]);
  // Force a re-render when we mount a new key
  const [, setTick] = React.useState(0);

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
    const allowed = new Set([...keepKeys, activeKey]);
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
  }, [activeKey, keepKeys]);

  return (
    <div className="relative w-full h-full flex flex-col min-h-0">
      {mountedKeysRef.current.map((key) => {
        const isActive = key === activeKey;
        return (
          <div
            key={key}
            // `hidden` removes from layout but keeps the React tree + DOM intact.
            // Using inline style instead of Tailwind `hidden` to be 100% reliable
            // even when parents apply flex utilities.
            style={isActive ? undefined : { display: 'none' }}
            className={isActive ? 'flex-1 min-h-0 flex flex-col' : ''}
            aria-hidden={!isActive}
          >
            {cacheRef.current.get(key)}
          </div>
        );
      })}
    </div>
  );
}

export default KeepAlive;
