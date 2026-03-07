import { Mail, Phone, MapPin, Calendar, Briefcase, FileText, User, ChevronDown, ChevronUp, ExternalLink, Loader2 } from 'lucide-react';
import { SectionErrorBoundary, CandidateSummarySection } from '@/components/candidateProfile';
import type { ApplicationData } from '@/hooks/useApplicationsData';
import type { CandidateSummaryCacheValue } from '@/components/candidateProfile/candidateProfileCache';

const employmentStatusLabels: Record<string, string> = {
  tillsvidareanställning: 'Fast anställning',
  visstidsanställning: 'Visstidsanställning',
  provanställning: 'Provanställning',
  interim: 'Interim anställning',
  arbetssokande: 'Arbetssökande',
};

const workScheduleLabels: Record<string, string> = {
  heltid: 'Heltid',
  deltid: 'Deltid',
  timanställning: 'Timanställning',
};

const availabilityLabels: Record<string, string> = {
  omgaende: 'Omgående',
  'inom-1-manad': 'Inom 1 månad',
  'inom-3-manader': 'Inom 3 månader',
  'inom-6-manader': 'Inom 6 månader',
  'ej-aktuellt': 'Inte aktuellt just nu',
  osaker: 'Osäker',
};

interface ProfileInfoSectionsProps {
  displayApp: ApplicationData;
  jobQuestions: Record<string, { text: string; order: number }>;
  questionsExpanded: boolean;
  onToggleQuestions: () => void;
  summaryHook: {
    aiSummary: CandidateSummaryCacheValue | null;
    loadingSummary: boolean;
    generatingSummary: boolean;
  };
  signedCvUrl: string | null;
  onOpenCv: () => void;
}

export const ProfileInfoSections = ({
  displayApp,
  jobQuestions,
  questionsExpanded,
  onToggleQuestions,
  summaryHook,
  signedCvUrl,
  onOpenCv,
}: ProfileInfoSectionsProps) => {
  const customAnswers = displayApp.custom_answers || {};
  const customAnswerKeys = Object.keys(customAnswers);
  const hasCustomAnswers = customAnswerKeys.length > 0;
  const hasResolvedQuestions = hasCustomAnswers && customAnswerKeys.every((questionId) => !!jobQuestions[questionId]?.text);

  return (
    <div className="grid gap-2.5 min-w-0">
      {/* Information */}
      <div className="bg-white/10 border border-white/20 rounded-lg p-3 min-w-0">
        <h3 className="text-[10px] font-semibold text-white uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <User className="h-3 w-3" />
          Information
        </h3>
        <div className="grid sm:grid-cols-2 gap-2 min-w-0">
          {displayApp.email && (
            <div className="flex min-w-0 items-center gap-2">
              <Mail className="h-3.5 w-3.5 text-white shrink-0" />
              <a href={`mailto:${displayApp.email}`} className="min-w-0 flex-1 text-sm text-white hover:text-white/80 transition-colors break-all [overflow-wrap:anywhere]">
                {displayApp.email}
              </a>
            </div>
          )}
          {displayApp.phone && (
            <div className="flex min-w-0 items-center gap-2">
              <Phone className="h-3.5 w-3.5 text-white shrink-0" />
              <a href={`tel:${displayApp.phone}`} className="min-w-0 flex-1 text-sm text-white hover:text-white/80 transition-colors break-all [overflow-wrap:anywhere]">
                {displayApp.phone}
              </a>
            </div>
          )}
          {displayApp.location && (
            <div className="flex min-w-0 items-center gap-2">
              <MapPin className="h-3.5 w-3.5 text-white shrink-0" />
              <span className="min-w-0 flex-1 text-sm text-white break-words [overflow-wrap:anywhere]">{displayApp.location}</span>
            </div>
          )}
          {displayApp.age && (
            <div className="flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5 text-white shrink-0" />
              <span className="text-sm text-white">{displayApp.age} år</span>
            </div>
          )}
        </div>
      </div>

      {/* Anställningsinformation */}
      {(displayApp.employment_status || displayApp.work_schedule || displayApp.availability) && (
        <div className="bg-white/10 border border-white/20 rounded-lg p-3 min-w-0">
          <h3 className="text-[10px] font-semibold text-white uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Briefcase className="h-3 w-3" />
            Anställningsinformation
          </h3>
          <div className="grid sm:grid-cols-2 gap-2 min-w-0">
            {displayApp.employment_status && (
              <div className="min-w-0">
                <span className="text-sm text-white">Anställningsstatus?</span>
                <p className="text-sm text-white break-words [overflow-wrap:anywhere]">Svar: {employmentStatusLabels[displayApp.employment_status] || displayApp.employment_status}</p>
              </div>
            )}
            {displayApp.work_schedule && (
              <div className="min-w-0">
                <span className="text-sm text-white">Hur mycket jobbar du idag?</span>
                <p className="text-sm text-white break-words [overflow-wrap:anywhere]">Svar: {workScheduleLabels[displayApp.work_schedule] || displayApp.work_schedule}</p>
              </div>
            )}
            {displayApp.availability && (
              <div className="sm:col-span-2 min-w-0">
                <span className="text-sm text-white">När kan du börja nytt jobb?</span>
                <p className="text-sm text-white break-words [overflow-wrap:anywhere]">Svar: {availabilityLabels[displayApp.availability] || displayApp.availability}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Questions & Answers */}
      {hasCustomAnswers && (
        <div className="bg-white/10 border border-white/20 rounded-lg overflow-hidden">
          <button
            onClick={onToggleQuestions}
            className="w-full px-3 py-2 flex items-center justify-between hover:bg-white/5 transition-colors"
          >
            <h3 className="text-[10px] font-semibold text-white uppercase tracking-wider">
              Frågor ({customAnswerKeys.length})
            </h3>
            {questionsExpanded ? (
              <ChevronUp className="h-3.5 w-3.5 text-white" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 text-white" />
            )}
          </button>

          {questionsExpanded && (
            <div className="px-3 pb-3 space-y-2">
              {!hasResolvedQuestions ? (
                <div className="flex items-center justify-center py-3">
                  <Loader2 className="h-4 w-4 text-white animate-spin" />
                  <span className="text-sm text-white ml-2">Laddar frågor...</span>
                </div>
              ) : (
                Object.entries(customAnswers)
                  .sort(([idA], [idB]) => {
                    const orderA = jobQuestions[idA]?.order ?? 999;
                    const orderB = jobQuestions[idB]?.order ?? 999;
                    return orderA - orderB;
                  })
                  .map(([questionId, answer]) => (
                  <div
                    key={questionId}
                    className="border-t border-white/10 pt-2 first:border-t-0 first:pt-0"
                  >
                    <p className="text-sm text-white break-words">
                      {jobQuestions[questionId].text}
                    </p>
                    <p className="text-sm text-white break-words">
                      Svar: {String(answer) || <span className="opacity-50 italic">Inget svar</span>}
                    </p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* AI Summary */}
      <SectionErrorBoundary fallbackLabel="AI-sammanfattning">
        <CandidateSummarySection
          aiSummary={summaryHook.aiSummary}
          loadingSummary={summaryHook.loadingSummary}
          generatingSummary={summaryHook.generatingSummary}
          hasCvUrl={!!displayApp.cv_url}
          signedCvUrl={signedCvUrl}
        />
      </SectionErrorBoundary>

      {/* CV Section */}
      {displayApp.cv_url && (
        <div className="bg-white/10 border border-white/20 rounded-lg p-3">
          <h3 className="text-[10px] font-semibold text-white uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <FileText className="h-3 w-3" />
            CV
          </h3>
          <div className={`w-full py-2 bg-white/5 border border-white/10 rounded-md flex items-center px-2.5 gap-2 ${!signedCvUrl ? 'opacity-50' : ''}`}>
            <button
              type="button"
              onClick={() => signedCvUrl && onOpenCv()}
              disabled={!signedCvUrl}
              className="flex items-center gap-2 text-white transition-colors flex-1 disabled:cursor-wait"
            >
              {!signedCvUrl ? (
                <Loader2 className="h-3.5 w-3.5 text-white shrink-0 animate-spin" />
              ) : (
                <FileText className="h-3.5 w-3.5 text-white shrink-0" />
              )}
              <span className="text-sm">{signedCvUrl ? 'Visa CV' : 'Laddar CV...'}</span>
            </button>
            <button
              type="button"
              onClick={() => signedCvUrl && onOpenCv()}
              disabled={!signedCvUrl}
              className="text-white hover:text-white/80 transition-colors disabled:cursor-wait"
              title="Öppna CV"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Presentation */}
      <div className="bg-white/10 border border-white/20 rounded-lg p-3">
        <h3 className="text-[10px] font-semibold text-white uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <User className="h-3 w-3" />
          Presentation om {displayApp.first_name || 'kandidaten'}
        </h3>
        {displayApp.bio ? (
          <p className="text-sm text-white whitespace-pre-wrap break-words [overflow-wrap:anywhere] leading-relaxed">
            {displayApp.bio}
          </p>
        ) : (
          <p className="text-sm text-white">Ingen presentation angiven</p>
        )}
      </div>
    </div>
  );
};
