import { useState, useEffect, useRef, useCallback, type MouseEvent, type PointerEvent, type TouchEvent } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, useAnimation } from 'framer-motion';
import { recordJobView } from '@/lib/recordJobView';
import { useAuth } from '@/hooks/useAuth';
import { X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getEmploymentTypeLabel } from '@/lib/employmentTypes';
import { getBenefitLabel } from '@/types/jobWizard';
import {
  capitalize as cap,
  getSalaryTypeLabel,
  formatSalary,
  getWorkLocationLabel,
  getRemoteWorkLabel,
  getSalaryTransparencyLabel,
} from '@/lib/jobViewHelpers';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { SwipeJob } from './SwipeCard';

interface FullJobData {
  description?: string;
  requirements?: string;
  pitch?: string;
  benefits?: string[];
  employment_type?: string;
  work_schedule?: string;
  work_start_time?: string;
  work_end_time?: string;
  work_location_type?: string;
  remote_work_possible?: string;
  salary_min?: number;
  salary_max?: number;
  salary_type?: string;
  salary_transparency?: string;
  positions_count?: number;
  occupation?: string;
  workplace_name?: string;
  workplace_city?: string;
  workplace_county?: string;
  workplace_municipality?: string;
  workplace_address?: string;
  workplace_postal_code?: string;
  contact_email?: string;
}

interface SwipeJobDetailProps {
  job: SwipeJob;
  open: boolean;
  onClose: () => void;
  onApply: () => void;
  hasApplied: boolean;
}

const DISMISS_THRESHOLD = 100;

export function SwipeJobDetail({ job, open, onClose, onApply, hasApplied }: SwipeJobDetailProps) {
  const { user } = useAuth();
  const [detail, setDetail] = useState<FullJobData | null>(null);
  const [loading, setLoading] = useState(false);
  const viewRecorded = useRef<string | null>(null);
  const openedAtRef = useRef(0);

  // Drag-to-dismiss state
  const dragY = useMotionValue(0);
  const sheetControls = useAnimation();
  const dragStartY = useRef(0);
  const isDraggingSheet = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const backdropOpacity = useTransform(dragY, [0, 300], [1, 0]);

  // Animated close helper — used by X button and backdrop
  const animatedClose = useCallback(() => {
    setDismissing(true);
    void sheetControls.start({
      y: '100%',
      transition: { type: 'spring', damping: 34, stiffness: 400, mass: 0.8 },
    });
    setTimeout(() => {
      onClose();
      setDismissing(false);
    }, 220);
  }, [onClose, sheetControls]);

  const handleBackdropDismiss = useCallback((event: MouseEvent<HTMLDivElement> | PointerEvent<HTMLDivElement>) => {
    if (Date.now() - openedAtRef.current < 420) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    animatedClose();
  }, [animatedClose]);

  const stopSheetPropagation = useCallback((event: MouseEvent<HTMLDivElement> | PointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
  }, []);

  // Handle drag-to-dismiss via touch on the handle area + when scrolled to top
  const handleTouchStart = useCallback((e: TouchEvent<HTMLDivElement>) => {
    const scrollTop = scrollRef.current?.scrollTop ?? 0;
    // Only allow drag-dismiss when content is scrolled to top
    if (scrollTop <= 0) {
      isDraggingSheet.current = true;
      dragStartY.current = e.touches[0].clientY;
      dragY.set(0);
    }
  }, [dragY]);

  const handleTouchMove = useCallback((e: TouchEvent<HTMLDivElement>) => {
    if (!isDraggingSheet.current) return;
    const dy = e.touches[0].clientY - dragStartY.current;
    if (dy > 0) {
      // Dragging down — apply with resistance
      dragY.set(dy * 0.8);
      // Prevent scroll while dragging sheet
      e.preventDefault();
    } else {
      // Dragging up — cancel sheet drag, let scroll take over
      isDraggingSheet.current = false;
      dragY.set(0);
    }
  }, [dragY]);

  const [dismissing, setDismissing] = useState(false);

  const handleTouchEnd = useCallback(() => {
    if (!isDraggingSheet.current) return;
    isDraggingSheet.current = false;
    const currentY = dragY.get();
    if (currentY > DISMISS_THRESHOLD) {
      setDismissing(true);
      void sheetControls.start({
        y: '100%',
        transition: { type: 'spring', damping: 34, stiffness: 400, mass: 0.8 },
      });
      setTimeout(() => {
        onClose();
        setDismissing(false);
      }, 220);
    } else {
      // Snap back with a satisfying bounce
      dragY.set(0);
      void sheetControls.start({
        y: 0,
        scale: 1,
        opacity: 1,
        transition: { type: 'spring', damping: 24, stiffness: 400 },
      });
    }
  }, [dragY, onClose, sheetControls]);

  // Handle-specific drag (always draggable regardless of scroll)
  const handleHandleTouchStart = useCallback((e: TouchEvent<HTMLDivElement>) => {
    isDraggingSheet.current = true;
    dragStartY.current = e.touches[0].clientY;
    dragY.set(0);
    e.stopPropagation();
  }, [dragY]);

  // Track view when swipe detail is opened
  useEffect(() => {
    if (open && job.id && user?.id && viewRecorded.current !== job.id) {
      viewRecorded.current = job.id;
      recordJobView(job.id, user.id);
    }
  }, [open, job.id, user?.id]);

  useEffect(() => {
    if (open) {
      openedAtRef.current = Date.now();
      dragY.set(0);
      void sheetControls.start({
        y: 0,
        transition: { type: 'spring', damping: 32, stiffness: 340, mass: 0.8 },
      });
    }
  }, [open, job.id, dragY, sheetControls]);

  useEffect(() => {
    if (!open) {
      setDetail(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    setDetail(null);
    setLoading(true);

    void (async () => {
      const { data } = await supabase
        .from('job_postings')
        .select(`
          description, requirements, pitch, benefits, employment_type,
          work_schedule, work_start_time, work_end_time,
          work_location_type, remote_work_possible,
          salary_min, salary_max, salary_type, salary_transparency,
          positions_count, occupation,
          workplace_name, workplace_city, workplace_county,
          workplace_municipality, workplace_address, workplace_postal_code,
          contact_email
        `)
        .eq('id', job.id)
        .single();

      if (cancelled) return;
      setDetail(data ?? null);
      setLoading(false);
    })().catch(() => {
      if (cancelled) return;
      setDetail(null);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [open, job.id]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop — smooth fade in synced with sheet slide */}
          <motion.div
            className="absolute inset-0 z-30 bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{ opacity: backdropOpacity }}
            onPointerDown={handleBackdropDismiss}
            onClick={handleBackdropDismiss}
          />

          {/* Sheet */}
          <motion.div
            className="absolute inset-x-0 bottom-0 z-40 max-h-[88vh] bg-parium-gradient rounded-t-3xl overflow-hidden flex flex-col will-change-transform"
            initial={{ y: '100%' }}
            animate={sheetControls}
            exit={{ y: '100%', transition: { type: 'spring', damping: 34, stiffness: 400, mass: 0.8 } }}
            transition={{ type: 'spring', damping: 32, stiffness: 340, mass: 0.8 }}
            style={{ y: dragY }}
            onPointerDown={stopSheetPropagation}
            onClick={stopSheetPropagation}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
          >
            {/* Drag handle — always draggable */}
            <div
              className="flex justify-center pt-3 pb-2 shrink-0 cursor-grab active:cursor-grabbing"
              onTouchStart={handleHandleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <div className="w-10 h-1.5 rounded-full bg-white/30" />
            </div>

            {/* Close */}
            <button
              onClick={animatedClose}
              className="absolute top-3 right-4 z-10 flex h-7 w-7 !min-h-0 !min-w-0 items-center justify-center overflow-hidden rounded-full bg-white/10 transition-all active:scale-90 md:hover:bg-white/20"
              aria-label="Stäng"
            >
              <X className="h-3.5 w-3.5 text-white" />
            </button>

            {/* Title header */}
            <div className="px-5 pb-3 shrink-0">
              <h2 className="text-xl font-bold text-white leading-tight tracking-tight">{job.title}</h2>
              <div className="flex items-center gap-2 mt-1 text-white/70 text-sm">
                <span>{job.company_name}</span>
                {job.location && (
                  <>
                    <span className="text-white/30">·</span>
                    <span>{job.location}</span>
                  </>
                )}
              </div>
            </div>

            {/* Content */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-4 pb-6 space-y-3"
              style={{ WebkitOverflowScrolling: 'touch' }}
              onTouchStart={handleTouchStart}
            >
              {loading ? (
                <div className="space-y-3">
                  <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 space-y-3">
                    <Skeleton className="h-4 w-24 bg-white/10" />
                    <Skeleton className="h-4 w-full bg-white/10" />
                    <Skeleton className="h-4 w-3/4 bg-white/10" />
                    <Skeleton className="h-4 w-full bg-white/10" />
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 space-y-2">
                    <Skeleton className="h-4 w-32 bg-white/10" />
                    <Skeleton className="h-4 w-48 bg-white/10" />
                    <Skeleton className="h-4 w-40 bg-white/10" />
                  </div>
                </div>
              ) : detail ? (
                <>
                  {/* 1. Om tjänsten (Description) */}
                  {detail.description && (
                    <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                      <h3 className="text-section-title mb-3">Om tjänsten</h3>
                      <p className="text-body whitespace-pre-wrap">{detail.description}</p>
                    </div>
                  )}

                  {/* 2. Detaljer om tjänsten */}
                  <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                    <h3 className="text-section-title mb-3">Detaljer om tjänsten</h3>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
                      {detail.employment_type && (
                        <div className="text-white text-sm">
                          <span className="mr-1.5">Anställning:</span>
                          <span className="font-medium">{getEmploymentTypeLabel(detail.employment_type)}</span>
                        </div>
                      )}

                      {detail.work_schedule && (
                        <div className="text-white text-sm">
                          <span className="mr-1.5">Schema:</span>
                          <span className="font-medium">{cap(detail.work_schedule)}</span>
                        </div>
                      )}

                      {job.location && (
                        <div className="text-white text-sm">
                          <span className="mr-1.5">Ort:</span>
                          <span className="font-medium">{cap(job.location)}</span>
                        </div>
                      )}

                      {detail.workplace_name && (
                        <div className="text-white text-sm">
                          <span className="mr-1.5">Bolagsnamn:</span>
                          <span className="font-medium">{cap(detail.workplace_name)}</span>
                        </div>
                      )}

                      {detail.workplace_address && (
                        <div className="text-white text-sm">
                          <span className="mr-1.5">Adress:</span>
                          <span className="font-medium">
                            {detail.workplace_address}
                            {detail.workplace_postal_code && `, ${detail.workplace_postal_code}`}
                            {detail.workplace_city && ` ${detail.workplace_city}`}
                            {detail.workplace_municipality && detail.workplace_municipality !== detail.workplace_city && ` (${detail.workplace_municipality})`}
                          </span>
                        </div>
                      )}

                      {detail.workplace_city && detail.workplace_city !== job.location && !detail.workplace_address && (
                        <div className="text-white text-sm">
                          <span className="mr-1.5">Stad:</span>
                          <span className="font-medium">
                            {detail.workplace_city}
                            {detail.workplace_municipality && detail.workplace_municipality !== detail.workplace_city ? `, ${detail.workplace_municipality}` : ''}
                            {detail.workplace_county ? `, ${detail.workplace_county}` : ''}
                          </span>
                        </div>
                      )}

                      {detail.workplace_municipality && !detail.workplace_address && (!detail.workplace_city || detail.workplace_city === job.location) && (
                        <div className="text-white text-sm">
                          <span className="mr-1.5">Kommun:</span>
                          <span className="font-medium">{detail.workplace_municipality}</span>
                        </div>
                      )}

                      {detail.work_location_type && (
                        <div className="text-white text-sm">
                          <span className="mr-1.5">Platstyp:</span>
                          <span className="font-medium">{getWorkLocationLabel(detail.work_location_type)}</span>
                        </div>
                      )}

                      {detail.remote_work_possible && detail.remote_work_possible !== 'no' && (
                        <div className="text-white text-sm">
                          <span className="mr-1.5">Distans:</span>
                          <span className="font-medium">{getRemoteWorkLabel(detail.remote_work_possible)}</span>
                        </div>
                      )}

                      {(detail.work_start_time || detail.work_end_time) && (
                        <div className="text-white text-sm">
                          <span className="mr-1.5">Arbetstid:</span>
                          <span className="font-medium">{detail.work_start_time} – {detail.work_end_time}</span>
                        </div>
                      )}

                      {detail.positions_count && detail.positions_count > 1 && (
                        <div className="text-white text-sm">
                          <span className="mr-1.5">Antal tjänster:</span>
                          <span className="font-medium">{detail.positions_count} st</span>
                        </div>
                      )}

                      {detail.occupation && (
                        <div className="text-white text-sm">
                          <span className="mr-1.5">Yrke:</span>
                          <span className="font-medium">{cap(detail.occupation)}</span>
                        </div>
                      )}

                      {formatSalary(detail.salary_min, detail.salary_max, detail.salary_type) && (
                        <div className="text-white text-sm col-span-2 pt-1">
                          <span className="mr-1.5">Lön:</span>
                          <span className="font-semibold">{formatSalary(detail.salary_min, detail.salary_max, detail.salary_type)}</span>
                          {detail.salary_type && (
                            <span className="text-white/70 ml-1.5 text-xs">({getSalaryTypeLabel(detail.salary_type)})</span>
                          )}
                        </div>
                      )}

                      {!formatSalary(detail.salary_min, detail.salary_max, detail.salary_type) && detail.salary_transparency && (
                        <div className="text-white text-sm">
                          <span className="mr-1.5">Lön:</span>
                          <span className="font-medium">{getSalaryTransparencyLabel(detail.salary_transparency)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 3. Förmåner */}
                  {detail.benefits && detail.benefits.length > 0 && (
                    <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                      <h3 className="text-section-title mb-3">Förmåner</h3>
                      <div className="flex flex-wrap gap-2">
                        {detail.benefits.map((benefit, index) => (
                          <Badge key={index} variant="secondary" className="text-xs bg-white/20 text-white border-white/30">
                            {getBenefitLabel(benefit)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : null}
            </div>

            {/* Apply CTA */}
            <div className="shrink-0 px-5 pb-5 pt-3 border-t border-white/10" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 1.25rem)' }}>
              <button
                onClick={onApply}
                disabled={hasApplied}
                className={`w-full h-14 rounded-2xl font-semibold text-base transition-all active:scale-[0.97] min-h-[44px] ${
                  hasApplied
                    ? 'bg-white/10 text-white/50 cursor-not-allowed'
                    : 'bg-secondary text-white shadow-lg shadow-secondary/30'
                }`}
              >
                {hasApplied ? 'Redan sökt' : 'Ansök nu'}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}