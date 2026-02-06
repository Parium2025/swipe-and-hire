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
  const [direction, setDirection] = useState(1); // 1 = forward, -1 = backward
  const totalSteps = questions.length + 1;
  
  const isLastQuestion = currentStep === questions.length - 1;
  const isSubmitStep = currentStep === questions.length;
  const currentQuestion = questions[currentStep];
  
  const currentAnswer = currentQuestion ? answers[currentQuestion.id] : null;
  const isCurrentAnswered = currentQuestion 
    ? (currentAnswer !== undefined && currentAnswer !== null && currentAnswer !== '')
    : true;

  const handleNext = useCallback(() => {
    if (currentStep < totalSteps - 1) {
      setDirection(1);
      setCurrentStep(prev => prev + 1);
    }
  }, [currentStep, totalSteps]);

  const handlePrev = useCallback(() => {
    if (currentStep > 0) {
      setDirection(-1);
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  const handleJumpToStep = useCallback((idx: number) => {
    setDirection(idx > currentStep ? 1 : -1);
    setCurrentStep(idx);
  }, [currentStep]);

  // Auto-advance for yes/no questions after selection
  const handleYesNoAnswer = useCallback((questionId: string, value: string, currentAnswer: string) => {
    const newValue = currentAnswer === value ? '' : value;
    onAnswerChange(questionId, newValue);
    // Auto-advance after a brief moment if answered
    if (newValue && !isLastQuestion) {
      setTimeout(() => {
        setDirection(1);
        setCurrentStep(prev => prev + 1);
      }, 350);
    } else if (newValue && isLastQuestion) {
      setTimeout(() => {
        setDirection(1);
        setCurrentStep(questions.length); // Go to review
      }, 350);
    }
  }, [onAnswerChange, isLastQuestion, questions.length]);

  const renderQuestionInput = (question: JobQuestion) => {
    const answer = answers[question.id];

    switch (question.question_type) {
      case 'text':
        return (
          <div className="w-full max-w-md mx-auto">
            <Textarea
              value={answer || ''}
              onChange={(e) => onAnswerChange(question.id, e.target.value)}
              placeholder={question.placeholder_text || 'Skriv ditt svar här...'}
              className="bg-white/[0.07] border-white/10 text-white placeholder:text-white/30 min-h-[80px] max-h-[120px] resize-none text-sm rounded-2xl px-5 py-4 focus:outline-none focus:border-white/30 focus:bg-white/[0.09] transition-all duration-300"
            />
          </div>
        );

      case 'yes_no':
        return (
          <div className="flex justify-center gap-4">
            {[
              { value: 'yes', label: 'Ja' },
              { value: 'no', label: 'Nej' },
            ].map(({ value, label }) => {
              const isSelected = answer === value;
              return (
                <motion.button
                  key={value}
                  type="button"
                  onClick={() => handleYesNoAnswer(question.id, value, answer || '')}
                  whileTap={{ scale: 0.95 }}
                  className={
                    'relative min-w-[100px] min-h-[52px] rounded-2xl px-8 py-3.5 text-base font-semibold text-white transition-all duration-300 ' +
                    (isSelected
                      ? 'bg-white/20 border-2 border-white/40 shadow-[0_0_20px_rgba(255,255,255,0.08)]'
                      : 'bg-white/[0.06] border border-white/10 hover:bg-white/[0.1] hover:border-white/20')
                  }
                >
                  <span className="relative z-10">{label}</span>
                  {isSelected && (
                    <motion.div
                      layoutId="yes-no-indicator"
                      className="absolute inset-0 rounded-2xl bg-white/[0.05]"
                      initial={false}
                      transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                    />
                  )}
                </motion.button>
              );
            })}
          </div>
        );

      case 'multiple_choice':
        const selectedAnswers = typeof answer === 'string' 
          ? answer.split('|||').filter(a => a)
          : [];
          
        return (
          <div className="flex flex-wrap justify-center gap-3 max-w-lg mx-auto">
            {question.options?.filter(opt => opt.trim() !== '').map((option, index) => {
              const selected = selectedAnswers.includes(option);
              return (
                <motion.button
                  key={index}
                  type="button"
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    if (selectedAnswers.includes(option)) {
                      const newAnswers = selectedAnswers.filter(a => a !== option);
                      onAnswerChange(question.id, newAnswers.join('|||'));
                    } else {
                      onAnswerChange(question.id, [...selectedAnswers, option].join('|||'));
                    }
                  }}
                  className={
                    'rounded-2xl px-6 py-3 text-sm font-medium text-white transition-all duration-300 ' +
                    (selected
                      ? 'bg-white/20 border-2 border-white/40 shadow-[0_0_16px_rgba(255,255,255,0.06)]'
                      : 'bg-white/[0.06] border border-white/10 hover:bg-white/[0.1] hover:border-white/20')
                  }
                >
                  {option}
                </motion.button>
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
              className="bg-white/[0.07] border-white/10 text-white text-center text-lg font-light max-w-[180px] h-14 rounded-2xl placeholder:text-white/30 focus:outline-none focus:border-white/30 transition-all duration-300"
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
              className="bg-white/[0.07] border-white/10 text-white max-w-[200px] h-14 text-sm rounded-2xl focus:outline-none focus:border-white/30 transition-all duration-300"
            />
          </div>
        );

      case 'range':
        const rangeValue = answer || question.min_value || 0;
        return (
          <div className="space-y-4 max-w-xs mx-auto">
            <div className="flex justify-center">
              <motion.span 
                key={rangeValue}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-4xl font-light text-white tabular-nums"
              >
                {rangeValue}
              </motion.span>
            </div>
            <input
              type="range"
              min={question.min_value || 0}
              max={question.max_value || 10}
              value={rangeValue}
              onChange={(e) => onAnswerChange(question.id, parseInt(e.target.value))}
              className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-white/60"
            />
            <div className="flex justify-between text-xs text-white/30 font-light">
              <span>{question.min_value || 0}</span>
              <span>{question.max_value || 10}</span>
            </div>
          </div>
        );

      default:
        return (
          <div className="w-full max-w-md mx-auto">
            <Textarea
              value={answer || ''}
              onChange={(e) => onAnswerChange(question.id, e.target.value)}
              placeholder="Skriv ditt svar här..."
              className="bg-white/[0.07] border-white/10 text-white min-h-[80px] text-sm rounded-2xl px-5 py-4 placeholder:text-white/30 focus:outline-none focus:border-white/30 transition-all duration-300"
            />
          </div>
        );
    }
  };

  // Slide animation variants based on direction
  const slideVariants = {
    enter: (dir: number) => ({
      opacity: 0,
      x: dir > 0 ? 60 : -60,
    }),
    center: {
      opacity: 1,
      x: 0,
    },
    exit: (dir: number) => ({
      opacity: 0,
      x: dir > 0 ? -60 : 60,
    }),
  };

  return (
    <div className="space-y-6">
      {/* Progress dots — elegant step indicator */}
      <div className="flex items-center justify-center gap-2">
        {questions.map((_, idx) => {
          const isActive = idx === currentStep;
          const isCompleted = idx < currentStep || isSubmitStep;
          const isAnswered = answers[questions[idx].id] !== undefined && answers[questions[idx].id] !== '' && answers[questions[idx].id] !== null;
          
          return (
            <button
              key={idx}
              type="button"
              onClick={() => handleJumpToStep(idx)}
              className="p-0.5 focus:outline-none"
              aria-label={`Fråga ${idx + 1}`}
            >
              <motion.div
                animate={{
                  width: isActive ? 28 : 8,
                  height: 8,
                  opacity: isActive ? 1 : isCompleted || isAnswered ? 0.6 : 0.2,
                }}
                transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                className="rounded-full bg-white"
              />
            </button>
          );
        })}
        {/* Review step dot */}
        <button
          type="button"
          onClick={() => handleJumpToStep(questions.length)}
          className="p-0.5 focus:outline-none"
          aria-label="Granska"
        >
          <motion.div
            animate={{
              width: isSubmitStep ? 28 : 8,
              height: 8,
              opacity: isSubmitStep ? 1 : 0.2,
            }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className="rounded-full bg-white"
          />
        </button>
      </div>

      {/* Question container */}
      <div className="relative min-h-[220px] flex flex-col">
        <AnimatePresence mode="wait" custom={direction}>
          {!isSubmitStep && currentQuestion ? (
            <motion.div
              key={currentQuestion.id}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
              className="flex-1 flex flex-col"
            >
              {/* Question text — prominent, max 3 lines */}
              <div className="text-center mb-8 px-4">
                <h3 className="text-base md:text-lg font-medium text-white leading-relaxed line-clamp-3">
                  {currentQuestion.question_text}
                  {currentQuestion.is_required && (
                    <span className="ml-1 text-white/40 text-sm">*</span>
                  )}
                </h3>
              </div>

              {/* Answer input — centered with breathing room */}
              <div className="flex-1 flex items-start justify-center pt-2">
                <div className="w-full">
                  {renderQuestionInput(currentQuestion)}
                </div>
              </div>
            </motion.div>
          ) : isSubmitStep ? (
            <motion.div
              key="submit-step"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
              className="flex-1 flex flex-col"
            >
              {/* Review header */}
              <div className="text-center mb-5">
                <motion.div 
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1, type: 'spring', stiffness: 400, damping: 25 }}
                  className="w-12 h-12 rounded-full bg-white/[0.08] border border-white/10 flex items-center justify-center mx-auto mb-3"
                >
                  <CheckCircle className="w-5 h-5 text-white/70" />
                </motion.div>
                <h3 className="text-base font-medium text-white">Granska dina svar</h3>
                <p className="text-xs text-white/40 mt-1">Tryck på ett svar för att ändra</p>
              </div>

              {/* Answers summary */}
              <div className="flex-1 overflow-y-auto max-h-[220px] space-y-2 px-1">
                {questions.map((q, idx) => {
                  const answer = answers[q.id];
                  let displayAnswer = answer || '—';
                  
                  if (q.question_type === 'yes_no') {
                    displayAnswer = answer === 'yes' ? 'Ja' : answer === 'no' ? 'Nej' : '—';
                  } else if (q.question_type === 'multiple_choice' && typeof answer === 'string') {
                    displayAnswer = answer.split('|||').filter((a: string) => a).join(', ') || '—';
                  }
                  
                  const hasAnswer = displayAnswer !== '—';
                  
                  return (
                    <motion.button
                      key={q.id}
                      type="button"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      onClick={() => handleJumpToStep(idx)}
                      className="w-full text-left p-3 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] hover:border-white/10 transition-all duration-300 group"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-white/40 truncate mb-0.5">{q.question_text}</p>
                          <p className={`text-sm font-medium truncate ${hasAnswer ? 'text-white' : 'text-white/30'}`}>
                            {displayAnswer}
                          </p>
                        </div>
                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-white/[0.06] group-hover:bg-white/10 flex items-center justify-center transition-all duration-300">
                          <ArrowRight className="w-3 h-3 text-white/40 group-hover:text-white/70 transition-colors" />
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </div>

              {/* Contact email */}
              {contactEmail && (
                <div className="mt-4 text-center">
                  <a 
                    href={`mailto:${contactEmail}?subject=Fråga om tjänsten: ${jobTitle || ''}`}
                    className="text-xs text-white/30 hover:text-white/60 transition-colors duration-300 underline underline-offset-4 decoration-white/10 hover:decoration-white/30"
                  >
                    {contactEmail}
                  </a>
                </div>
              )}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {/* Navigation — clean and premium */}
      <div className="flex items-center justify-between">
        {/* Back button — ghost style */}
        <motion.div whileTap={{ scale: 0.95 }}>
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePrev}
            disabled={currentStep === 0}
            className="rounded-full text-white/50 hover:text-white hover:bg-white/[0.06] px-5 py-2.5 h-auto text-sm font-medium disabled:opacity-0 transition-all duration-300"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Tillbaka
          </Button>
        </motion.div>

        {/* Next / Submit button */}
        {!isSubmitStep ? (
          <motion.div whileTap={{ scale: 0.97 }}>
            <Button
              size="sm"
              onClick={handleNext}
              disabled={currentQuestion?.is_required && !isCurrentAnswered}
              className="rounded-full bg-white/[0.12] hover:bg-white/[0.18] text-white border border-white/10 hover:border-white/20 px-7 py-2.5 h-auto text-sm font-medium disabled:opacity-30 transition-all duration-300 shadow-[0_2px_12px_rgba(0,0,0,0.2)]"
            >
              {isLastQuestion ? 'Granska' : 'Nästa'}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </motion.div>
        ) : hasAlreadyApplied ? (
          <Button
            size="sm"
            disabled
            className="rounded-full bg-white/[0.06] text-white/50 px-7 py-2.5 h-auto text-sm font-medium cursor-default border border-white/10"
          >
            <CheckCircle className="mr-2 h-4 w-4" />
            Redan sökt
          </Button>
        ) : (
          <motion.div whileTap={{ scale: 0.97 }}>
            <Button
              size="sm"
              onClick={onSubmit}
              disabled={isSubmitting || !canSubmit}
              className="rounded-full bg-white/[0.15] hover:bg-white/[0.22] text-white border border-white/20 hover:border-white/30 px-8 py-2.5 h-auto text-sm font-semibold disabled:opacity-30 transition-all duration-300 shadow-[0_4px_20px_rgba(0,0,0,0.3)]"
            >
              {isSubmitting ? (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center"
                >
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                    className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full mr-2"
                  />
                  Skickar...
                </motion.span>
              ) : (
                <>
                  <Send className="mr-2 h-3.5 w-3.5" />
                  Skicka ansökan
                </>
              )}
            </Button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
