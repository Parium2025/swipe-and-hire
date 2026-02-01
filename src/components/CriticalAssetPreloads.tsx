import { PariumLogoRingsInline } from "@/assets/pariumLogoRingsInline";

/**
 * Keeps critical UI assets warm in the browser cache/decoder so route changes
 * (e.g. JobView -> back) don't cause visible logo "pop-in".
 * 
 * Note: Auth page logo is handled separately.
 */
export function CriticalAssetPreloads() {
  return (
    <>
      {/* Hidden img element to keep navigation logo decoded in memory */}
      <PariumLogoRingsInline
        alt=""
        aria-hidden="true"
        width={1}
        height={1}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          opacity: 0,
          pointerEvents: "none",
          zIndex: -1,
        }}
      />
    </>
  );
}

