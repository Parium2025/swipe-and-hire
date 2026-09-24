import type { ReactNode } from 'react';
import { Users } from 'lucide-react';
import { CompanyLogoAvatar } from '@/components/jobview/CompanyLogoAvatar';
import { JobViewBenefits } from '@/components/jobview/JobViewBenefits';
import { JobViewDetails } from '@/components/jobview/JobViewDetails';
import { JobViewHero } from '@/components/jobview/JobViewHero';
import { TruncatedText } from '@/components/TruncatedText';

export interface JobPostingContentData {
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  fallbackImageUrl?: string | null;
  imageFocusPosition?: string | null;
  companyName: string;
  companyLogoUrl?: string | null;
  location?: string | null;
  employmentType?: string | null;
  partTimeDays?: string[] | null;
  partTimeShifts?: string[] | null;
  durationAmount?: number | null;
  durationUnit?: string | null;
  workSchedule?: string | null;
  workplaceAddress?: string | null;
  workplacePostalCode?: string | null;
  workplaceCity?: string | null;
  workplaceMunicipality?: string | null;
  workplaceCounty?: string | null;
  workLocationType?: string | null;
  remoteWorkPossible?: string | null;
  workStartTime?: string | null;
  workEndTime?: string | null;
  startDate?: string | null;
  positionsCount?: number | null;
  occupation?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryType?: string | null;
  salaryTransparency?: string | null;
  contactEmail?: string | null;
  benefits?: string[] | null;
  createdAt?: string | null;
  expiresAt?: string | null;
  overlayTextColor?: string | null;
}

interface JobPostingContentProps {
  data: JobPostingContentData;
  onOpenCompany?: () => void;
  afterDetails?: ReactNode;
  compact?: boolean;
}

/** The single visual source for an opened job, including wizard previews. */
export function JobPostingContent({ data, onOpenCompany, afterDetails, compact = false }: JobPostingContentProps) {
  const content = (
    <div className="space-y-3">
      {data.imageUrl && (
        <JobViewHero
          title={data.title}
          imageUrl={data.imageUrl}
          fallbackImageUrl={data.fallbackImageUrl}
          companyName={data.companyName}
          location={data.location || undefined}
          employmentType={data.employmentType || undefined}
          positionsCount={data.positionsCount || undefined}
          companyLogoUrl={data.companyLogoUrl}
          salaryMin={data.salaryMin}
          salaryMax={data.salaryMax}
          salaryType={data.salaryType}
          salaryTransparency={data.salaryTransparency}
          benefits={data.benefits}
          createdAt={data.createdAt || undefined}
          expiresAt={data.expiresAt}
          overlayTextColor={data.overlayTextColor}
          focusPosition={data.imageFocusPosition}
        />
      )}

      <div className="bg-white/10 backdrop-blur-sm rounded-lg px-4 py-4 overflow-hidden space-y-3">
        <button
          type="button"
          onClick={onOpenCompany}
          className="flex flex-col items-center gap-2 w-full cursor-pointer [@media(hover:hover)]:hover:bg-white/10 active:bg-white/15 p-2 rounded-xl transition-all"
          aria-label="Visa företagsprofil"
        >
          <CompanyLogoAvatar logoUrl={data.companyLogoUrl} companyName={data.companyName} />
          <div className="min-w-0 w-full overflow-hidden text-center flex flex-col items-center">
            <TruncatedText
              text={data.companyName}
              tooltipSide="bottom"
              className="block w-full overflow-hidden text-base font-bold leading-tight text-white line-clamp-2 text-center [overflow-wrap:anywhere]"
            />
            <div className="flex items-center justify-center text-xs mt-0.5 text-white">
              <Users className="h-3 w-3 mr-1 text-white" />
              Se företagsprofil
            </div>
          </div>
        </button>
        <h1
          className="text-center font-bold text-lg sm:text-xl md:text-2xl leading-snug break-words [overflow-wrap:anywhere]"
          style={{ color: data.overlayTextColor || '#FACC15' }}
          title={data.title}
        >
          {data.title}
        </h1>
      </div>

      {data.description && (
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 overflow-hidden">
          <h2 className="text-section-title mb-3">Om tjänsten</h2>
          <p className="text-body whitespace-pre-wrap break-words overflow-hidden">{data.description}</p>
        </div>
      )}

      <JobViewDetails
        employmentType={data.employmentType || undefined}
        partTimeDays={data.partTimeDays}
        partTimeShifts={data.partTimeShifts}
        durationAmount={data.durationAmount}
        durationUnit={data.durationUnit}
        workSchedule={data.workSchedule || undefined}
        location={data.location || undefined}
        workplaceName={data.companyName}
        workplaceAddress={data.workplaceAddress || undefined}
        workplacePostalCode={data.workplacePostalCode || undefined}
        workplaceCity={data.workplaceCity || undefined}
        workplaceMunicipality={data.workplaceMunicipality || undefined}
        workplaceCounty={data.workplaceCounty || undefined}
        workLocationType={data.workLocationType || undefined}
        remoteWorkPossible={data.remoteWorkPossible || undefined}
        workStartTime={data.workStartTime || undefined}
        workEndTime={data.workEndTime || undefined}
        startDate={data.startDate}
        positionsCount={data.positionsCount || undefined}
        occupation={data.occupation || undefined}
        salaryMin={data.salaryMin || undefined}
        salaryMax={data.salaryMax || undefined}
        salaryType={data.salaryType || undefined}
        salaryTransparency={data.salaryTransparency || undefined}
        contactEmail={data.contactEmail || undefined}
        jobTitle={data.title}
      />
      <JobViewBenefits benefits={data.benefits || []} />
      {afterDetails}
    </div>
  );

  if (!compact) return content;

  return (
    <div className="origin-top-left w-[400%] scale-25 [&_.text-section-title]:text-base [&_.text-body]:text-sm">
      {content}
    </div>
  );
}