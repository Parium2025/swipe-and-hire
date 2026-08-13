import { useCallback, useEffect, useMemo, useState } from 'react';
import { flushSync } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { ApplicationQuestionsWizard } from '@/components/ApplicationQuestionsWizard';
import { TruncatedText } from '@/components/TruncatedText';
import { ApplicationLimitDialog } from '@/components/premium/ApplicationLimitDialog';
import type { SwipeJob } from './types';
import { useApplyData } from './hooks/useApplyData';
import { useApplySubmit } from './hooks/useApplySubmit';

interface SwipeApplySheetProps {
  jobId: string;
  jobTitle: string;
  companyName: string;
  job?: SwipeJob;
  open: boolean;
  onClose: () => void;
  onApplied: () => void;
}

export function SwipeApplySheet({ jobId, jobTitle, companyName, open, onClose, onApplied }: SwipeApplySheetProps) {
  const { user } = useAuth();
  const [isClosing, setIsClosing] = useState(false);

  const {
    questions,
    answers,
    setAnswers,
    contactEmail,
    hasAlreadyApplied,
    loading,
  } = useApplyData(jobId, open, user?.id);

  const {
    submitting,
    submitted,
    setSubmitted,
    showLimitDialog,
    setShowLimitDialog,
    quota,
    handleSubmit,
  } = useApplySubmit({
    jobId,
    jobTitle,
    companyName,
    answers,
    userId: user?.id,
    userEmail: user?.email,
    onApplied,
  });

  useEffect(() => {
    if (open) {
      setIsClosing(false);
      // 🐛 Flash-bug fix: nollställ submitted vid varje öppning så att
      // "Ansökan skickad!"-skärmen inte blixtras för nästa jobb.
      setSubmitted(false);
    }
  }, [open, setSubmitted]);

  const handleAnswerChange = useCallback((questionId: string, value: any) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }, [setAnswers]);

  const handleSheetClose = useCallback(() => {
    flushSync(() => {
      setIsClosing(true);
    });
    onClose();
  }, [onClose]);

  const handleClosePointerDown = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    handleSheetClose();
  }, [handleSheetClose]);

  const handleCloseKeyDown = useCallback((event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    handleSheetClose();
  }, [handleSheetClose]);

  const canSubmit = useMemo(() => {
    return questions
      .filter((q) => q.is_required)
      .every((q) => {
        const a = answers[q.id];
        return a !== undefined && a !== null && a !== '' && (typeof a !== 'string' || a.trim() !== '');
      });
  }, [questions, answers]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 z-30 bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onPointerDown={(event) => {
              event.stopPropagation();
              handleSheetClose();
            }}
          />

          {/* Sheet — drag down to dismiss */}
          <motion.div
            className="absolute inset-x-0 bottom-0 z-40 max-h-[92dvh] bg-parium-gradient rounded-t-3xl overflow-hidden flex flex-col"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 400 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_e, info) => {
              if (info.offset.y > 100 || info.velocity.y > 500) {
                handleSheetClose();
              }
            }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-2 shrink-0">
              <div className="w-10 h-1.5 rounded-full bg-white/30" />
            </div>

            {/* Close */}
            <button
              onPointerDown={handleClosePointerDown}
              onClick={(event) => event.preventDefault()}
              onKeyDown={handleCloseKeyDown}
              className="absolute top-3 right-4 z-10 flex h-11 w-11 !min-h-0 !min-w-0 items-center justify-center touch-manipulation"
              aria-label="Stäng"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 transition-all active:scale-90 [@media(hover:hover)]:hover:bg-white/20">
                <X className="h-5 w-5 text-white" />
              </div>
            </button>

            {/* Header */}
            <div className="px-4 pr-14 pb-1 shrink-0">
              <TruncatedText
                text={companyName}
                className="text-white text-sm font-medium mt-1 max-w-full"
                tooltipSide="bottom"
                style={{
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              />
              <TruncatedText
                text={jobTitle}
                className="text-xl font-bold text-white leading-[1.2] tracking-tight mt-0.5 line-clamp-2 pb-[0.12em]"
                tooltipSide="bottom"
                forceClosed={isClosing}
                instantClose
              />
            </div>

            {/* Content */}
            <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-6 pt-1" style={{ WebkitOverflowScrolling: 'touch' }}>
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-6 h-6 text-white/50 animate-spin" />
                </div>
              ) : submitted ? (
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="flex flex-col items-center justify-center py-20 text-center space-y-4"
                >
                  <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
                    <CheckCircle className="w-8 h-8 text-green-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white">Ansökan skickad!</h3>
                  <p className="text-white/80 text-sm max-w-xs">
                    Din profil och svar har skickats till {companyName}. Lycka till!
                  </p>
                </motion.div>
              ) : (
                <>
                  {questions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center space-y-6">
                      <p className="text-white text-sm max-w-xs">
                        Inga frågor att besvara. Din profilinformation skickas direkt med ansökan.
                      </p>
                      <button
                        onClick={handleSubmit}
                        disabled={submitting || hasAlreadyApplied}
                        className={`h-14 px-10 rounded-full font-semibold text-base transition-all active:scale-[0.97] ${
                          hasAlreadyApplied
                            ? 'bg-green-500 text-white cursor-not-allowed'
                            : 'bg-green-500 text-white shadow-lg shadow-green-500/30'
                        }`}
                      >
                        {hasAlreadyApplied ? 'Redan sökt' : submitting ? 'Skickar...' : 'Skicka ansökan'}
                      </button>
                    </div>
                  ) : (
                    <ApplicationQuestionsWizard
                      questions={questions}
                      answers={answers}
                      onAnswerChange={handleAnswerChange}
                      onSubmit={handleSubmit}
                      isSubmitting={submitting}
                      canSubmit={canSubmit}
                      hasAlreadyApplied={hasAlreadyApplied}
                    />
                  )}
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
      <ApplicationLimitDialog
        open={showLimitDialog}
        onClose={() => setShowLimitDialog(false)}
        used={quota.used}
        limit={quota.limit}
        resetAt={quota.reset_at}
      />
    </AnimatePresence>
  );
}
