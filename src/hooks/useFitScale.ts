import { useCallback, useEffect, useRef, useState } from 'react';

interface FitScaleOptions {
  /** Innehållets naturliga höjd i px (designhöjd) vid ≥768px. */
  designHeight?: number;
  /** Designbredd under 768px (Tailwinds `md`). Utelämnas → samma som designWidth. */
  designWidthSm?: number;
  /** Designhöjd under 768px. Utelämnas → samma som designHeight. */
  designHeightSm?: number;
  /** Lägsta tillåtna skala. */
  minScale?: number;
  /** Högsta tillåtna skala — tillåter uppskalning så ytan används fullt ut. */
  maxScale?: number;
  /** Marginal i px som reserveras utöver innehållet (t.ex. dialogens footer). */
  bottomGutter?: number;
}

/**
 * Mäter tillgänglig bredd OCH höjd och returnerar en skalfaktor så att ett
 * innehåll med fast "designstorlek" fyller ytan så mycket som möjligt — utan
 * att något klipps av i kanten och utan död yta under.
 *
 * Används av wizardens förhandsvisning där tooltips ("Obs, tryck här!") sitter
 * absolut positionerade utanför telefonmockupen. Designbredden ska vara den
 * FAKTISKA bredden (telefon + tooltip-zonerna) — sätts den för högt krymper
 * mockupen i onödan.
 *
 * Returnerar även `contentHeight` (skalad höjd) så att behållaren kan reservera
 * exakt rätt plats — transform påverkar inte layoutflödet.
 */
export function useFitScale(designWidth: number, options: FitScaleOptions = {}) {
  const {
    designHeight,
    designWidthSm,
    designHeightSm,
    minScale = 0.5,
    maxScale = 1,
    bottomGutter = 24,
  } = options;

  const [scale, setScale] = useState(1);
  const [contentHeight, setContentHeight] = useState<number | undefined>(designHeight);
  const nodeRef = useRef<HTMLElement | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);

  const measure = useCallback(() => {
    const node = nodeRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    if (!rect.width) return;

    const isSm = typeof window !== 'undefined' && window.innerWidth < 768;
    const wDesign = (isSm && designWidthSm) || designWidth;
    const hDesign = (isSm && designHeightSm) || designHeight;

    let next = rect.width / wDesign;

    if (hDesign && typeof window !== 'undefined') {
      // Höjdbudget = den scrollbara behållarens synliga höjd (dialogens body),
      // inte hela fönstret — annars blir skalan fel när innehållet ligger
      // långt ned i en scrollad dialog.
      let viewportHeight = window.innerHeight;
      let parent = node.parentElement;
      while (parent) {
        const overflowY = getComputedStyle(parent).overflowY;
        if ((overflowY === 'auto' || overflowY === 'scroll') && parent.clientHeight > 0) {
          viewportHeight = parent.clientHeight;
          break;
        }
        parent = parent.parentElement;
      }
      const available = viewportHeight - bottomGutter;
      if (available > 0) next = Math.min(next, available / hDesign);
    }

    next = Math.max(minScale, Math.min(maxScale, next));
    setScale((prev) => (Math.abs(prev - next) > 0.005 ? next : prev));
    if (hDesign) {
      const h = hDesign * next;
      setContentHeight((prev) => (prev === undefined || Math.abs(prev - h) > 0.5 ? h : prev));
    }
  }, [designWidth, designWidthSm, designHeight, designHeightSm, minScale, maxScale, bottomGutter]);

  const ref = useCallback((node: HTMLElement | null) => {
    observerRef.current?.disconnect();
    nodeRef.current = node;
    if (!node) return;

    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(node);
    observerRef.current = ro;
  }, [measure]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onResize = () => measure();
    window.addEventListener('resize', onResize);
    measure();
    return () => window.removeEventListener('resize', onResize);
  }, [measure]);

  useEffect(() => () => observerRef.current?.disconnect(), []);

  return { ref, scale, contentHeight };
}
