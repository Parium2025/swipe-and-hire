import { memo } from 'react';
import type { JobQuestion } from '@/types/jobWizard';

interface JobDetailQuestionsProps {
  questions: (JobQuestion & { id: string })[];
  myAnswers: Record<string, any> | null;
  hasApplied: boolean;
}

/**
 * Presentational: "Ansökningsfrågor"-kortet i SwipeJobDetail.
 * Ren extraktion — samma layout, samma yes/no-översättning, samma villkor.
 */
export const JobDetailQuestions = memo(function JobDetailQuestions({
  questions,
  myAnswers,
  hasApplied,
}: JobDetailQuestionsProps) {
  if (questions.length === 0) return null;
  return (
    <div className="bg-white/10 rounded-lg p-4">
      <h3 className="text-white font-semibold text-[17px] sm:text-base mb-3 tracking-[-0.01em]">Ansökningsfrågor</h3>
      {!hasApplied && (
        <p className="text-white text-[13px] sm:text-xs mb-3">Dessa frågor besvaras när du ansöker.</p>
      )}
      {hasApplied && myAnswers && (
        <p className="text-white text-[13px] sm:text-xs mb-3">Dina svar</p>
      )}
      <div className="space-y-3">
        {questions.map((q, i) => {
          const answer = myAnswers?.[q.id] ?? myAnswers?.[q.question_text];
          const rawAnswer = Array.isArray(answer) ? answer.join(', ') : answer;
          const displayAnswer = rawAnswer === 'yes' ? 'Ja' : rawAnswer === 'no' ? 'Nej' : rawAnswer;
          return (
            <div key={q.id} className="flex items-start gap-2">
              <span className="text-white text-[15px] sm:text-sm font-medium shrink-0">{i + 1}.</span>
              <div className="min-w-0 flex-1">
                <p className="text-white text-[15px] sm:text-sm font-medium break-words">{q.question_text}</p>
                {hasApplied && displayAnswer ? (
                  <p className="text-white text-[15px] sm:text-sm mt-1 break-words">{String(displayAnswer)}</p>
                ) : (
                  q.is_required && (
                    <span className="text-white text-[13px] sm:text-xs">Obligatorisk</span>
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});
