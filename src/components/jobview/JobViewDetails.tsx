import { memo } from 'react';
import { TruncatedText } from '@/components/TruncatedText';
import {
  capitalize as cap,
  getSalaryTypeLabel,
  formatSalary,
  getWorkLocationLabel,
  getRemoteWorkLabel,
  getSalaryTransparencyLabel,
} from '@/lib/jobViewHelpers';
import { getEmploymentTypeLabel, formatEmploymentDetails } from '@/lib/employmentTypes';


interface JobViewDetailsProps {
  employmentType?: string;
  partTimeDays?: string[] | null;
  partTimeShifts?: string[] | null;
  durationAmount?: number | null;
  durationUnit?: string | null;
  workSchedule?: string;
  location?: string;
  workplaceName?: string;
  workplaceAddress?: string;
  workplacePostalCode?: string;
  workplaceCity?: string;
  workplaceMunicipality?: string;
  workplaceCounty?: string;
  workLocationType?: string;
  remoteWorkPossible?: string;
  workStartTime?: string;
  workEndTime?: string;
  positionsCount?: number;
  occupation?: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryType?: string;
  salaryTransparency?: string;
  contactEmail?: string;
  jobTitle: string;
}

export const JobViewDetails = memo(function JobViewDetails(props: JobViewDetailsProps) {
  const {
    employmentType, partTimeDays, partTimeShifts, durationAmount, durationUnit,
    workSchedule, location, workplaceName,
    workplaceAddress, workplacePostalCode, workplaceCity,
    workplaceMunicipality, workplaceCounty, workLocationType,
    remoteWorkPossible, workStartTime, workEndTime,
    positionsCount, occupation, salaryMin, salaryMax,
    salaryType, salaryTransparency, contactEmail, jobTitle,
  } = props;

  // Arbetsgivar-preview-stil: label v\u00e4nster (dimmad), v\u00e4rde h\u00f6gerjusterat (vitt),
  // tunn avdelare mellan raderna. En kolumn, ren och stram.
  const rowClass =
    'flex items-start justify-between gap-4 py-2.5 border-b border-white/10 last:border-b-0 text-[15px] sm:text-sm';
  const labelClass = 'shrink-0 text-white font-normal';
  const valueClass = 'text-right font-medium text-white min-w-0 [overflow-wrap:anywhere]';

  const employmentValue = employmentType
    ? [
        getEmploymentTypeLabel(employmentType),
        formatEmploymentDetails({
          employment_type: employmentType,
          part_time_days: partTimeDays,
          part_time_shifts: partTimeShifts,
          duration_amount: durationAmount,
          duration_unit: durationUnit,
        }),
      ]
        .filter(Boolean)
        .join(' · ')
    : null;

  const salaryValue = formatSalary(salaryMin, salaryMax, salaryType);

  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 overflow-hidden">
      <h2 className="text-section-title mb-2">Detaljer om tjänsten</h2>
      <div className="flex flex-col">
        {employmentValue && (
          <div className={rowClass}>
            <span className={labelClass}>Anställning</span>
            <span className={valueClass}>{employmentValue}</span>
          </div>
        )}
        {workSchedule && (
          <div className={rowClass}>
            <span className={labelClass}>Schema</span>
            <span className={valueClass}>{cap(workSchedule)}</span>
          </div>
        )}
        {location && (
          <div className={rowClass}>
            <span className={labelClass}>Ort</span>
            <span className={valueClass}>{cap(location)}</span>
          </div>
        )}
        {workplaceName && (
          <div className={rowClass}>
            <span className={labelClass}>Bolagsnamn</span>
            <TruncatedText
              text={cap(workplaceName) as string}
              className={valueClass}
              style={{
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            />
          </div>
        )}
        {workplaceAddress && (
          <div className={rowClass}>
            <span className={labelClass}>Adress</span>
            <span className={valueClass}>
              {workplaceAddress}
              {workplacePostalCode && `, ${workplacePostalCode}`}
              {workplaceCity && ` ${workplaceCity}`}
              {workplaceMunicipality && workplaceMunicipality !== workplaceCity && ` (${workplaceMunicipality})`}
            </span>
          </div>
        )}
        {workplaceCity && workplaceCity !== location && !workplaceAddress && (
          <div className={rowClass}>
            <span className={labelClass}>Stad</span>
            <span className={valueClass}>
              {workplaceCity}
              {workplaceMunicipality && workplaceMunicipality !== workplaceCity ? `, ${workplaceMunicipality}` : ''}
              {workplaceCounty ? `, ${workplaceCounty}` : ''}
            </span>
          </div>
        )}
        {workplaceMunicipality && !workplaceAddress && (!workplaceCity || workplaceCity === location) && (
          <div className={rowClass}>
            <span className={labelClass}>Kommun</span>
            <span className={valueClass}>{workplaceMunicipality}</span>
          </div>
        )}
        {workLocationType && (
          <div className={rowClass}>
            <span className={labelClass}>Platstyp</span>
            <span className={valueClass}>{getWorkLocationLabel(workLocationType)}</span>
          </div>
        )}
        {remoteWorkPossible && remoteWorkPossible !== 'no' && (
          <div className={rowClass}>
            <span className={labelClass}>Distans</span>
            <span className={valueClass}>{getRemoteWorkLabel(remoteWorkPossible)}</span>
          </div>
        )}
        {(workStartTime || workEndTime) && (
          <div className={rowClass}>
            <span className={labelClass}>Arbetstid</span>
            <span className={valueClass}>{workStartTime} – {workEndTime}</span>
          </div>
        )}
        <div className={rowClass}>
          <span className={labelClass}>Antal tjänster</span>
          <span className={valueClass}>{(positionsCount || 1)} st</span>
        </div>
        {occupation && (
          <div className={rowClass}>
            <span className={labelClass}>Yrke</span>
            <span className={valueClass}>{cap(occupation)}</span>
          </div>
        )}
        {salaryValue && (
          <div className={rowClass}>
            <span className={labelClass}>Lön</span>
            <span className={valueClass}>
              <span className="font-semibold">{salaryValue}</span>
              {salaryType && (
                <span className="text-white ml-1.5 text-[13px] sm:text-xs">({getSalaryTypeLabel(salaryType)})</span>
              )}
            </span>
          </div>
        )}
        {!salaryValue && salaryTransparency && (
          <div className={rowClass}>
            <span className={labelClass}>Lön</span>
            <span className={valueClass}>{getSalaryTransparencyLabel(salaryTransparency)}</span>
          </div>
        )}
        {contactEmail && (
          <div className={rowClass}>
            <span className={labelClass}>Kontakt</span>
            <a
              href={`mailto:${contactEmail}?subject=Fråga om tjänsten: ${jobTitle}`}
              className={`${valueClass} underline underline-offset-2 hover:text-white/80 transition-colors`}
            >
              {contactEmail}
            </a>
          </div>
        )}
      </div>
    </div>
  );
});
