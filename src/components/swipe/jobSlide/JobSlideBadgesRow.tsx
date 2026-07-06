import { memo } from 'react';
import { differenceInDays, format, parseISO } from 'date-fns';
import { sv } from 'date-fns/locale';
import { Gift, Users } from 'lucide-react';
import type { SwipeJob } from '../types';
import { getJobBadgeSalary } from '@/lib/swipeJobSalary';

interface JobSlideBadgesRowProps {
  job: SwipeJob;
  /**
   * Klass för backdrop-blur. På aktivt kort villkoras den av att bilden
   * har laddats (iOS WebKit-bugg — se JobSlide.tsx). På next-underlay
   * skickas alltid 'backdrop-blur-md' in.
   */
  blurClass: string;
}

/**
 * Den identiska 4-badge-raden som renderas på både det aktiva kortet och
 * next-card-underlay. Bryts ut för att garantera visuell paritet mellan
 * de två — allt annat än `blurClass` är hårdlåst.
 */
export const JobSlideBadgesRow = memo(function JobSlideBadgesRow({
  job,
  blurClass,
}: JobSlideBadgesRowProps) {
  const salaryText = getJobBadgeSalary(job);
  const publishedDate = format(parseISO(job.created_at), 'd MMM', { locale: sv });
  const daysLeft = job.expires_at
    ? differenceInDays(parseISO(job.expires_at), new Date())
    : null;
  const dateParts: string[] = [`Publicerad ${publishedDate}`];
  if (daysLeft !== null && daysLeft >= 0) {
    dateParts.push(daysLeft === 0 ? 'Sista dagen' : `${daysLeft} dagar kvar`);
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
      {salaryText && (
        <div
          className={`px-3 py-1.5 rounded-full bg-white/10 ${blurClass} border border-white/15 transform-gpu [will-change:transform]`}
        >
          <span className="text-white text-xs font-semibold">{salaryText}</span>
        </div>
      )}
      <div
        className={`px-3 py-1.5 rounded-full bg-white/10 ${blurClass} border border-white/15 transform-gpu [will-change:transform]`}
      >
        <span className="text-white text-xs font-semibold">
          {dateParts.join(' • ')}
        </span>
      </div>
      {job.benefits && job.benefits.length > 0 && (
        <div
          className={`px-3 py-1.5 rounded-full bg-white/10 ${blurClass} border border-white/15 transform-gpu [will-change:transform] flex items-center gap-1.5`}
        >
          <Gift className="w-3 h-3 text-white" />
          <span className="text-white text-xs font-semibold">
            Förmåner{' '}
            {job.benefits.length <= 5
              ? `${job.benefits.length} st`
              : `${Math.floor(job.benefits.length / 5) * 5}+`}
          </span>
        </div>
      )}
      {job.applications_count > 0 && (
        <div
          className={`px-3 py-1.5 rounded-full bg-white/10 ${blurClass} border border-white/15 transform-gpu [will-change:transform] flex items-center gap-1.5`}
        >
          <Users className="w-3 h-3 text-white" />
          <span className="text-white text-xs font-semibold">
            {job.applications_count} sökande
          </span>
        </div>
      )}
    </div>
  );
});
