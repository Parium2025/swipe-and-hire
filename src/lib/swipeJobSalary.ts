import type { SwipeJob } from '@/components/swipe/types';
import { formatSalaryTransparencyValue, formatSwedishAmount } from '@/lib/salaryRange';

/**
 * Returnerar formaterad löne-text för swipe-kortets badge,
 * eller null om jobbet inte har lönedata att visa.
 *
 * Tidigare inlinad som IIFE på två ställen i JobSlide.tsx — extraherad
 * så att (a) logiken inte re-exekveras unödigt i renderfas, (b) en bugfix
 * sprids till båda korten (aktivt + nästa), (c) lättare att enhetstesta.
 */
export function getJobBadgeSalary(
  job: Pick<SwipeJob, 'salary_min' | 'salary_max' | 'salary_type' | 'salary_transparency'>
): string | null {
  const typeLabel =
    job.salary_type === 'monthly' || job.salary_type === 'fast'
      ? 'kr/mån'
      : job.salary_type === 'hourly' || job.salary_type === 'rorlig'
      ? 'kr/tim'
      : job.salary_type === 'fast-rorlig'
      ? 'kr/mån'
      : 'kr/mån';

  if (job.salary_transparency === 'after_interview') {
    return 'Lön efter intervju';
  }

  if (job.salary_min || job.salary_max) {
    if (job.salary_min && job.salary_max) {
      return `${formatSwedishAmount(job.salary_min)} – ${formatSwedishAmount(job.salary_max)} ${typeLabel}`;
    }
    const amount = job.salary_min || job.salary_max;
    return amount ? `Från ${formatSwedishAmount(amount)} ${typeLabel}` : null;
  }

  if (job.salary_transparency && /^\d/.test(job.salary_transparency)) {
    return formatSalaryTransparencyValue(job.salary_transparency, typeLabel);
  }

  return null;
}
