import pariumLogoRings from "@/assets/parium-logo-rings.png";

// Auth page logo (from public folder) - blue text on dark background
const authLogoUrl = "/lovable-uploads/79c2f9ec-4fa4-43c9-9177-5f0ce8b19f57.png";

// Alternative logo (white version for dark backgrounds - used in ProfileSelector, ProfileBuilder)
const altLogoUrl = "/lovable-uploads/3e52da4e-167e-4ebf-acfb-6a70a68cfaef.png";

/**
 * Keeps critical UI assets warm in the browser cache/decoder so route changes
 * (e.g. JobView -> back) don't cause visible logo "pop-in".
 * 
 * Uses BOTH an <img> element (for decode) AND a div with backgroundImage
 * (to keep the texture in GPU memory). This dual approach ensures the logo
 * is always ready to paint immediately.
 * 
 * Now includes ALL THREE logos:
 * - parium-logo-rings.png (used in navigation/home button)
 * - Auth page logo (used on /auth page, Landing)
 * - Alternative white logo (used in ProfileSelector, ProfileBuilder)
 */
export function CriticalAssetPreloads() {
  return (
    <>
      {/* Hidden img elements to keep images decoded in memory */}
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
      <img
        src={authLogoUrl}
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
      
      {/* Divs with backgroundImage to keep textures warm in GPU/compositor */}
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
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: 160,
          height: 40,
          opacity: 0.001,
          pointerEvents: "none",
          zIndex: -1,
          backgroundImage: `url(${authLogoUrl})`,
          backgroundSize: "contain",
          backgroundRepeat: "no-repeat",
          willChange: "transform",
        }}
      />
      {/* Alternative white logo (ProfileSelector, ProfileBuilder) */}
      <img
        src={altLogoUrl}
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
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: 160,
          height: 40,
          opacity: 0.001,
          pointerEvents: "none",
          zIndex: -1,
          backgroundImage: `url(${altLogoUrl})`,
          backgroundSize: "contain",
          backgroundRepeat: "no-repeat",
          willChange: "transform",
        }}
      />
    </>
  );
}
