import { useEffect, useState, type CSSProperties } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

interface AnchorRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * Global, permanent Parium-logga som hålls varm i DOM:en
 * Loggan positioneras dynamiskt ovanför auth-formuläret
 * genom att följa ett ankar-element med data-auth-logo-anchor="true".
 */
export const AuthLogoOverlay = () => {
  const location = useLocation();
  const isAuthRoute = location.pathname === "/auth";

  const { user, loading, authAction } = useAuth();

  // Dölj loggan exakt samtidigt som auth-loading-overlay visas
  const hideForAuthLoading =
    loading && (authAction === "login" || (!!user && authAction !== "logout"));

  const [rect, setRect] = useState<AnchorRect | null>(null);

  // Följ ankar-elementet på auth-sidan för exakt position
  useEffect(() => {
    if (!isAuthRoute || typeof window === "undefined") return;

    const anchor = document.querySelector(
      '[data-auth-logo-anchor="true"]'
    ) as HTMLElement | null;

    if (!anchor) return;

    const updatePosition = () => {
      const r = anchor.getBoundingClientRect();
      setRect({
        top: r.top + window.scrollY,
        left: r.left + window.scrollX,
        width: r.width,
        height: r.height,
      });
    };

    updatePosition();

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => updatePosition());
      resizeObserver.observe(anchor);
    }

    window.addEventListener("resize", updatePosition, {
      passive: true,
    } as any);
    window.addEventListener("scroll", updatePosition, {
      passive: true,
    } as any);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [isAuthRoute]);

  const style: CSSProperties = rect
    ? {
        top: rect.top + rect.height / 2,
        left: rect.left + rect.width / 2,
        transform: "translate(-50%, -50%)",
      }
    : {
        top: "18vh",
        left: "50%",
        transform: "translateX(-50%)",
      };

  return (
    <div className="pointer-events-none fixed inset-0 z-[15]" aria-hidden="true">
      <div
        className={`transition-opacity duration-200 ${
          isAuthRoute && !hideForAuthLoading ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="absolute" style={style}>
          <div className="relative mx-auto w-fit min-h-[200px] md:min-h-[224px] lg:min-h-[260px] flex items-center justify-center">
            {/* Glow effect bakom loggan - subtil och täcker hela loggan */}
            <div className="absolute inset-0 flex items-center justify-center -translate-y-2">
              <div className="w-72 h-52 bg-primary-glow/25 rounded-full blur-[40px]" />
            </div>
            <div className="absolute inset-0 flex items-center justify-center -translate-y-2">
              <div className="w-52 h-36 bg-primary-glow/22 rounded-full blur-[35px]" />
            </div>
            <div className="absolute inset-0 flex items-center justify-center -translate-y-2">
              <div className="w-44 h-28 bg-primary-glow/20 rounded-full blur-[30px]" />
            </div>
            <div className="absolute inset-0 flex items-center justify-center -translate-y-2">
              <div className="w-36 h-20 bg-primary-glow/18 rounded-full blur-[25px]" />
            </div>
            <img
              src="/lovable-uploads/79c2f9ec-4fa4-43c9-9177-5f0ce8b19f57.png"
              alt="Parium"
              className="relative h-40 w-auto scale-125 md:h-[224px] md:scale-100 lg:h-56 lg:scale-100 will-change-transform"
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
};
