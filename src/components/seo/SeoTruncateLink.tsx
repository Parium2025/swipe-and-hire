import { Link } from 'react-router-dom';
import { ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

type TooltipSide = 'top' | 'right' | 'bottom' | 'left';

const detectEnv = () => {
  if (typeof window === 'undefined') return { isTouch: false, supportsHover: true };
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const supportsHover =
    'matchMedia' in window
      ? window.matchMedia('(hover: hover)').matches || window.matchMedia('(pointer: fine)').matches
      : true;
  return { isTouch, supportsHover };
};

const ENV = detectEnv();

const isElementTruncated = (element: HTMLElement) =>
  Math.ceil(element.scrollWidth) > Math.ceil(element.clientWidth) ||
  Math.ceil(element.scrollHeight) > Math.ceil(element.clientHeight);

const hasTruncatedChild = (root: HTMLElement) => {
  const targets = root.querySelectorAll<HTMLElement>('[data-truncate-text]');
  if (!targets.length) return isElementTruncated(root);
  return Array.from(targets).some(isElementTruncated);
};

interface SeoTruncatedTextProps {
  children: ReactNode;
  fullText: string;
  className?: string;
  side?: TooltipSide;
}

export const SeoTruncatedText = ({
  children,
  fullText,
  className,
  side = 'top',
}: SeoTruncatedTextProps) => {
  const ref = useRef<HTMLSpanElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);
  const [open, setOpen] = useState(false);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setIsTruncated(isElementTruncated(el));
  }, []);

  useLayoutEffect(() => {
    const el = ref.current;
    const id = requestAnimationFrame(measure);
    let ro: ResizeObserver | undefined;
    if (el && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(measure);
      ro.observe(el);
    }
    document.fonts?.ready?.then(measure).catch(() => undefined);
    return () => {
      cancelAnimationFrame(id);
      ro?.disconnect();
    };
  }, [fullText, measure]);

  const text = (
    <span
      ref={ref}
      className={cn('block min-w-0 truncate text-white', className)}
      onFocus={measure}
      onMouseEnter={measure}
      onPointerDown={() => {
        if (!ENV.supportsHover && ENV.isTouch && isTruncated) setOpen((value) => !value);
      }}
      data-truncate-text
    >
      {children}
    </span>
  );

  if (!isTruncated) return text;

  return (
    <Tooltip
      open={!ENV.supportsHover ? open : undefined}
      onOpenChange={!ENV.supportsHover ? setOpen : undefined}
      delayDuration={120}
    >
      <TooltipTrigger asChild>{text}</TooltipTrigger>
      <TooltipContent side={side} sideOffset={8} className="bg-slate-950/95 border-white/20 text-white">
        {fullText}
      </TooltipContent>
    </Tooltip>
  );
};

interface SeoTruncateLinkProps {
  to: string;
  fullText: string;
  children: ReactNode;
  className?: string;
  side?: TooltipSide;
}

export const SeoTruncateLink = ({
  to,
  fullText,
  children,
  className,
  side = 'top',
}: SeoTruncateLinkProps) => {
  const ref = useRef<HTMLAnchorElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);
  const [open, setOpen] = useState(false);
  const tappedOnceRef = useRef(false);
  const resetTimerRef = useRef<number | null>(null);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setIsTruncated(hasTruncatedChild(el));
  }, []);

  useLayoutEffect(() => {
    const el = ref.current;
    const id = requestAnimationFrame(measure);
    let ro: ResizeObserver | undefined;
    if (el && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(measure);
      ro.observe(el);
    }
    document.fonts?.ready?.then(measure).catch(() => undefined);
    return () => {
      cancelAnimationFrame(id);
      ro?.disconnect();
      if (resetTimerRef.current) window.clearTimeout(resetTimerRef.current);
    };
  }, [fullText, measure]);

  useEffect(() => {
    if (!open) tappedOnceRef.current = false;
  }, [open]);

  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (ENV.supportsHover || !ENV.isTouch || !isTruncated) return;
    if (!tappedOnceRef.current) {
      event.preventDefault();
      tappedOnceRef.current = true;
      setOpen(true);
      if (resetTimerRef.current) window.clearTimeout(resetTimerRef.current);
      resetTimerRef.current = window.setTimeout(() => {
        tappedOnceRef.current = false;
        setOpen(false);
      }, 2200);
    }
  };

  const link = (
    <Link
      ref={ref}
      to={to}
      className={className}
      onClick={handleClick}
      onFocus={measure}
      onMouseEnter={measure}
    >
      {children}
    </Link>
  );

  if (!isTruncated) return link;

  return (
    <Tooltip
      open={!ENV.supportsHover ? open : undefined}
      onOpenChange={!ENV.supportsHover ? setOpen : undefined}
      delayDuration={120}
    >
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side={side} sideOffset={8} className="bg-slate-950/95 border-white/20 text-white">
        {fullText}
      </TooltipContent>
    </Tooltip>
  );
};

export default SeoTruncateLink;