import { User, Activity, StickyNote } from 'lucide-react';

// ─── Label maps ────────────────────────────────────────────
export const employmentStatusLabels: Record<string, string> = {
  tillsvidareanställning: 'Fast anställning',
  visstidsanställning: 'Visstidsanställning',
  provanställning: 'Provanställning',
  interim: 'Interim anställning',
  arbetssokande: 'Arbetssökande',
};
export const workScheduleLabels: Record<string, string> = {
  heltid: 'Heltid', deltid: 'Deltid', timanställning: 'Timanställning',
};
export const availabilityLabels: Record<string, string> = {
  omgaende: 'Omgående',
  'inom-1-manad': 'Inom 1 månad',
  'inom-3-manader': 'Inom 3 månader',
  'inom-6-manader': 'Inom 6 månader',
  'ej-aktuellt': 'Inte aktuellt just nu',
  osaker: 'Osäker',
};

export type TabKey = 'profil' | 'aktivitet' | 'anteckningar';

export const TABS: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'profil', label: 'Profil', icon: User },
  { key: 'aktivitet', label: 'Aktivitet', icon: Activity },
  { key: 'anteckningar', label: 'Anteckningar', icon: StickyNote },
];

/* ── Shared UI helpers ──────────────────────────── */
export const SectionCard = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-white/[0.06] ring-1 ring-inset ring-white/10 rounded-xl p-3.5 ${className}`}>{children}</div>
);

export const SectionLabel = ({ icon: Icon, children }: { icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) => (
  <span className="text-[10px] font-semibold text-white uppercase tracking-wider flex items-center gap-1.5 mb-2">
    <Icon className="h-3 w-3" />
    {children}
  </span>
);
