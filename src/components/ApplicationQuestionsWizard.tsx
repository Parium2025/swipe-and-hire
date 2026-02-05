import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Send, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface JobQuestion {
  id: string;
  question_text: string;
  question_type: 'text' | 'yes_no' | 'multiple_choice' | 'number' | 'date' | 'file' | 'range' | 'video';
  options?: string[];
  is_required: boolean;
  order_index: number;
  min_value?: number;
  max_value?: number;
  placeholder_text?: string;
}

interface ApplicationQuestionsWizardProps {
  questions: JobQuestion[];
  answers: Record<string, any>;
  onAnswerChange: (questionId: string, value: any) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  canSubmit: boolean;
  hasAlreadyApplied: boolean;
  contactEmail?: string;
  jobTitle?: string;
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
}: ApplicationQuestionsWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const totalSteps = questions.length + 1; // Questions + final submit step
  
  const isLastQuestion = currentStep === questions.length - 1;
  const isSubmitStep = currentStep === questions.length;
  const currentQuestion = questions[currentStep];
  
  const currentAnswer = currentQuestion ? answers[currentQuestion.id] : null;
  const isCurrentAnswered = currentQuestion 
    ? (currentAnswer !== undefined && currentAnswer !== null && currentAnswer !== '')
    : true;

  const handleNext = useCallback(() => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(prev => prev + 1);
    }
  }, [currentStep, totalSteps]);

  const handlePrev = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  const renderQuestionInput = (question: JobQuestion) => {
    const answer = answers[question.id];

    switch (question.question_type) {
      case 'text':
        return (
          <Textarea
            value={answer || ''}
            onChange={(e) => onAnswerChange(question.id, e.target.value)}
            placeholder={question.placeholder_text || 'Skriv ditt svar här...'}
            className="bg-white/10 border-white/20 text-white placeholder:text-white/50 min-h-[60px] max-h-[100px] resize-none text-sm focus:outline-none focus:border-white/40"
          />
        );

      case 'yes_no':
        return (
          <div className="flex justify-center gap-3">
            <button
              type="button"
              onClick={() => onAnswerChange(question.id, answer === 'yes' ? '' : 'yes')}
              className={
                (answer === 'yes'
                  ? 'bg-secondary/40 border-secondary '
                  : 'bg-white/10 border-white/20 hover:bg-white/15 ') +
                'border rounded-full px-6 py-2 text-sm transition-colors font-medium text-white'
              }
            >
              Ja
            </button>
            <button
              type="button"
              onClick={() => onAnswerChange(question.id, answer === 'no' ? '' : 'no')}
              className={
                (answer === 'no'
                  ? 'bg-secondary/40 border-secondary '
                  : 'bg-white/10 border-white/20 hover:bg-white/15 ') +
                'border rounded-full px-6 py-2 text-sm transition-colors font-medium text-white'
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
                    if (selectedAnswers.includes(option)) {
                      const newAnswers = selectedAnswers.filter(a => a !== option);
                      onAnswerChange(question.id, newAnswers.join('|||'));
                    } else {
                      onAnswerChange(question.id, [...selectedAnswers, option].join('|||'));
                    }
                  }}
                  className={
                    (selected
                      ? 'bg-secondary/40 border-secondary '
                      : 'bg-white/10 border-white/20 hover:bg-white/15 ') +
                    'border rounded-full px-4 py-2 text-sm transition-colors font-medium text-white'
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
              onChange={(e) => onAnswerChange(question.id, e.target.value)}
              min={question.min_value}
              max={question.max_value}
              placeholder={question.placeholder_text || 'Ange ett nummer'}
              className="bg-white/10 border-white/20 text-white text-center text-sm max-w-[160px] h-10 placeholder:text-white/50"
            />
          </div>
        );

      case 'date':
        return (
          <div className="flex justify-center">
            <Input
              type="date"
              value={answer || ''}
              onChange={(e) => onAnswerChange(question.id, e.target.value)}
              className="bg-white/10 border-white/20 text-white max-w-[160px] h-10 text-sm"
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
              onChange={(e) => onAnswerChange(question.id, parseInt(e.target.value))}
              className="w-full h-1.5 bg-white/20 rounded-full appearance-none cursor-pointer accent-secondary"
            />
            <div className="flex justify-between text-[10px] text-white/40">
              <span>{question.min_value || 0}</span>
              <span>{question.max_value || 10}</span>
            </div>
          </div>
        );

      default:
        return (
          <Textarea
            value={answer || ''}
            onChange={(e) => onAnswerChange(question.id, e.target.value)}
            placeholder="Skriv ditt svar här..."
            className="bg-white/10 border-white/20 text-white min-h-[60px] text-sm"
          />
        );
    }
  };

  // Progress bar percentage
  const progress = ((currentStep + 1) / totalSteps) * 100;

  // Shared button styles matching WizardFooter
  const backButtonClasses = 
    'rounded-full bg-white/5 backdrop-blur-sm border-white/20 text-white px-4 py-2 text-sm transition-colors duration-150 hover:bg-white/10 disabled:opacity-30 focus:outline-none focus:ring-0';

  const nextButtonClasses = 
    'rounded-full bg-primary hover:bg-primary/90 text-white px-6 py-2 text-sm transition-colors duration-150 focus:outline-none focus:ring-0 disabled:opacity-50';

  const submitButtonClasses = 
    'rounded-full bg-green-600/80 hover:bg-green-600 text-white px-6 py-2 text-sm transition-colors duration-150 focus:outline-none focus:ring-0 disabled:opacity-50';

  return (
    <div className="space-y-4">
      {/* Progress bar - subtle */}
      <div className="relative h-0.5 bg-white/10 rounded-full overflow-hidden">
        <motion.div 
          className="absolute inset-y-0 left-0 bg-secondary rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        />
      </div>

      {/* Question container - compact */}
      <div className="relative min-h-[180px] flex flex-col">
        <AnimatePresence mode="wait">
          {!isSubmitStep && currentQuestion ? (
            <motion.div
              key={currentQuestion.id}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="flex-1 flex flex-col"
            >
              {/* Question number - minimal */}
              <div className="text-center mb-2">
                <span className="text-[10px] uppercase tracking-widest text-white/40">
                  {currentStep + 1} / {questions.length}
                </span>
              </div>

              {/* Question text - compact */}
              <div className="text-center mb-4">
                <h3 className="text-sm font-medium text-white leading-snug">
                  {currentQuestion.question_text}
                  {currentQuestion.is_required && (
                    <span className="ml-1 text-destructive text-xs">*</span>
                  )}
                </h3>
              </div>

              {/* Answer input */}
              <div className="flex-1 flex items-center justify-center">
                <div className="w-full">
                  {renderQuestionInput(currentQuestion)}
                </div>
              </div>
            </motion.div>
          ) : isSubmitStep ? (
            <motion.div
              key="submit-step"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="flex-1 flex flex-col"
            >
              {/* Header */}
              <div className="text-center mb-3">
                <div className="w-10 h-10 rounded-full bg-secondary/20 flex items-center justify-center mx-auto mb-2">
                  <CheckCircle className="w-5 h-5 text-secondary" />
                </div>
                <h3 className="text-sm font-medium text-white">Granska dina svar</h3>
              </div>

              {/* Answers summary - scrollable */}
              <div className="flex-1 overflow-y-auto max-h-[200px] space-y-2 px-1">
                {questions.map((q, idx) => {
                  const answer = answers[q.id];
                  let displayAnswer = answer || '—';
                  
                  // Format answer based on type
                  if (q.question_type === 'yes_no') {
                    displayAnswer = answer === 'yes' ? 'Ja' : answer === 'no' ? 'Nej' : '—';
                  } else if (q.question_type === 'multiple_choice' && typeof answer === 'string') {
                    displayAnswer = answer.split('|||').filter(a => a).join(', ') || '—';
                  }
                  
                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => setCurrentStep(idx)}
                      className="w-full text-left p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] text-white/40 mb-0.5">Fråga {idx + 1}</p>
                          <p className="text-xs text-white/70 truncate">{q.question_text}</p>
                          <p className="text-xs text-white font-medium mt-0.5 truncate">{displayAnswer}</p>
                        </div>
                        <ArrowRight className="w-3 h-3 text-white/30 group-hover:text-white/60 transition-colors flex-shrink-0 mt-1" />
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
                    className="text-xs text-white/50 hover:text-white transition-colors underline underline-offset-2"
                  >
                    {contactEmail}
                  </a>
                </div>
              )}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {/* Navigation - matching WizardFooter style */}
      <div className="flex items-center justify-between pt-2 border-t border-white/10">
        {/* Back button */}
        <Button
          variant="outline"
          size="sm"
          onClick={handlePrev}
          disabled={currentStep === 0}
          className={backButtonClasses}
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Tillbaka
        </Button>

        {/* Next / Submit button */}
        {!isSubmitStep ? (
          <Button
            size="sm"
            onClick={handleNext}
            disabled={currentQuestion?.is_required && !isCurrentAnswered}
            className={nextButtonClasses}
          >
            {isLastQuestion ? 'Granska' : 'Nästa'}
            <ArrowRight className="w-4 h-4 ml-1.5" />
          </Button>
        ) : hasAlreadyApplied ? (
          <Button
            size="sm"
            disabled
            className="rounded-full bg-green-600/30 text-green-300 px-6 py-2 text-sm cursor-default"
          >
            <CheckCircle className="mr-1.5 h-4 w-4" />
            Redan sökt
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={onSubmit}
            disabled={isSubmitting || !canSubmit}
            className={submitButtonClasses}
          >
            {isSubmitting ? (
              'Skickar...'
            ) : (
              <>
                <Send className="mr-1.5 h-3.5 w-3.5" />
                Skicka ansökan
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
