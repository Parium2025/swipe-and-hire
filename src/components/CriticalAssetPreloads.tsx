import pariumLogoRings from "@/assets/parium-logo-rings.png";
import authLogoDataUri from "@/assets/parium-auth-logo.png?inline";
// Same asset used by the hard-refresh auth splash in index.html + LandingNav
import pariumWordmarkPng from "/lovable-uploads/79c2f9ec-4fa4-43c9-9177-5f0ce8b19f57.png";

/**
 * Keeps critical UI assets warm in the browser cache/decoder so route changes
 * and auth transitions (logout -> /auth splash) don't cause visible logo pop-in.
 *
 * Uses BOTH an <img> element (forces download + decode) AND a div with
 * backgroundImage (keeps texture warm in GPU/compositor).
 */
export function CriticalAssetPreloads() {
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

      {/* Hidden img to keep auth logo decoded in memory (prevents logout splash delay) */}
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

      {/* Hidden img to warm the wordmark used by index.html auth-splash (hard reload) */}
      <img
        src={pariumWordmarkPng}
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
