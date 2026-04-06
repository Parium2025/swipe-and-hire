import { useState, useCallback, useRef } from 'react';
import { ArrowLeft, ArrowRight, Send, CheckCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { TruncatedText } from '@/components/TruncatedText';
import type { JobQuestion } from '@/types/jobWizard';

// Runtime interface where id is guaranteed (questions fetched from DB always have id)
interface ResolvedJobQuestion extends JobQuestion {
  id: string;
}

interface ApplicationQuestionsWizardProps {
  questions: ResolvedJobQuestion[];
  answers: Record<string, any>;
  onAnswerChange: (questionId: string, value: any) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  canSubmit: boolean;
  hasAlreadyApplied: boolean;
  contactEmail?: string;
  jobTitle?: string;
  /** Preview mode: allows navigation but disables inputs and hides submit */
  previewMode?: boolean;
}

export function ApplicationQuestionsWizard({
  questions,
  answers,
  onAnswerChange,
  onSubmit,
  isSubmitting,
  canSubmit,
  hasAlreadyApplied,
  contactEmail,
  jobTitle,
  previewMode = false,
}: ApplicationQuestionsWizardProps) {
  // If already applied, start directly on the review step
  const [currentStep, setCurrentStep] = useState(hasAlreadyApplied && !previewMode ? questions.length : 0);
  const [navigatedBack, setNavigatedBack] = useState(false);
  const totalSteps = previewMode ? questions.length : questions.length + 1;
  
  const isLastQuestion = currentStep === questions.length - 1;
  const isSubmitStep = currentStep === questions.length;
  const currentQuestion = questions[currentStep];

  // buttonIsSubmitStep now tracks currentStep directly (no delay needed without AnimatePresence)
  const buttonIsSubmitStep = isSubmitStep;
  
  const currentAnswer = currentQuestion ? answers[currentQuestion.id] : null;
  const isCurrentAnswered = currentQuestion 
    ? (currentAnswer !== undefined && currentAnswer !== null && currentAnswer !== '')
    : true;

  const handleNext = useCallback(() => {
    if (currentStep < totalSteps - 1) {
      (document.activeElement as HTMLElement)?.blur();
      setCurrentStep(prev => prev + 1);
    }
  }, [currentStep, totalSteps]);

  const handlePrev = useCallback(() => {
    if (currentStep > 0) {
      // Blur any focused element before step change to prevent focus-ring flash
      (document.activeElement as HTMLElement)?.blur();
      setNavigatedBack(true);
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  const renderQuestionInput = (question: JobQuestion) => {
    const answer = answers[question.id];
    const isLocked = hasAlreadyApplied || previewMode;

    switch (question.question_type) {
      case 'text':
        return (
          <div className="max-w-md mx-auto">
            <Textarea
              value={answer || ''}
              onChange={(e) => !isLocked && onAnswerChange(question.id, e.target.value)}
              readOnly={isLocked}
              placeholder={question.placeholder_text || 'Skriv ditt svar här...'}
              className={'bg-white/10 border-white/20 text-white placeholder:text-white/50 min-h-[80px] max-h-[120px] resize-none text-sm focus:outline-none focus:border-white/40' + (isLocked ? ' opacity-70 cursor-default' : '')}
            />
          </div>
        );

      case 'yes_no':
        return (
          <div className="flex justify-center gap-3">
            <button
              type="button"
              onClick={() => !isLocked && (() => {
                if (answer === 'yes') {
                  // Already selected — just advance
                  handleNext();
                  return;
                }
                onAnswerChange(question.id, 'yes');
                setNavigatedBack(false);
                setTimeout(() => handleNext(), 250);
              })()}
              disabled={isLocked}
              className={
                (answer === 'yes'
                  ? 'bg-secondary/40 border-secondary '
                  : 'bg-white/10 border-white/20 ' + (isLocked ? '' : 'hover:bg-white/15 ')) +
                'border rounded-full px-6 py-2.5 text-sm transition-all duration-150 font-medium text-white' + (isLocked ? ' cursor-default opacity-70' : ' active:scale-[0.97]')
              }
            >
              Ja
            </button>
            <button
              type="button"
              onClick={() => !isLocked && (() => {
                if (answer === 'no') {
                  // Already selected — just advance
                  handleNext();
                  return;
                }
                onAnswerChange(question.id, 'no');
                setNavigatedBack(false);
                setTimeout(() => handleNext(), 250);
              })()}
              disabled={isLocked}
              className={
                (answer === 'no'
                  ? 'bg-secondary/40 border-secondary '
                  : 'bg-white/10 border-white/20 ' + (isLocked ? '' : 'hover:bg-white/15 ')) +
                'border rounded-full px-6 py-2.5 text-sm transition-all duration-150 font-medium text-white' + (isLocked ? ' cursor-default opacity-70' : ' active:scale-[0.97]')
              }
            >
              Nej
            </button>
          </div>
        );

      case 'multiple_choice':
        const selectedAnswers = typeof answer === 'string' 
          ? answer.split('|||').filter(a => a)
          : [];
          
        return (
          <div className="flex flex-wrap justify-center gap-2">
            {question.options?.filter(opt => opt.trim() !== '').map((option, index) => {
              const selected = selectedAnswers.includes(option);
              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => {
                    if (isLocked) return;
                    if (selectedAnswers.includes(option)) {
                      const newAnswers = selectedAnswers.filter(a => a !== option);
                      onAnswerChange(question.id, newAnswers.join('|||'));
                    } else {
                      onAnswerChange(question.id, [...selectedAnswers, option].join('|||'));
                    }
                  }}
                  disabled={isLocked}
                  className={
                    (selected
                      ? 'bg-secondary/40 border-secondary '
                      : 'bg-white/10 border-white/20 ' + (isLocked ? '' : 'hover:bg-white/15 ')) +
                    'border rounded-full px-4 py-2.5 text-sm transition-all duration-150 font-medium text-white' + (isLocked ? ' cursor-default opacity-70' : ' active:scale-[0.97]')
                  }
                >
                  {option}
                </button>
              );
            })}
          </div>
        );

      case 'number':
        return (
          <div className="flex justify-center">
            <Input
              type="number"
              value={answer || ''}
              onChange={(e) => !isLocked && onAnswerChange(question.id, e.target.value)}
              readOnly={isLocked}
              min={question.min_value}
              max={question.max_value}
              placeholder={question.placeholder_text || 'Ange ett nummer'}
              className={'bg-white/10 border-white/20 text-white text-center text-sm max-w-[160px] h-10 placeholder:text-white/50' + (isLocked ? ' opacity-70 cursor-default' : '')}
            />
          </div>
        );

      case 'date':
        return (
          <div className="flex justify-center">
            <Input
              type="date"
              value={answer || ''}
              onChange={(e) => !isLocked && onAnswerChange(question.id, e.target.value)}
              readOnly={isLocked}
              className={'bg-white/10 border-white/20 text-white max-w-[160px] h-10 text-sm' + (isLocked ? ' opacity-70 cursor-default' : '')}
            />
          </div>
        );

      case 'range':
        const rangeValue = answer || question.min_value || 0;
        return (
          <div className="space-y-3 max-w-xs mx-auto">
            <div className="flex justify-center">
              <span className="text-2xl font-light text-white">{rangeValue}</span>
            </div>
            <input
              type="range"
              min={question.min_value || 0}
              max={question.max_value || 10}
              value={rangeValue}
              onChange={(e) => !isLocked && onAnswerChange(question.id, parseInt(e.target.value))}
              disabled={isLocked}
              className={'w-full h-1.5 bg-white/20 rounded-full appearance-none accent-secondary' + (isLocked ? ' opacity-70 cursor-default' : ' cursor-pointer')}
            />
            <div className="flex justify-between text-[10px] text-white/40">
              <span>{question.min_value || 0}</span>
              <span>{question.max_value || 10}</span>
            </div>
          </div>
        );

      default:
        return (
          <div className="max-w-md mx-auto">
            <Textarea
              value={answer || ''}
              onChange={(e) => !isLocked && onAnswerChange(question.id, e.target.value)}
              readOnly={isLocked}
              placeholder="Skriv ditt svar här..."
              className={'bg-white/10 border-white/20 text-white min-h-[60px] text-sm' + (isLocked ? ' opacity-70 cursor-default' : '')}
            />
          </div>
        );
    }
  };

  // Blur handlers to prevent focus ring flash (synced with WizardFooter pattern)
  const handleMouseDown = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.blur();
    const activeEl = document.activeElement as HTMLElement;
    if (activeEl?.blur) activeEl.blur();
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.blur();
  };

  // Container-level touch/mouse blur (same as WizardFooter)
  const handleContainerMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  };

  const handleContainerTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  };

  // Shared button styles (copy-pasted from WizardFooter, only px adjusted for compact size)
  const backButtonClasses = 
    'rounded-full bg-white/5 backdrop-blur-sm border-white/20 text-white px-4 py-2 text-sm transition-colors duration-150 hover:bg-white/10 md:hover:bg-white/10 hover:text-white md:hover:text-white disabled:opacity-30 touch-border-white [&_svg]:text-white hover:[&_svg]:text-white md:hover:[&_svg]:text-white focus:outline-none focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0';

  const nextButtonClasses = 
    'rounded-full bg-primary hover:bg-primary/90 md:hover:bg-primary/90 text-white px-6 py-2 text-sm touch-border-white transition-colors duration-150 focus:outline-none focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0';

  const submitButtonClasses = 
    'rounded-full bg-green-600/80 hover:bg-green-600 md:hover:bg-green-600 text-white px-6 py-2 text-sm transition-colors duration-150 focus:outline-none focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0 disabled:opacity-50';

  const navRef = useRef<HTMLDivElement>(null);

  return (
    <div className="space-y-4">
      {/* Step dots progress indicator - hidden when already applied (locked view) */}
      <div className={'flex items-center justify-center gap-1.5 py-1' + (hasAlreadyApplied ? ' hidden' : '')}>
        {Array.from({ length: totalSteps }).map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => {
              // Allow clicking back to previous steps or current
              if (i <= currentStep) {
                if (i < currentStep) setNavigatedBack(true);
                setCurrentStep(i);
              }
            }}
            className={
              'rounded-full transition-all duration-300 ' +
              (i === currentStep
                ? 'w-5 h-1.5 bg-secondary'
                : i < currentStep
                  ? 'w-1.5 h-1.5 bg-white/50 hover:bg-white/70 cursor-pointer'
                  : 'w-1.5 h-1.5 bg-white/15')
            }
            aria-label={`Steg ${i + 1}`}
          />
        ))}
      </div>

      {/* Question container */}
      <div className={`relative flex flex-col ${
        questions.length <= 1 ? 'min-h-[160px] sm:min-h-[180px] md:min-h-[200px]' :
        questions.length <= 2 ? 'min-h-[200px] sm:min-h-[220px] md:min-h-[240px]' :
        questions.length <= 3 ? 'min-h-[240px] sm:min-h-[260px] md:min-h-[280px]' :
        'min-h-[300px] sm:min-h-[300px] md:min-h-[320px]'
      }`}>
        {!isSubmitStep && currentQuestion ? (
            <div
              key={currentQuestion.id}
              className="flex-1 flex flex-col transition-opacity duration-100"
            >
              {/* Question number */}
              <div className="text-center mb-2">
                <span className="text-[10px] uppercase tracking-widest text-white">
                  {currentStep + 1} / {questions.length}
                </span>
              </div>

              {/* Question text */}
              <div className="text-center mb-5">
                <h3 className="text-base font-semibold text-white leading-snug">
                  {currentQuestion.question_text}
                  {currentQuestion.is_required && (
                    <span className="ml-1 text-white text-sm">*</span>
                  )}
                </h3>
              </div>

              {/* Answer input */}
              <div className="flex-1 flex items-center justify-center">
                <div className="w-full">
                  {renderQuestionInput(currentQuestion)}
                </div>
              </div>
            </div>
          ) : isSubmitStep ? (
            <div
              key="submit-step"
              className="flex-1 flex flex-col transition-opacity duration-100"
            >
              {/* Header */}
              <div className="text-center mb-3">
                <div className="w-10 h-10 rounded-full bg-secondary/20 flex items-center justify-center mx-auto mb-2">
                  <CheckCircle className="w-5 h-5 text-secondary" />
                </div>
                <h3 className="text-base font-semibold text-white">Granska dina svar</h3>
              </div>

              {/* Answers summary - improved cards */}
              <div className="flex-1 overflow-y-auto max-h-[260px] space-y-2 px-1">
                {questions.map((q, idx) => {
                  const answer = answers[q.id];
                  let displayAnswer = answer || '—';
                  
                  if (q.question_type === 'yes_no') {
                    displayAnswer = answer === 'yes' ? 'Ja' : answer === 'no' ? 'Nej' : '—';
                  } else if (q.question_type === 'multiple_choice' && typeof answer === 'string') {
                    displayAnswer = answer.split('|||').filter(a => a).join(', ') || '—';
                  }

                  const hasAnswer = answer && answer !== '';
                  
                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => setCurrentStep(idx)}
                      className="w-full text-left p-3.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] hover:border-white/[0.14] transition-all duration-150 group active:scale-[0.99]"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] uppercase tracking-wider text-white/70 mb-0.5">
                            Fråga {idx + 1}
                          </p>
                          <TruncatedText
                            text={q.question_text}
                            className="text-sm text-white truncate"
                            alwaysShowTooltip={false}
                          />
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-sm font-medium truncate max-w-[120px] text-white">
                            {typeof displayAnswer === 'string' && displayAnswer.length > 20 
                              ? displayAnswer.slice(0, 20) + '…' 
                              : displayAnswer}
                          </span>
                          <ArrowRight className="w-3.5 h-3.5 text-white" />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Contact email */}
              {contactEmail && (
                <div className="mt-3 text-center">
                  <a 
                    href={`mailto:${contactEmail}?subject=Fråga om tjänsten: ${jobTitle || ''}`}
                    className="text-xs text-white hover:text-white/80 transition-colors underline underline-offset-2"
                  >
                    {contactEmail}
                  </a>
                </div>
              )}
            </div>
          ) : null}
      </div>

      {/* Navigation - all buttons always rendered, visibility via CSS to prevent flash */}
      <div
        ref={navRef}
        className="flex items-center justify-center gap-3 pt-2 border-t border-white/[0.06]"
        onMouseDown={handleContainerMouseDown}
        onTouchStart={handleContainerTouchStart}
      >
        <button
          type="button"
          onMouseDown={handleMouseDown}
           onMouseUp={handleMouseUp}
           onClick={(e) => { e.currentTarget.blur(); (hasAlreadyApplied && !previewMode) ? setCurrentStep(questions.length) : handlePrev(); }}
           disabled={currentStep === 0 && !(hasAlreadyApplied && !previewMode)}
           className={
             backButtonClasses + ' disabled:opacity-30 disabled:pointer-events-none' +
             ((hasAlreadyApplied && !previewMode) && buttonIsSubmitStep ? ' hidden' : ' inline-flex items-center justify-center')
          }
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Tillbaka
        </button>

        {/* Nästa / Granska button - hidden for yes_no, submit step, and locked mode */}
        <button
          type="button"
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onClick={(e) => { e.currentTarget.blur(); handleNext(); }}
          disabled={currentQuestion?.is_required && !isCurrentAnswered}
          className={
            nextButtonClasses + ' disabled:opacity-50 disabled:pointer-events-none' +
            (isSubmitStep || (hasAlreadyApplied && !previewMode) || (currentQuestion?.question_type === 'yes_no' && !(navigatedBack && isCurrentAnswered)) ? ' hidden' : ' inline-flex items-center justify-center')
          }
        >
          {isLastQuestion ? 'Granska' : 'Nästa'}
          <ArrowRight className="w-4 h-4 ml-1.5" />
        </button>

        {/* Redan sökt button - only visible on submit step when already applied */}
        <button
          type="button"
          disabled
          className={
            'rounded-full bg-green-600/30 text-green-300 px-6 py-2 text-sm cursor-default focus:outline-none focus:ring-0 focus-visible:ring-0' +
            (buttonIsSubmitStep && hasAlreadyApplied && !previewMode ? ' inline-flex items-center justify-center' : ' hidden')
          }
        >
          <CheckCircle className="mr-1.5 h-4 w-4" />
          Redan sökt
        </button>

        {/* Skicka ansökan button - only visible on submit step when not already applied */}
        <button
          type="button"
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onClick={(e) => { e.currentTarget.blur(); onSubmit(); }}
          disabled={isSubmitting || !canSubmit}
          className={
            submitButtonClasses + ' disabled:pointer-events-none' +
            (isSubmitStep && !hasAlreadyApplied && !previewMode ? ' inline-flex items-center justify-center' : ' hidden')
          }
        >
          {isSubmitting ? (
            'Skickar...'
          ) : (
            <>
              <Send className="mr-1.5 h-3.5 w-3.5" />
              Skicka ansökan
            </>
          )}
        </button>
      </div>
    </div>
  );
}
