import type { CSSProperties } from 'react';
import { ApplicationQuestionsWizard } from '@/components/ApplicationQuestionsWizard';
import { JobPostingContent, type JobPostingContentData } from '@/components/jobview/JobPostingContent';
import type { JobQuestion } from '@/types/jobWizard';

interface JobPostingPreviewContentProps {
  data: JobPostingContentData;
  questions: JobQuestion[];
  answers: Record<string, string>;
  onAnswerChange: (questionId: string, value: string) => void;
  onOpenCompany?: () => void;
  scale: number;
}

export function JobPostingPreviewContent({
  data,
  questions,
  answers,
  onAnswerChange,
  onOpenCompany,
  scale,
}: JobPostingPreviewContentProps) {
  const resolvedQuestions = questions.map((question, index) => ({
    ...question,
    id: question.id || `preview-question-${index}`,
  }));

  const questionsContent = resolvedQuestions.length > 0 ? (
    <div className="bg-white/[0.06] backdrop-blur-md rounded-lg p-4 border border-white/[0.06]">
      <h2 className="text-section-title mb-3">Ansökningsfrågor</h2>
      <ApplicationQuestionsWizard
        questions={resolvedQuestions}
        answers={answers}
        onAnswerChange={onAnswerChange}
        onSubmit={() => undefined}
        isSubmitting={false}
        canSubmit={false}
        hasAlreadyApplied={false}
        previewMode
        interactivePreview
      />
    </div>
  ) : (
    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 text-center space-y-4">
      <h3 className="text-lg font-medium text-white">Redo att ansöka?</h3>
      <p className="text-sm text-white">Detta jobb kräver inga extra frågor.</p>
    </div>
  );

  return (
    <div
      className="origin-top-left"
      style={{ width: `${100 / scale}%`, zoom: scale } as CSSProperties}
    >
      <JobPostingContent data={data} onOpenCompany={onOpenCompany} afterDetails={questionsContent} />
    </div>
  );
}