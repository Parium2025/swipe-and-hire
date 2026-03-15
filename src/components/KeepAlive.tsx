import React, { useMemo, useRef, useEffect } from 'react';

interface KeepAliveProps {
  activeKey: string;
  render: (key: string) => React.ReactNode;
  /** Keys to keep alive. If not provided, only current key is rendered (no caching) */
  keepKeys?: string[];
}

// Simple keep-alive container that preserves mounted components by key
// Now always re-renders the active key to ensure fresh data
export function KeepAlive({ activeKey, render, keepKeys }: KeepAliveProps) {
  const cacheRef = useRef(new Map<string, React.ReactNode>());
  const prevKeyRef = useRef<string | null>(null);

  // Always re-render the active key to ensure fresh data
  // Only cache non-active keys if they're in keepKeys
  const activeNode = useMemo(() => {
    return render(activeKey);
  }, [activeKey, render]);

  // Clean up old cached keys that are not in keepKeys
  useEffect(() => {
    const cache = cacheRef.current;
    const keysToKeep = new Set(keepKeys || []);
    
    // Remove keys not in keepKeys (except active)
    for (const key of cache.keys()) {
      if (key !== activeKey && !keysToKeep.has(key)) {
        cache.delete(key);
      }
    }
    
    // Cache previous key if it should be kept
    if (prevKeyRef.current && prevKeyRef.current !== activeKey && keysToKeep.has(prevKeyRef.current)) {
      // Keep the old cached version
    }
    
    prevKeyRef.current = activeKey;
  }, [activeKey, keepKeys]);

  // If no keepKeys specified, just render the active view directly (no caching)
  if (!keepKeys || keepKeys.length === 0) {
    return (
      <div className="relative w-full h-full flex flex-col min-h-0">
        <div className="flex-1 min-h-0 flex flex-col">
          {activeNode}
        </div>
      </div>
    );
  }

  // Update cache with active node
  cacheRef.current.set(activeKey, activeNode);

  // Render only active + cached keepKeys
  const keysToRender = new Set([activeKey, ...keepKeys.filter(k => cacheRef.current.has(k))]);

  return (
    <div className="relative w-full h-full flex flex-col min-h-0">
      {[...keysToRender].map((key) => (
        <div key={key} className={key === activeKey ? 'flex-1 min-h-0 flex flex-col' : 'hidden'}>
          {key === activeKey ? activeNode : cacheRef.current.get(key)}
        </div>
      ))}
    </div>
  );
}

export default KeepAlive;
