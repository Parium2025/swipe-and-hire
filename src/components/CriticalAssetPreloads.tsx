import pariumLogoRings from "@/assets/parium-logo-rings.png";

/**
 * Keeps critical UI assets warm in the browser cache/decoder so route changes
 * (e.g. JobView -> back) don't cause visible logo "pop-in".
 * 
 * Uses BOTH an <img> element (for decode) AND a div with backgroundImage
 * (to keep the texture in GPU memory). This dual approach ensures the logo
 * is always ready to paint immediately.
 * 
 * Note: Auth page logo is now inline SVG - no preloading needed
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
    </>
  );
}
