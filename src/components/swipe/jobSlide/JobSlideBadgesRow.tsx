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

  // 🚫 INGEN backdrop-blur här. Blur på pills över en bakgrundsbild som
  // laddar/animerar tvingar webbläsaren att resampla lagret varje frame →
  // synligt flimmer när kortet växlar jobb eller när bilden avkodas.
  // Solid mörk chip (bg-black/45) ger samma premium-läsbarhet utan
  // resampling — kompositeras en gång, klart.
  void blurClass;
  const pillClass =
    'px-3 py-1.5 rounded-full bg-black/45 border border-white/10 shadow-[0_1px_2px_rgba(0,0,0,0.35)]';
  const textClass = 'text-white text-xs font-semibold [text-shadow:0_1px_2px_rgba(0,0,0,0.5)]';

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
      {salaryText && (
        <div className={pillClass}>
          <span className={textClass}>{salaryText}</span>
        </div>
      )}
      <div className={pillClass}>
        <span className={textClass}>{dateParts.join(' • ')}</span>
      </div>
      {job.benefits && job.benefits.length > 0 && (
        <div className={`${pillClass} flex items-center gap-1.5`}>
          <Gift className="w-3 h-3 text-white" />
          <span className={textClass}>
            Förmåner{' '}
            {job.benefits.length <= 5
              ? `${job.benefits.length} st`
              : `${Math.floor(job.benefits.length / 5) * 5}+`}
          </span>
        </div>
      )}
      {job.applications_count > 0 && (
        <div className={`${pillClass} flex items-center gap-1.5`}>
          <Users className="w-3 h-3 text-white" />
          <span className={textClass}>{job.applications_count} sökande</span>
        </div>
      )}
    </div>
  );
});
