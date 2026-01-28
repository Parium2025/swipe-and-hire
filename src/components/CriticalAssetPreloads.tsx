import pariumLogoRings from "@/assets/parium-logo-rings.png";

/**
 * Keeps critical UI assets warm in the browser cache/decoder so route changes
 * (e.g. JobView -> back) don't cause visible logo "pop-in".
 */
export function CriticalAssetPreloads() {
  return (
    <img
      src={pariumLogoRings}
      alt=""
      aria-hidden="true"
      loading="eager"
      decoding="sync"
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
  );
}
