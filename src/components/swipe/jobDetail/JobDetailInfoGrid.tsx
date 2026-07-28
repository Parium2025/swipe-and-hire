import { memo } from 'react';
import { getEmploymentTypeLabel, formatEmploymentDetails } from '@/lib/employmentTypes';
import { TruncatedText } from '@/components/TruncatedText';
import {
  capitalize as cap,
  getSalaryTypeLabel,
  formatSalary,
  getWorkLocationLabel,
  getRemoteWorkLabel,
  getSalaryTransparencyLabel,
} from '@/lib/jobViewHelpers';
import type { SwipeJob } from '../types';
import type { FullJobData } from '../hooks/useJobDetailData';

interface JobDetailInfoGridProps {
  job: SwipeJob;
  detail: FullJobData;
  displayCompanyName: string;
}

/**
 * Presentational: "Detaljer om tjänsten"-gridden i SwipeJobDetail.
 * Ren extraktion — samma klasser, samma villkorslogik, samma ordning.
 */
export const JobDetailInfoGrid = memo(function JobDetailInfoGrid({
  job,
  detail,
  displayCompanyName,
}: JobDetailInfoGridProps) {
  const salaryStr = formatSalary(detail.salary_min, detail.salary_max, detail.salary_type);

  return (
    <div className="bg-white/10 rounded-lg p-4 overflow-hidden">
      <h3 className="text-white font-semibold text-[17px] sm:text-base mb-3 tracking-[-0.01em]">Detaljer om tjänsten</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
        {detail.employment_type && (
          <div className="flex text-white text-[15px] sm:text-sm sm:col-span-2">
            <span className="shrink-0 w-[110px] text-white">Anställning:</span>
            <span className="font-medium min-w-0 flex-1 [overflow-wrap:anywhere]">
              {[
                getEmploymentTypeLabel(detail.employment_type),
                formatEmploymentDetails({
                  employment_type: detail.employment_type,
                  part_time_days: detail.part_time_days,
                  part_time_shifts: detail.part_time_shifts,
                  duration_amount: detail.duration_amount,
                  duration_unit: detail.duration_unit,
                }),
              ].filter(Boolean).join(' · ')}
            </span>
          </div>
        )}

        {detail.work_schedule && (
          <div className="flex text-white text-[15px] sm:text-sm">
            <span className="shrink-0 w-[110px] text-white">Schema:</span>
            <span className="font-medium">{cap(detail.work_schedule)}</span>
          </div>
        )}

        {job.location && (
          <div className="flex text-white text-[15px] sm:text-sm">
            <span className="shrink-0 w-[110px] text-white">Ort:</span>
            <span className="font-medium">{cap(job.location)}</span>
          </div>
        )}

        {displayCompanyName && (
          <div className="flex text-white text-[15px] sm:text-sm min-w-0">
            <span className="shrink-0 w-[110px] text-white">Bolagsnamn:</span>
            <TruncatedText
              text={cap(displayCompanyName)}
              className="font-medium min-w-0 flex-1 [overflow-wrap:anywhere]"
              tooltipSide="top"
              style={{
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            />
          </div>
        )}

        {detail.workplace_address && (
          <div className="flex text-white text-[15px] sm:text-sm">
            <span className="shrink-0 w-[110px] text-white">Adress:</span>
            <span className="font-medium">
              {detail.workplace_address}
              {detail.workplace_postal_code && `, ${detail.workplace_postal_code}`}
              {detail.workplace_city && ` ${detail.workplace_city}`}
              {detail.workplace_municipality && detail.workplace_municipality !== detail.workplace_city && ` (${detail.workplace_municipality})`}
            </span>
          </div>
        )}

        {detail.workplace_city && detail.workplace_city !== job.location && !detail.workplace_address && (
          <div className="flex text-white text-[15px] sm:text-sm">
            <span className="shrink-0 w-[110px] text-white">Stad:</span>
            <span className="font-medium">
              {detail.workplace_city}
              {detail.workplace_municipality && detail.workplace_municipality !== detail.workplace_city ? `, ${detail.workplace_municipality}` : ''}
              {detail.workplace_county ? `, ${detail.workplace_county}` : ''}
            </span>
          </div>
        )}

        {detail.workplace_municipality && !detail.workplace_address && (!detail.workplace_city || detail.workplace_city === job.location) && (
          <div className="flex text-white text-[15px] sm:text-sm">
            <span className="shrink-0 w-[110px] text-white">Kommun:</span>
            <span className="font-medium">{detail.workplace_municipality}</span>
          </div>
        )}

        {detail.work_location_type && (
          <div className="flex text-white text-[15px] sm:text-sm">
            <span className="shrink-0 w-[110px] text-white">Platstyp:</span>
            <span className="font-medium">{getWorkLocationLabel(detail.work_location_type)}</span>
          </div>
        )}

        {detail.remote_work_possible && detail.remote_work_possible !== 'no' && (
          <div className="flex text-white text-[15px] sm:text-sm">
            <span className="shrink-0 w-[110px] text-white">Distans:</span>
            <span className="font-medium">{getRemoteWorkLabel(detail.remote_work_possible)}</span>
          </div>
        )}

        {(detail.work_start_time || detail.work_end_time) && (
          <div className="flex items-center text-white text-[15px] sm:text-sm">
            <span className="shrink-0 w-[110px] text-white">Arbetstid:</span>
            <span className="font-medium">{detail.work_start_time} – {detail.work_end_time}</span>
          </div>
        )}


        {detail.positions_count && detail.positions_count > 1 && (
          <div className="flex text-white text-[15px] sm:text-sm">
            <span className="shrink-0 w-[110px] text-white">Antal tjänster:</span>
            <span className="font-medium">{detail.positions_count} st</span>
          </div>
        )}

        {detail.occupation && (
          <div className="flex text-white text-[15px] sm:text-sm">
            <span className="shrink-0 w-[110px] text-white">Yrke:</span>
            <span className="font-medium">{cap(detail.occupation)}</span>
          </div>
        )}

        {salaryStr ? (
          <div className="flex items-center text-white text-[15px] sm:text-sm sm:col-span-2 pt-1">
            <span className="shrink-0 w-[110px] text-white">Lön:</span>
            <span className="font-semibold">
              {salaryStr}
              {detail.salary_type && (
                <span className="text-white ml-1.5 text-[13px] sm:text-xs">({getSalaryTypeLabel(detail.salary_type)})</span>
              )}
            </span>
          </div>
        ) : detail.salary_transparency ? (
          <div className="flex items-center text-white text-[15px] sm:text-sm">
            <span className="shrink-0 w-[110px] text-white">Lön:</span>
            <span className="font-medium">{getSalaryTransparencyLabel(detail.salary_transparency)}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
});
