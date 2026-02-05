import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Send, CheckCircle } from 'lucide-react';
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
            className="bg-white/10 border-white/20 text-white placeholder:text-white/50 min-h-[100px] max-h-[200px] resize-none text-base focus:outline-none focus:border-white/40"
          />
        );

      case 'yes_no':
        return (
          <div className="flex justify-center gap-4">
            <button
              type="button"
              onClick={() => {
                onAnswerChange(question.id, answer === 'yes' ? '' : 'yes');
              }}
              className={
                (answer === 'yes'
                  ? 'bg-secondary/40 border-secondary scale-105 '
                  : 'bg-white/10 border-white/20 hover:bg-white/15 hover:scale-102 ') +
                'border-2 rounded-2xl px-10 py-4 text-lg transition-all duration-200 font-medium text-white'
              }
            >
              Ja
            </button>
            <button
              type="button"
              onClick={() => {
                onAnswerChange(question.id, answer === 'no' ? '' : 'no');
              }}
              className={
                (answer === 'no'
                  ? 'bg-secondary/40 border-secondary scale-105 '
                  : 'bg-white/10 border-white/20 hover:bg-white/15 hover:scale-102 ') +
                'border-2 rounded-2xl px-10 py-4 text-lg transition-all duration-200 font-medium text-white'
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
          <div className="flex flex-wrap justify-center gap-3">
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
                      ? 'bg-secondary/40 border-secondary scale-105 '
                      : 'bg-white/10 border-white/20 hover:bg-white/15 hover:scale-102 ') +
                    'border-2 rounded-2xl px-6 py-3 text-base transition-all duration-200 font-medium text-white'
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
              className="bg-white/10 border-white/20 text-white text-center text-xl max-w-[200px] h-14 placeholder:text-white/50"
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
              className="bg-white/10 border-white/20 text-white max-w-[200px] h-14"
            />
          </div>
        );

      case 'range':
        const rangeValue = answer || question.min_value || 0;
        return (
          <div className="space-y-4">
            <div className="flex justify-center">
              <span className="text-4xl font-light text-white">{rangeValue}</span>
            </div>
            <input
              type="range"
              min={question.min_value || 0}
              max={question.max_value || 10}
              value={rangeValue}
              onChange={(e) => onAnswerChange(question.id, parseInt(e.target.value))}
              className="w-full h-2 bg-white/20 rounded-full appearance-none cursor-pointer accent-secondary"
            />
            <div className="flex justify-between text-xs text-white/50">
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
            className="bg-white/10 border-white/20 text-white min-h-[100px]"
          />
        );
    }
  };

  // Progress bar percentage
  const progress = ((currentStep + 1) / totalSteps) * 100;

  return (
    <div className="space-y-4">
      {/* Header with title */}
      <div className="text-center">
        <h2 className="text-lg font-semibold text-white">Ansökningsfrågor</h2>
      </div>

      {/* Progress bar */}
      <div className="relative h-1 bg-white/10 rounded-full overflow-hidden">
        <motion.div 
          className="absolute inset-y-0 left-0 bg-secondary rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        />
      </div>

      {/* Question container */}
      <div className="relative min-h-[280px] flex flex-col">
        <AnimatePresence mode="wait">
          {!isSubmitStep && currentQuestion ? (
            <motion.div
              key={currentQuestion.id}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="flex-1 flex flex-col"
            >
              {/* Question number */}
              <div className="text-center mb-2">
                <span className="text-[10px] uppercase tracking-widest text-white/40">
                  {currentStep + 1} / {questions.length}
                </span>
              </div>

              {/* Question text */}
              <div className="text-center mb-6">
                <h3 className="text-xl font-medium text-white leading-relaxed">
                  {currentQuestion.question_text}
                  {currentQuestion.is_required && (
                    <span className="ml-1.5 text-red-400 text-sm">*</span>
                  )}
                </h3>
              </div>

              {/* Answer input */}
              <div className="flex-1 flex items-center justify-center">
                <div className="w-full max-w-md">
                  {renderQuestionInput(currentQuestion)}
                </div>
              </div>
            </motion.div>
          ) : isSubmitStep ? (
            <motion.div
              key="submit-step"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="flex-1 flex flex-col items-center justify-center text-center space-y-6"
            >
              <div className="w-16 h-16 rounded-full bg-secondary/20 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-secondary" />
              </div>
              <div>
                <h3 className="text-xl font-medium text-white mb-2">
                  Allt klart!
                </h3>
                <p className="text-white/60 text-sm max-w-xs">
                  Du har svarat på alla frågor. Klicka på knappen nedan för att skicka din ansökan.
                </p>
              </div>

              {/* Contact email if exists */}
              {contactEmail && (
                <div className="pt-2">
                  <p className="text-xs text-white/40 mb-1">Har du frågor?</p>
                  <a 
                    href={`mailto:${contactEmail}?subject=Fråga om tjänsten: ${jobTitle || ''}`}
                    className="text-sm text-white/60 hover:text-white transition-colors underline underline-offset-2"
                  >
                    {contactEmail}
                  </a>
                </div>
              )}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between gap-4 pt-2">
        {/* Back button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handlePrev}
          disabled={currentStep === 0}
          className={`text-white/60 hover:text-white hover:bg-white/10 ${
            currentStep === 0 ? 'opacity-0 pointer-events-none' : ''
          }`}
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Tillbaka
        </Button>

        {/* Next / Submit button */}
        {!isSubmitStep ? (
          <Button
            variant="glass"
            size="sm"
            onClick={handleNext}
            disabled={currentQuestion?.is_required && !isCurrentAnswered}
            className={`px-6 ${
              currentQuestion?.is_required && !isCurrentAnswered 
                ? 'opacity-50 cursor-not-allowed' 
                : ''
            }`}
          >
            {isLastQuestion ? 'Granska' : 'Nästa'}
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        ) : hasAlreadyApplied ? (
          <Button
            variant="glass"
            size="sm"
            className="px-6 bg-green-500/20 text-green-300 border-green-500/30 cursor-default"
            disabled
          >
            <CheckCircle className="mr-1.5 h-4 w-4" />
            Redan sökt
          </Button>
        ) : (
          <Button
            variant={canSubmit ? "glassGreen" : "glass"}
            size="sm"
            onClick={onSubmit}
            disabled={isSubmitting || !canSubmit}
            className={`px-6 ${!canSubmit ? 'opacity-50 cursor-not-allowed' : ''}`}
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
