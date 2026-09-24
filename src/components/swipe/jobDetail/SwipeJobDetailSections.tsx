import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { getBenefitLabel, type JobQuestion } from '@/types/jobWizard';
import type { SwipeJob } from '../types';
import type { FullJobData } from '../hooks/useJobDetailData';
import { JobDetailInfoGrid } from './JobDetailInfoGrid';
import { JobDetailQuestions } from './JobDetailQuestions';

interface SwipeJobDetailSectionsProps {
  job: SwipeJob;
  detail: FullJobData;
  displayCompanyName: string;
  questions: (JobQuestion & { id: string })[];
  myAnswers?: Record<string, unknown> | null;
  hasApplied?: boolean;
}

function DescriptionSection({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const needsTruncation = text.length > 300;

  return (
    <div className="bg-white/10 rounded-lg p-4">
      <h3 className="text-white font-semibold text-[17px] sm:text-base mb-3">Om tjänsten</h3>
      <p className={`text-white text-[15px] sm:text-sm leading-[1.6] sm:leading-relaxed whitespace-pre-wrap ${!expanded && needsTruncation ? 'line-clamp-6' : ''}`}>
        {text}
      </p>
      {needsTruncation && (
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="mt-2 text-[15px] sm:text-sm font-medium text-white transition-colors md:hover:text-white"
        >
          {expanded ? 'Visa mindre' : 'Visa mer'}
        </button>
      )}
    </div>
  );
}

/** Samma innehållskälla för riktig Swipe Mode-detalj och wizardens mobilförhandsvisning. */
export function SwipeJobDetailSections({
  job,
  detail,
  displayCompanyName,
  questions,
  myAnswers = null,
  hasApplied = false,
}: SwipeJobDetailSectionsProps) {
  return (
    <>
      {detail.description && <DescriptionSection text={detail.description} />}
      <JobDetailInfoGrid job={job} detail={detail} displayCompanyName={displayCompanyName} />

      {detail.benefits && detail.benefits.length > 0 && (
        <div className="bg-white/10 rounded-lg p-4">
          <h3 className="text-white font-semibold text-[17px] sm:text-base mb-3">Förmåner</h3>
          <div className="flex flex-wrap gap-2">
            {detail.benefits.map((benefit, index) => (
              <Badge key={`${benefit}-${index}`} variant="secondary" className="text-[13px] sm:text-xs bg-white/20 text-white border-white/30">
                {getBenefitLabel(benefit)}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {detail.pitch && (
        <div className="bg-white/10 rounded-lg p-4">
          <h3 className="text-white font-semibold text-[17px] sm:text-base mb-3">Varför jobba hos oss?</h3>
          <p className="text-white text-[15px] sm:text-sm leading-[1.6] sm:leading-relaxed whitespace-pre-wrap">{detail.pitch}</p>
        </div>
      )}

      {detail.requirements && (
        <div className="bg-white/10 rounded-lg p-4">
          <h3 className="text-white font-semibold text-[17px] sm:text-base mb-3">Krav & kvalifikationer</h3>
          <p className="text-white text-[15px] sm:text-sm leading-[1.6] sm:leading-relaxed whitespace-pre-wrap">{detail.requirements}</p>
        </div>
      )}

      <JobDetailQuestions questions={questions} myAnswers={myAnswers} hasApplied={hasApplied} />

      {detail.application_instructions && (
        <div className="bg-white/10 rounded-lg p-4">
          <h3 className="text-white font-semibold text-[17px] sm:text-base mb-3">Ansökningsinstruktioner</h3>
          <p className="text-white text-[15px] sm:text-sm leading-[1.6] sm:leading-relaxed whitespace-pre-wrap">{detail.application_instructions}</p>
        </div>
      )}

      {detail.contact_email && (
        <div className="bg-white/10 rounded-lg p-4">
          <h3 className="text-white font-semibold text-[17px] sm:text-base mb-3">Kontakt</h3>
          <p className="text-white text-[15px] sm:text-sm break-all">{detail.contact_email}</p>
        </div>
      )}
    </>
  );
}