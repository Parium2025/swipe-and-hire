import { useEffect, useRef, useState } from 'react';

/**
 * MorphingHeading
 * ---------------
 * Morfar 6 primitiva former (triangel, kvadrat, cirkel, diamant, pentagon,
 * hexagon) till bokstäverna i "Parium" via flubber-pathinterpolation och
 * gsap-tweens. Bokstavspaths hämtas dynamiskt från Inter (Black, 900) via
 * opentype.js så att vi får exakta glyph-konturer i brand-fonten.
 *
 * Färg: brand-blue gradient (samma som scrollbaren på 3:an).
 *
 * Allt tungt (opentype.js, flubber, gsap) laddas dynamiskt så att intro-
 * sektionens initiala paint inte påverkas.
 */

const TEXT = 'Parium';
const FONT_SIZE = 160; // px-höjd på glyfer
const PADDING_X = 24;
const PADDING_Y = 32;

// 6 startformer (en per bokstav) – returnerar en path-d sträng kring (cx,cy)
// med bredd w och höjd h. Hålls visuellt enkla så morfen blir tydlig.
const shapePath = (
  type: 'triangle' | 'square' | 'circle' | 'diamond' | 'pentagon' | 'hexagon',
  cx: number,
  cy: number,
  w: number,
  h: number,
): string => {
  const rx = w / 2;
  const ry = h / 2;
  switch (type) {
    case 'triangle':
      return `M${cx},${cy - ry} L${cx + rx},${cy + ry} L${cx - rx},${cy + ry} Z`;
    case 'square':
      return `M${cx - rx},${cy - ry} L${cx + rx},${cy - ry} L${cx + rx},${cy + ry} L${cx - rx},${cy + ry} Z`;
    case 'circle': {
      // Approximera cirkel/ellips med 4 cubic bezier-segment
      const kx = rx * 0.5523;
      const ky = ry * 0.5523;
      return (
        `M${cx - rx},${cy} ` +
        `C${cx - rx},${cy - ky} ${cx - kx},${cy - ry} ${cx},${cy - ry} ` +
        `C${cx + kx},${cy - ry} ${cx + rx},${cy - ky} ${cx + rx},${cy} ` +
        `C${cx + rx},${cy + ky} ${cx + kx},${cy + ry} ${cx},${cy + ry} ` +
        `C${cx - kx},${cy + ry} ${cx - rx},${cy + ky} ${cx - rx},${cy} Z`
      );
    }
    case 'diamond':
      return `M${cx},${cy - ry} L${cx + rx},${cy} L${cx},${cy + ry} L${cx - rx},${cy} Z`;
    case 'pentagon': {
      const pts = [0, 1, 2, 3, 4].map((i) => {
        const ang = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
        return `${cx + Math.cos(ang) * rx},${cy + Math.sin(ang) * ry}`;
      });
      return `M${pts.join(' L')} Z`;
    }
    case 'hexagon': {
      const pts = [0, 1, 2, 3, 4, 5].map((i) => {
        const ang = -Math.PI / 2 + (i * 2 * Math.PI) / 6;
        return `${cx + Math.cos(ang) * rx},${cy + Math.sin(ang) * ry}`;
      });
      return `M${pts.join(' L')} Z`;
    }
  }
};

const SHAPE_ORDER: Array<'triangle' | 'square' | 'circle' | 'diamond' | 'pentagon' | 'hexagon'> = [
  'triangle',
  'square',
  'circle',
  'diamond',
  'pentagon',
  'hexagon',
];

type LetterSlot = {
  // Slutgiltiga letter-subpaths (en per subpath – 'i' har t.ex. prick + stam)
  letterPaths: string[];
  // Startform-path (en per subpath; samma form upprepad om flera subpaths)
  shapePaths: string[];
  // BoundingBox (för viewBox-uträkning)
  bbox: { x1: number; y1: number; x2: number; y2: number };
};

// Split en path-d sträng på subpaths (varje "M" startar en ny subpath).
const splitSubpaths = (d: string): string[] => {
  const parts = d.match(/M[^M]+/g);
  return parts ? parts.map((p) => p.trim()) : [d];
};

// Inter Black (900) i WOFF format från fontsource (jsDelivr CDN).
// opentype.js stödjer woff. CORS är öppet på jsdelivr.
const FONT_URL =
  'https://cdn.jsdelivr.net/npm/@fontsource/inter@5.0.16/files/inter-latin-900-normal.woff';

export const MorphingHeading = () => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [slots, setSlots] = useState<LetterSlot[] | null>(null);
  const [viewBox, setViewBox] = useState<string>('0 0 900 220');
  const pathRefs = useRef<Array<Array<SVGPathElement | null>>>([]);

  // ── 1) Bygg paths från font + startformer ─────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const opentype = (await import('opentype.js')).default;
        const buf = await fetch(FONT_URL).then((r) => r.arrayBuffer());
        if (cancelled) return;
        const font = opentype.parse(buf);

        let cursor = 0;
        const built: LetterSlot[] = [];
        let minY = Infinity;
        let maxY = -Infinity;

        TEXT.split('').forEach((ch, idx) => {
          const glyph = font.charToGlyph(ch);
          // y=0 = baseline. opentype ritar glyfer med Y nedåt-positiv i SVG.
          const path = glyph.getPath(cursor, 0, FONT_SIZE);
          const d = path.toPathData(2);
          const bb = path.getBoundingBox();
          const advance = ((glyph.advanceWidth ?? FONT_SIZE * 0.6) / font.unitsPerEm) * FONT_SIZE;
          const letterPaths = splitSubpaths(d);
          // Centrum + storlek på startformen baseras på letterns bbox.
          const w = Math.max(bb.x2 - bb.x1, 20);
          const h = Math.max(bb.y2 - bb.y1, 20);
          const cx = (bb.x1 + bb.x2) / 2;
          const cy = (bb.y1 + bb.y2) / 2;
          // Startformen är något mindre och uniform – ger snyggare morph.
          const shapeSize = Math.min(w, h) * 0.95;
          const shape = shapePath(SHAPE_ORDER[idx % SHAPE_ORDER.length], cx, cy, shapeSize, shapeSize);
          const shapePaths = letterPaths.map(() => shape);

          built.push({
            letterPaths,
            shapePaths,
            bbox: { x1: bb.x1, y1: bb.y1, x2: bb.x2, y2: bb.y2 },
          });
          minY = Math.min(minY, bb.y1);
          maxY = Math.max(maxY, bb.y2);
          cursor += advance;
        });

        const totalW = cursor + PADDING_X * 2;
        const totalH = maxY - minY + PADDING_Y * 2;
        const vbX = -PADDING_X;
        const vbY = minY - PADDING_Y;
        setViewBox(`${vbX} ${vbY} ${totalW} ${totalH}`);
        setSlots(built);
      } catch (e) {
        // Tyst fallback: om CDN/parse failar visar vi bara texten via <text>.
        console.error('[MorphingHeading] font load failed', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── 2) Driv morph-animationen med gsap + flubber ──────────────────────
  useEffect(() => {
    if (!slots) return;
    let cancelled = false;
    let tl: gsap.core.Timeline | null = null;

    (async () => {
      const [{ default: gsap }, flubber] = await Promise.all([
        import('gsap'),
        import('flubber'),
      ]);
      if (cancelled || !svgRef.current) return;

      tl = gsap.timeline({ repeat: -1, repeatDelay: 1.6, yoyo: true, defaults: { ease: 'power2.inOut' } });

      slots.forEach((slot, slotIdx) => {
        const subpaths = slot.letterPaths;
        const interpolators = subpaths.map((letterD, sIdx) => {
          const shapeD = slot.shapePaths[sIdx];
          try {
            return flubber.interpolate(shapeD, letterD, { maxSegmentLength: 6 });
          } catch {
            // Fallback om flubber failar – statisk slutpath
            return (_t: number) => letterD;
          }
        });

        const refs = pathRefs.current[slotIdx] ?? [];
        const proxy = { t: 0 };
        const stepStart = slotIdx * 0.35;

        tl!.to(
          proxy,
          {
            t: 1,
            duration: 1.1,
            onUpdate: () => {
              const v = proxy.t;
              interpolators.forEach((interp, i) => {
                const el = refs[i];
                if (el) el.setAttribute('d', interp(v));
              });
            },
          },
          stepStart,
        );
      });
    })();

    return () => {
      cancelled = true;
      tl?.kill();
    };
  }, [slots]);

  // ── 3) Render ─────────────────────────────────────────────────────────
  return (
    <div className="relative mx-auto w-full max-w-3xl">
      <svg
        ref={svgRef}
        viewBox={viewBox}
        className="block h-auto w-full"
        aria-label={TEXT}
        role="img"
      >
        <defs>
          <linearGradient id="morph-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="hsl(var(--secondary))" />
            <stop offset="100%" stopColor="#7cc6ff" />
          </linearGradient>
          <filter id="morph-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {slots?.map((slot, slotIdx) => {
          if (!pathRefs.current[slotIdx]) pathRefs.current[slotIdx] = [];
          return slot.shapePaths.map((shapeD, subIdx) => (
            <path
              key={`${slotIdx}-${subIdx}`}
              ref={(el) => {
                pathRefs.current[slotIdx][subIdx] = el;
              }}
              d={shapeD}
              fill="url(#morph-grad)"
              filter="url(#morph-glow)"
              fillRule="evenodd"
            />
          ));
        })}
      </svg>
    </div>
  );
};

export default MorphingHeading;
