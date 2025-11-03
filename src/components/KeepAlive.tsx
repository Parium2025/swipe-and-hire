import React, { useMemo, useRef } from 'react';

interface KeepAliveProps {
  activeKey: string;
  render: (key: string) => React.ReactNode;
}

// Simple keep-alive container that preserves mounted components by key
export function KeepAlive({ activeKey, render }: KeepAliveProps) {
  const cacheRef = useRef(new Map<string, React.ReactNode>());

  // Ensure the active view is cached
  const active = useMemo(() => {
    const cache = cacheRef.current;
    if (!cache.has(activeKey)) {
      cache.set(activeKey, render(activeKey));
    }
    return cache.get(activeKey)!;
  }, [activeKey, render]);

  // Render all cached nodes, show only the active one
  return (
    <div className="relative w-full h-full">
      {[...cacheRef.current.entries()].map(([key, node]) => (
        <div key={key} className={key === activeKey ? 'block' : 'hidden'}>
          {node}
        </div>
      ))}
    </div>
  );
}

export default KeepAlive;

