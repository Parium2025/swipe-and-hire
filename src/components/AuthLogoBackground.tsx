import { memo } from 'react';

/**
 * Persistent Parium-logo i bakgrunden på auth-sidan.
 *
 * Viktigt: Den här komponenten monteras EN gång och tas aldrig bort,
 * vi växlar bara synlighet med CSS. På så sätt "sitter" loggan fast
 * och behöver aldrig laddas om visuellt när man loggar in/ut.
 */
interface AuthLogoBackgroundProps {
  /** Om true är loggan synlig, annars göms den med opacity men ligger kvar i DOM. */
  visible: boolean;
}

export const AuthLogoBackground = memo(({ visible }: AuthLogoBackgroundProps) => {
  return (
    <div
      className={`pointer-events-none fixed inset-0 z-0 flex items-start justify-center pt-16 sm:pt-20 md:pt-24 lg:pt-28 transition-none`}
      aria-hidden="true"
    >
      <div className="relative mx-auto w-fit min-h-[200px] sm:min-h-[220px] md:min-h-[240px] flex items-center justify-center">
        {/* Synlighet styrs endast via opacity för att undvika om-mount */}
        <div className={visible ? 'opacity-100' : 'opacity-0'}>
          <div className="relative mx-auto w-fit min-h-[200px] sm:min-h-[220px] md:min-h-[240px] flex items-center justify-center">
            {/* Glow-effekter bakom loggan, matchar auth-layouten */}
            <div className="absolute inset-0 flex items-center justify-center -translate-y-2">
              <div className="w-72 h-52 bg-primary-glow/25 rounded-full blur-[40px]"></div>
            </div>
            <div className="absolute inset-0 flex items-center justify-center -translate-y-2">
              <div className="w-52 h-36 bg-primary-glow/22 rounded-full blur-[35px]"></div>
            </div>
            <div className="absolute inset-0 flex items-center justify-center -translate-y-2">
              <div className="w-44 h-28 bg-primary-glow/20 rounded-full blur-[30px]"></div>
            </div>
            <div className="absolute inset-0 flex items-center justify-center -translate-y-2">
              <div className="w-36 h-20 bg-primary-glow/18 rounded-full blur-[25px]"></div>
            </div>
            <img
              src="/lovable-uploads/79c2f9ec-4fa4-43c9-9177-5f0ce8b19f57.png"
              alt="Parium"
              className="relative h-40 sm:h-48 md:h-56 lg:h-64 w-auto"
              width={400}
              height={160}
              loading="eager"
              decoding="sync"
            />
          </div>
        </div>
      </div>
    </div>
  );
});

AuthLogoBackground.displayName = 'AuthLogoBackground';
