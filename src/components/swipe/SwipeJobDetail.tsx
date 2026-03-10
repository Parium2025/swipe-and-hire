import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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

export function SwipeJobDetail({ job, open, onClose, onApply, hasApplied }: SwipeJobDetailProps) {
  const { user } = useAuth();
  const [detail, setDetail] = useState<FullJobData | null>(null);
  const [loading, setLoading] = useState(false);
  const viewRecorded = useRef<string | null>(null);

  // Track view when swipe detail is opened
  useEffect(() => {
    if (open && job.id && user?.id && viewRecorded.current !== job.id) {
      viewRecorded.current = job.id;
      recordJobView(job.id, user.id);
    }
  }, [open, job.id, user?.id]);

  useEffect(() => {
    if (open && !detail) {
      setLoading(true);
      supabase
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
        .single()
        .then(({ data }) => {
          if (data) setDetail(data);
          setLoading(false);
        });
    }
  }, [open, job.id, detail]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 z-30 bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            className="absolute inset-x-0 bottom-0 z-40 max-h-[88vh] bg-parium-gradient rounded-t-3xl overflow-hidden flex flex-col"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 400 }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-2 shrink-0">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>

            {/* Close */}
            <button
              onClick={onClose}
              className="absolute top-3 right-4 z-10 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center active:scale-90 transition-transform"
              aria-label="Stäng"
            >
              <X className="w-4 h-4 text-white" />
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

            {/* Content — mirrors desktop JobView sections */}
            <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-3" style={{ WebkitOverflowScrolling: 'touch' }}>
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

                  {/* 2. Detaljer om tjänsten — kompakt faktaruta */}
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
