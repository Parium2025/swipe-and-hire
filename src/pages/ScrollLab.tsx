import React, { useEffect, useRef, useState } from 'react';
import KeepAlive from '@/components/KeepAlive';

/** Temporär diagnostikvy för scroll-återställning (dev). */
const LabList = () => {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 1200);
    return () => clearTimeout(t);
  }, []);
  if (!loaded) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-28 w-full bg-white/10 rounded-xl" />
        ))}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 30 }).map((_, i) => (
        <div key={i} className="h-28 w-full bg-white/20 rounded-xl text-white p-2">Kort {i}</div>
      ))}
    </div>
  );
};

const ScrollLab = () => {
  const mainRef = useRef<HTMLElement>(null);
  return (
    <div className="h-[100dvh] flex w-full overflow-hidden relative bg-slate-900">
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
        <header className="shrink-0 h-14 text-white">lab</header>
        <main
          ref={mainRef}
          data-main-scroll-container="true"
          data-scroll-managed="keepalive"
          className="flex-1 min-h-0 overflow-x-hidden overflow-y-auto p-3 flex flex-col"
        >
          <KeepAlive activeKey="/lab" keepKeys={['/lab']} render={() => <LabList />} />
          <div aria-hidden="true" style={{ flexShrink: 0, height: 96 }} />
        </main>
      </div>
    </div>
  );
};

export default ScrollLab;
