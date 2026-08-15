import { Apple, Play } from 'lucide-react';

/**
 * "Kommer snart"-badges för App Store & Google Play.
 * Inaktiva knappar — visuellt polerade men inte klickbara,
 * så vi inte lovar en nedladdning som inte finns än.
 */
export function AppBadges({ className = '' }: { className?: string }) {
  return (
    <div
      className={`flex flex-col items-center gap-4 ${className}`}
      aria-label="Parium-appen"
    >
      <div>
        <span className="text-xs font-bold uppercase tracking-[0.32em] text-secondary/85">
          Ladda strax ner Parium
        </span>
        <p className="mt-3 text-lg font-semibold text-white sm:text-xl">
          Snart tillgänglig i App Store och Google Play.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
        <BadgeButton
          icon={<Apple className="h-7 w-7" strokeWidth={1.6} />}
          top="Kommer snart på"
          bottom="App Store"
        />
        <BadgeButton
          icon={<Play className="h-6 w-6" strokeWidth={1.8} />}
          top="Kommer snart på"
          bottom="Google Play"
        />
      </div>
    </div>
  );
}

function BadgeButton({
  icon,
  top,
  bottom,
}: {
  icon: React.ReactNode;
  top: string;
  bottom: string;
}) {
  return (
    <div
      aria-disabled="true"
      className="group relative flex min-h-[60px] items-center gap-3 rounded-2xl border border-white/12 bg-white/[0.04] px-5 py-3 [@media_(hover:hover)]:backdrop-blur-xl"
    >
        <span className="text-white/90">{icon}</span>
      <span className="flex flex-col leading-none">
        <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-secondary">
          {top}
        </span>
        <span className="mt-1 text-base font-bold text-white sm:text-[17px]">
          {bottom}
        </span>
      </span>
      <span className="ml-1 rounded-full border border-secondary/40 bg-secondary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-secondary">
        Snart
      </span>
    </div>
  );
}

export default AppBadges;
