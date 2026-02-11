import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MapPin, Building2, Clock, Briefcase, Gift, ChevronDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getEmploymentTypeLabel } from '@/lib/employmentTypes';
import { getBenefitLabel } from '@/types/jobWizard';
import { Skeleton } from '@/components/ui/skeleton';
import type { SwipeJob } from './SwipeCard';

interface FullJobData {
  description?: string;
  requirements?: string;
  pitch?: string;
  benefits?: string[];
  employment_type?: string;
  work_schedule?: string;
  salary_min?: number;
  salary_max?: number;
  salary_type?: string;
  positions_count?: number;
  workplace_city?: string;
  workplace_address?: string;
  contact_email?: string;
  company_logo_url?: string;
  company_description?: string;
}

interface SwipeJobDetailProps {
  job: SwipeJob;
  open: boolean;
  onClose: () => void;
  onApply: () => void;
  hasApplied: boolean;
}

export function SwipeJobDetail({ job, open, onClose, onApply, hasApplied }: SwipeJobDetailProps) {
  const [detail, setDetail] = useState<FullJobData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && !detail) {
      setLoading(true);
      supabase
        .from('job_postings')
        .select(`
          description, requirements, pitch, benefits, employment_type,
          work_schedule, salary_min, salary_max, salary_type,
          positions_count, workplace_city, workplace_address, contact_email,
          profiles!job_postings_employer_id_fkey (
            company_logo_url, company_description
          )
        `)
        .eq('id', job.id)
        .single()
        .then(({ data }) => {
          if (data) {
            const profile = data.profiles as any;
            setDetail({
              ...data,
              company_logo_url: profile?.company_logo_url,
              company_description: profile?.company_description,
            });
          }
          setLoading(false);
        });
    }
  }, [open, job.id, detail]);

  const formatSalary = (min?: number, max?: number, type?: string) => {
    if (!min && !max) return null;
    const suffix = type === 'hourly' ? 'kr/tim' : 'kr/mån';
    if (min && max) return `${min.toLocaleString('sv-SE')} – ${max.toLocaleString('sv-SE')} ${suffix}`;
    if (min) return `Från ${min.toLocaleString('sv-SE')} ${suffix}`;
    return `Upp till ${max!.toLocaleString('sv-SE')} ${suffix}`;
  };

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
            className="absolute inset-x-0 bottom-0 z-40 max-h-[85vh] bg-[hsl(215,30%,12%)] rounded-t-3xl overflow-hidden flex flex-col"
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

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-5 pb-6 space-y-5" style={{ WebkitOverflowScrolling: 'touch' }}>
              {/* Title + company */}
              <div className="space-y-1">
                <h2 className="text-xl font-bold text-white leading-tight">{job.title}</h2>
                <div className="flex items-center gap-2 text-white/70 text-sm">
                  <Building2 className="w-4 h-4 shrink-0" />
                  <span>{job.company_name}</span>
                </div>
                {job.location && (
                  <div className="flex items-center gap-2 text-white/60 text-sm">
                    <MapPin className="w-4 h-4 shrink-0" />
                    <span>{job.location}</span>
                  </div>
                )}
              </div>

              {loading ? (
                <div className="space-y-4">
                  <Skeleton className="h-4 w-3/4 bg-white/10" />
                  <Skeleton className="h-4 w-full bg-white/10" />
                  <Skeleton className="h-4 w-2/3 bg-white/10" />
                  <Skeleton className="h-20 w-full bg-white/10 rounded-xl" />
                </div>
              ) : detail ? (
                <>
                  {/* Quick info pills */}
                  <div className="flex flex-wrap gap-2">
                    {detail.employment_type && (
                      <span className="px-3 py-1.5 rounded-full bg-white/10 text-white/90 text-xs font-medium">
                        {getEmploymentTypeLabel(detail.employment_type)}
                      </span>
                    )}
                    {detail.work_schedule && (
                      <span className="px-3 py-1.5 rounded-full bg-white/10 text-white/90 text-xs font-medium">
                        <Clock className="w-3 h-3 inline mr-1" />
                        {detail.work_schedule}
                      </span>
                    )}
                    {detail.positions_count && detail.positions_count > 1 && (
                      <span className="px-3 py-1.5 rounded-full bg-white/10 text-white/90 text-xs font-medium">
                        <Briefcase className="w-3 h-3 inline mr-1" />
                        {detail.positions_count} tjänster
                      </span>
                    )}
                    {formatSalary(detail.salary_min, detail.salary_max, detail.salary_type) && (
                      <span className="px-3 py-1.5 rounded-full bg-green-500/20 text-green-300 text-xs font-medium">
                        {formatSalary(detail.salary_min, detail.salary_max, detail.salary_type)}
                      </span>
                    )}
                  </div>

                  {/* Pitch */}
                  {detail.pitch && (
                    <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                      <p className="text-white/90 text-sm leading-relaxed italic">"{detail.pitch}"</p>
                    </div>
                  )}

                  {/* Description */}
                  {detail.description && (
                    <div>
                      <h3 className="text-sm font-semibold text-white mb-2">Om tjänsten</h3>
                      <p className="text-white/70 text-sm leading-relaxed whitespace-pre-wrap">{detail.description}</p>
                    </div>
                  )}

                  {/* Requirements */}
                  {detail.requirements && (
                    <div>
                      <h3 className="text-sm font-semibold text-white mb-2">Krav</h3>
                      <p className="text-white/70 text-sm leading-relaxed whitespace-pre-wrap">{detail.requirements}</p>
                    </div>
                  )}

                  {/* Benefits */}
                  {detail.benefits && detail.benefits.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-white mb-2">Förmåner</h3>
                      <div className="flex flex-wrap gap-2">
                        {detail.benefits.map((b, i) => (
                          <span
                            key={i}
                            className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/80 text-xs"
                          >
                            <Gift className="w-3 h-3 inline mr-1 text-white/50" />
                            {getBenefitLabel(b)}
                          </span>
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
                className={`w-full h-14 rounded-2xl font-semibold text-base transition-all active:scale-[0.97] ${
                  hasApplied
                    ? 'bg-white/10 text-white/50 cursor-not-allowed'
                    : 'bg-green-500 text-white shadow-lg shadow-green-500/30'
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
