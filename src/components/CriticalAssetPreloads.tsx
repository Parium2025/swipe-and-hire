import { useEffect } from "react";
import pariumLogoRings from "@/assets/parium-logo-rings.png";
import authLogoDataUri from "@/assets/parium-auth-logo.png?inline";

const AUTH_LOGO_DATA_URI_KEY = "parium_auth_logo_data_uri_v1";

/**
 * Keeps critical UI assets warm in the browser cache/decoder so route changes
 * and auth transitions (logout -> /auth splash) don't cause visible logo pop-in.
 *
 * Note: The auth-splash in index.html now uses an INLINE SVG, so no network
 * preload is needed for that. We still keep the React-side auth logo (data-URI)
 * warm for AuthSplashScreen.tsx which takes over after React mounts.
 */
export function CriticalAssetPreloads() {
  // Persist a network-free version for the HTML auth splash shell on refresh.
  // This makes the shell logo instantaneous even before React mounts.
  useEffect(() => {
    try {
      if (typeof authLogoDataUri === "string" && authLogoDataUri.startsWith("data:image")) {
        localStorage.setItem(AUTH_LOGO_DATA_URI_KEY, authLogoDataUri);
      }
    } catch {
      // Ignore storage errors (private mode/quota/etc.)
    }
  }, []);

  return (
    <>
      {/* Hidden img element to keep navigation logo decoded in memory */}
      <img
        src={pariumLogoRings}
        alt=""
        aria-hidden="true"
        loading="eager"
        decoding="sync"
        fetchPriority="high"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: 1,
          height: 1,
          opacity: 0,
          pointerEvents: "none",
          zIndex: -1,
        }}
      />

      {/* Hidden img to keep auth logo (data-URI) decoded for AuthSplashScreen */}
      <img
        src={authLogoDataUri}
        alt=""
        aria-hidden="true"
        loading="eager"
        decoding="sync"
        fetchPriority="high"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: 1,
          height: 1,
          opacity: 0,
          pointerEvents: "none",
          zIndex: -1,
        }}
      />
      
      {/* Div with backgroundImage to keep texture warm in GPU/compositor */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: 160,
          height: 40,
          opacity: 0.001, // Near-invisible but still composited
          pointerEvents: "none",
          zIndex: -1,
          backgroundImage: `url(${pariumLogoRings})`,
          backgroundSize: "contain",
          backgroundRepeat: "no-repeat",
          willChange: "transform", // Hint to keep layer alive
        }}
      />

      {/* Keep auth logo texture warm as well (helps some GPUs avoid first-paint stalls) */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: 240,
          height: 96,
          opacity: 0.001,
          pointerEvents: "none",
          zIndex: -1,
          backgroundImage: `url(${authLogoDataUri})`,
          backgroundSize: "contain",
          backgroundRepeat: "no-repeat",
          willChange: "transform",
        }}
      />
    </>
  );
}
