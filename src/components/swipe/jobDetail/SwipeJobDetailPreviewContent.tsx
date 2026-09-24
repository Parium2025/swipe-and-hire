import { TruncatedText } from '@/components/TruncatedText';
import { Button } from '@/components/ui/button';
import type { JobPostingContentData } from '@/components/jobview/JobPostingContent';
import type { JobQuestion } from '@/types/jobWizard';
import type { FullJobData } from '../hooks/useJobDetailData';
import type { SwipeJob } from '../types';
import { SwipeJobDetailSections } from './SwipeJobDetailSections';

interface SwipeJobDetailPreviewContentProps {
  data: JobPostingContentData;
  questions: JobQuestion[];
}

export function SwipeJobDetailPreviewContent({ data, questions }: SwipeJobDetailPreviewContentProps) {
  const resolvedQuestions = questions.map((question, index) => ({
    ...question,
    id: question.id || `preview-question-${index}`,
  }));
  const job: SwipeJob = {
    id: 'preview',
    title: data.title,
    company_name: data.companyName,
    workplace_name: data.companyName,
    location: data.workplaceCity || data.location || '',
    employment_type: data.employmentType || undefined,
    duration_amount: data.durationAmount,
    duration_unit: data.durationUnit,
    part_time_days: data.partTimeDays,
    part_time_shifts: data.partTimeShifts,
    views_count: 0,
    applications_count: 0,
    created_at: data.createdAt || new Date().toISOString(),
  };
  const detail: FullJobData = {
    description: data.description || undefined,
    requirements: data.requirements || undefined,
    pitch: data.pitch || undefined,
    benefits: data.benefits || undefined,
    employment_type: data.employmentType || undefined,
    part_time_days: data.partTimeDays,
    part_time_shifts: data.partTimeShifts,
    duration_amount: data.durationAmount,
    duration_unit: data.durationUnit,
    work_schedule: data.workSchedule || undefined,
    work_start_time: data.workStartTime || undefined,
    work_end_time: data.workEndTime || undefined,
    work_location_type: data.workLocationType || undefined,
    remote_work_possible: data.remoteWorkPossible || undefined,
    salary_min: data.salaryMin || undefined,
    salary_max: data.salaryMax || undefined,
    salary_type: data.salaryType || undefined,
    salary_transparency: data.salaryTransparency || undefined,
    positions_count: data.positionsCount || undefined,
    occupation: data.occupation || undefined,
    workplace_name: data.companyName,
    workplace_city: data.workplaceCity || data.location || undefined,
    workplace_county: data.workplaceCounty || undefined,
    workplace_municipality: data.workplaceMunicipality || undefined,
    workplace_address: data.workplaceAddress || undefined,
    workplace_postal_code: data.workplacePostalCode || undefined,
    contact_email: data.contactEmail || undefined,
    application_instructions: data.applicationInstructions || undefined,
    start_date: data.startDate,
  };

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div className="absolute left-0 top-0 flex h-[780px] w-[380px] origin-top-left scale-[0.4] flex-col md:h-[785px] md:w-[385px] md:scale-[0.55]">
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6 pt-2 space-y-3 touch-pan-y">
          <div className="px-1 pr-12 pb-1">
            <div className="flex items-start gap-2 mt-1 text-white text-[15px] sm:text-sm min-w-0">
              <TruncatedText text={data.companyName} className="font-medium min-w-0 max-w-full line-clamp-2" tooltipSide="bottom" />
              {job.location && <><span className="text-white/50 shrink-0">·</span><span className="shrink-0">{job.location}</span></>}
            </div>
            <TruncatedText text={data.title} className="text-xl font-bold text-white leading-[1.2] mt-0.5 line-clamp-2 pb-[0.12em]" tooltipSide="bottom" />
          </div>
          <SwipeJobDetailSections job={job} detail={detail} displayCompanyName={data.companyName} questions={resolvedQuestions} />
        </div>
        <div className="shrink-0 px-5 pb-5 pt-3 border-t border-white/10 bg-parium-gradient">
          <Button type="button" className="w-full h-14 rounded-full bg-green-500 text-white font-semibold text-base shadow-lg shadow-green-500/30 md:hover:bg-green-500">
            Skicka ansökan
          </Button>
        </div>
      </div>
    </div>
  );
}