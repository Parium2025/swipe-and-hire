import { memo } from 'react';
import {
  capitalize as cap,
  getSalaryTypeLabel,
  formatSalary,
  getWorkLocationLabel,
  getRemoteWorkLabel,
  getSalaryTransparencyLabel,
} from '@/lib/jobViewHelpers';
import { getEmploymentTypeLabel } from '@/lib/employmentTypes';


interface JobViewDetailsProps {
  employmentType?: string;
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
    employmentType, workSchedule, location, workplaceName,
    workplaceAddress, workplacePostalCode, workplaceCity,
    workplaceMunicipality, workplaceCounty, workLocationType,
    remoteWorkPossible, workStartTime, workEndTime,
    positionsCount, occupation, salaryMin, salaryMax,
    salaryType, salaryTransparency, contactEmail, jobTitle,
  } = props;

  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 overflow-hidden">
      <h2 className="text-section-title mb-3">Detaljer om tjänsten</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
        {employmentType && (
          <div className="flex text-white text-sm">
            <span className="shrink-0 w-[110px]">Anställning:</span>
            <span className="font-medium">{getEmploymentTypeLabel(employmentType)}</span>
          </div>
        )}
        {workSchedule && (
          <div className="flex text-white text-sm">
            <span className="shrink-0 w-[110px]">Schema:</span>
            <span className="font-medium">{cap(workSchedule)}</span>
          </div>
        )}
        {location && (
          <div className="flex text-white text-sm">
            <span className="shrink-0 w-[110px]">Ort:</span>
            <span className="font-medium">{cap(location)}</span>
          </div>
        )}
        {workplaceName && (
          <div className="flex text-white text-sm">
            <span className="shrink-0 w-[110px]">Bolagsnamn:</span>
            <span className="font-medium">{cap(workplaceName)}</span>
          </div>
        )}
        {workplaceAddress && (
          <div className="flex text-white text-sm">
            <span className="shrink-0 w-[110px]">Adress:</span>
            <span className="font-medium">
              {workplaceAddress}
              {workplacePostalCode && `, ${workplacePostalCode}`}
              {workplaceCity && ` ${workplaceCity}`}
              {workplaceMunicipality && workplaceMunicipality !== workplaceCity && ` (${workplaceMunicipality})`}
            </span>
          </div>
        )}
        {workplaceCity && workplaceCity !== location && !workplaceAddress && (
          <div className="flex text-white text-sm">
            <span className="shrink-0 w-[110px]">Stad:</span>
            <span className="font-medium">
              {workplaceCity}
              {workplaceMunicipality && workplaceMunicipality !== workplaceCity ? `, ${workplaceMunicipality}` : ''}
              {workplaceCounty ? `, ${workplaceCounty}` : ''}
            </span>
          </div>
        )}
        {workplaceMunicipality && !workplaceAddress && (!workplaceCity || workplaceCity === location) && (
          <div className="flex text-white text-sm">
            <span className="shrink-0 w-[110px]">Kommun:</span>
            <span className="font-medium">{workplaceMunicipality}</span>
          </div>
        )}
        {workLocationType && (
          <div className="flex text-white text-sm">
            <span className="shrink-0 w-[110px]">Platstyp:</span>
            <span className="font-medium">{getWorkLocationLabel(workLocationType)}</span>
          </div>
        )}
        {remoteWorkPossible && remoteWorkPossible !== 'no' && (
          <div className="flex text-white text-sm">
            <span className="shrink-0 w-[110px]">Distans:</span>
            <span className="font-medium">{getRemoteWorkLabel(remoteWorkPossible)}</span>
          </div>
        )}
        {(workStartTime || workEndTime) && (
          <div className="flex items-center text-white text-sm">
            <span className="shrink-0 w-[110px]">Arbetstid:</span>
            <span className="font-medium">{workStartTime} – {workEndTime}</span>
          </div>
        )}
        <div className="flex text-white text-sm">
          <span className="shrink-0 w-[110px]">Antal tjänster:</span>
          <span className="font-medium">{(positionsCount || 1)} st</span>
        </div>
        {occupation && (
          <div className="flex text-white text-sm">
            <span className="shrink-0 w-[110px]">Yrke:</span>
            <span className="font-medium">{cap(occupation)}</span>
          </div>
        )}
        {formatSalary(salaryMin, salaryMax, salaryType) && (
          <div className="flex items-center text-white text-sm sm:col-span-2 pt-1">
            <span className="shrink-0 w-[110px] inline-flex items-center gap-1"><Banknote className="h-3.5 w-3.5 text-white/70" />Lön:</span>
            <span className="font-semibold">
              {formatSalary(salaryMin, salaryMax, salaryType)}
              {salaryType && (
                <span className="text-white/70 ml-1.5 text-xs">({getSalaryTypeLabel(salaryType)})</span>
              )}
            </span>
          </div>
        )}
        {!formatSalary(salaryMin, salaryMax, salaryType) && salaryTransparency && (
          <div className="flex items-center text-white text-sm">
            <span className="shrink-0 w-[110px] inline-flex items-center gap-1"><Banknote className="h-3.5 w-3.5 text-white/70" />Lön:</span>
            <span className="font-medium">{getSalaryTransparencyLabel(salaryTransparency)}</span>
          </div>
        )}
        {contactEmail && (
          <div className="flex text-white text-sm sm:col-span-2 pt-1">
            <span className="shrink-0 w-[110px]">Kontakt:</span>
            <a 
              href={`mailto:${contactEmail}?subject=Fråga om tjänsten: ${jobTitle}`}
              className="font-medium underline underline-offset-2 hover:text-white/80 transition-colors"
            >
              {contactEmail}
            </a>
          </div>
        )}
      </div>
    </div>
  );
});
