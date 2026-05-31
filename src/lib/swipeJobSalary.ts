import type { SwipeJob } from '@/components/swipe/types';

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
      return `${job.salary_min.toLocaleString('sv-SE')} – ${job.salary_max.toLocaleString('sv-SE')} ${typeLabel}`;
    }
    return `Från ${(job.salary_min || job.salary_max)!.toLocaleString('sv-SE')} ${typeLabel}`;
  }

  if (job.salary_transparency && /^\d/.test(job.salary_transparency)) {
    const match = job.salary_transparency.match(/^(\d+)\s*[-–]\s*(\d+)$/);
    if (match) {
      const min = parseInt(match[1], 10);
      const max = parseInt(match[2], 10);
      return `${min.toLocaleString('sv-SE')} – ${max.toLocaleString('sv-SE')} ${typeLabel}`;
    }
    return `${job.salary_transparency} ${typeLabel}`;
  }

  return null;
}
