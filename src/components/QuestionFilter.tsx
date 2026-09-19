import React, { useState, useMemo, useRef, useEffect, useLayoutEffect, useCallback, memo } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { TruncatedText } from '@/components/ui/truncated-text';
import { Filter, Search, X, ChevronDown, MessageSquare } from 'lucide-react';
import { useOrganizationQuestions, OrganizationQuestion } from '@/hooks/useOrganizationQuestions';

// Question rows open immediately on tap. A deliberate long-press previews
// truncated text on touch without also opening or closing the answer choices.
const QuestionItem = memo(({ 
  question, 
  isSelected, 
  isExpanded, 
  allSelected, 
  selectedAnswers, 
  dropdownItemClass, 
  onToggle 
}: {
  question: OrganizationQuestion;
  isSelected: boolean;
  isExpanded: boolean;
  allSelected: boolean;
  selectedAnswers: string[];
  dropdownItemClass: string;
  onToggle: () => void;
}) => {
  const textRef = useRef<HTMLParagraphElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggeredRef = useRef(false);

  // Check truncation once on mount and when text changes
  useEffect(() => {
    const el = textRef.current;
    if (el) {
      setIsTruncated(el.scrollWidth > el.clientWidth);
    }
  }, [question.question_text]);

  // Clean up tooltip timeout on unmount
  useEffect(() => {
    return () => {
      if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
      if (longPressTimeoutRef.current) clearTimeout(longPressTimeoutRef.current);
    };
  }, []);

  const handleClick = useCallback(() => {
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      return;
    }
    setShowTooltip(false);
    onToggle();
  }, [onToggle]);

  const clearLongPress = useCallback(() => {
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
  }, []);

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType !== 'touch' || !isTruncated) return;
    longPressTriggeredRef.current = false;
    clearLongPress();
    longPressTimeoutRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true;
      setShowTooltip(true);
      if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
      tooltipTimeoutRef.current = setTimeout(() => setShowTooltip(false), 2500);
    }, 500);
  }, [clearLongPress, isTruncated]);

  const buttonContent = (
    <button
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerUp={clearLongPress}
      onPointerCancel={clearLongPress}
      onPointerLeave={clearLongPress}
      onContextMenu={(event) => {
        if (isTruncated) event.preventDefault();
      }}
      className={`${dropdownItemClass} w-full text-left text-white`}
    >
      <MessageSquare className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-white" />
      <div className="flex-1 min-w-0">
        <p ref={textRef} className="min-w-0 flex-1 truncate text-sm leading-tight text-white">{question.question_text}</p>
        {isSelected && (
          <p className="text-xs text-white mt-0.5">
            = {allSelected ? 'Alla' : selectedAnswers.join(', ')}
          </p>
        )}
      </div>
      <ChevronDown className={`h-3.5 w-3.5 transition-transform text-white ${isExpanded ? 'rotate-180' : ''}`} />
    </button>
  );

  if (isTruncated) {
    return (
      <Tooltip open={showTooltip} onOpenChange={setShowTooltip}>
        <TooltipTrigger asChild>
          {buttonContent}
        </TooltipTrigger>
        <TooltipContent side="bottom" align="start" className="max-w-[300px] bg-slate-900 border-white/20 text-white">
          {question.question_text}
        </TooltipContent>
      </Tooltip>
    );
  }

  return buttonContent;
});

const ActiveFilterChip = memo(({
  fullText,
  questionText,
  className,
  onRemove,
}: {
  fullText: string;
  questionText: string;
  className: string;
  onRemove: () => void;
}) => {
  const textRef = useRef<HTMLSpanElement>(null);
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggeredRef = useRef(false);
  const [isTruncated, setIsTruncated] = useState(false);
  const [tooltipOpen, setTooltipOpen] = useState(false);

  useEffect(() => {
    const text = textRef.current;
    if (!text) return;
    const measure = () => setIsTruncated(text.scrollWidth > text.clientWidth + 1);
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(text);
    return () => observer?.disconnect();
  }, [fullText]);

  useEffect(() => () => {
    if (longPressRef.current) clearTimeout(longPressRef.current);
    if (closeRef.current) clearTimeout(closeRef.current);
  }, []);

  const clearLongPress = useCallback(() => {
    if (!longPressRef.current) return;
    clearTimeout(longPressRef.current);
    longPressRef.current = null;
  }, []);

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'touch' || !isTruncated) return;
    longPressTriggeredRef.current = false;
    clearLongPress();
    longPressRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true;
      setTooltipOpen(true);
      if (closeRef.current) clearTimeout(closeRef.current);
      closeRef.current = setTimeout(() => setTooltipOpen(false), 2500);
    }, 500);
  }, [clearLongPress, isTruncated]);

  const chip = (
    <div
      className={className}
      onPointerDown={handlePointerDown}
      onPointerUp={clearLongPress}
      onPointerCancel={clearLongPress}
      onPointerLeave={clearLongPress}
      onContextMenu={(event) => {
        if (isTruncated) event.preventDefault();
      }}
    >
      <span ref={textRef} className="truncate min-w-0">{fullText}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={`Ta bort filtret ${questionText}`}
        onClick={(event) => {
          event.stopPropagation();
          longPressTriggeredRef.current = false;
          onRemove();
        }}
        className="ml-0.5 !h-5 !w-5 min-h-0 flex-shrink-0 text-white hover:text-red-400"
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );

  if (!isTruncated) return chip;

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip open={tooltipOpen} onOpenChange={setTooltipOpen}>
        <TooltipTrigger asChild>{chip}</TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs bg-slate-900 border-white/20 text-white">
          <p>{fullText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});

export interface QuestionFilterValue {
  question: string;
  answers: string[]; // empty array means "any answer", multiple values for multi-select
}

interface QuestionFilterProps {
  value: QuestionFilterValue[];
  onChange: (filters: QuestionFilterValue[]) => void;
  hideChips?: boolean;
  chipsOnly?: boolean;
}

// Default options for text/yes-no questions
const YES_NO_OPTIONS = ['Ja', 'Nej'];

export const QuestionFilter = ({ value, onChange, hideChips, chipsOnly }: QuestionFilterProps) => {
  const { data: questions, isLoading } = useOrganizationQuestions();
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);
  const [canScrollDown, setCanScrollDown] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const popoverContentRef = useRef<HTMLDivElement>(null);

  // Radix keeps the popover beside its trigger. On narrow screens that can
  // leave the full-width panel visually off-centre (including desktop browsers
  // previewing the mobile layout, where the pointer is a mouse), so centre the
  // panel against the visible viewport whenever it renders at mobile width.
  useLayoutEffect(() => {
    if (!open || window.innerWidth >= 640) return;

    let frameId: number | null = null;
    const centerPopover = () => {
      const content = popoverContentRef.current;
      if (!content) return;

      // Inside an embedded preview frame visualViewport can describe the outer
      // browser window instead of this document, which would shift the panel
      // sideways. Only trust it when it matches this document's own width.
      const viewport = window.visualViewport;
      const layoutWidth = document.documentElement.clientWidth || window.innerWidth;
      const trustVisualViewport =
        !!viewport && Math.abs(viewport.width - layoutWidth) <= 40;
      const viewportLeft = trustVisualViewport ? viewport!.offsetLeft : 0;
      const viewportWidth = trustVisualViewport ? viewport!.width : layoutWidth;
      const bounds = content.getBoundingClientRect();
      const currentShift = Number.parseFloat(content.style.getPropertyValue('--question-filter-mobile-shift')) || 0;
      const nextShift = currentShift + viewportLeft + viewportWidth / 2 - (bounds.left + bounds.width / 2);
      content.style.setProperty('--question-filter-mobile-shift', `${nextShift}px`);
    };

    centerPopover();
    frameId = requestAnimationFrame(centerPopover);
    window.addEventListener('resize', centerPopover);
    window.visualViewport?.addEventListener('resize', centerPopover);
    window.visualViewport?.addEventListener('scroll', centerPopover);

    return () => {
      if (frameId !== null) cancelAnimationFrame(frameId);
      window.removeEventListener('resize', centerPopover);
      window.visualViewport?.removeEventListener('resize', centerPopover);
      window.visualViewport?.removeEventListener('scroll', centerPopover);
    };
  }, [open]);

  // Throttled scroll indicator to avoid excessive re-renders on touch
  const scrollRAF = useRef<number | null>(null);
  const updateScrollIndicator = useCallback(() => {
    if (scrollRAF.current) return;
    scrollRAF.current = requestAnimationFrame(() => {
      scrollRAF.current = null;
      const container = scrollContainerRef.current;
      if (container) {
        const hasMoreToScroll = container.scrollHeight - container.scrollTop - container.clientHeight > 5;
        setCanScrollDown(hasMoreToScroll);
      }
    });
  }, []);

  // Filter questions by search term AND only show filterable types
  const filterableTypes = ['select', 'radio', 'checkbox', 'boolean', 'yes_no'];
  
  const { filterableQuestions, unfilteredCount } = useMemo(() => {
    if (!questions) return { filterableQuestions: [], unfilteredCount: 0 };
    
    // Separate filterable from non-filterable
    const filterable = questions.filter(q => 
      filterableTypes.includes(q.question_type) || 
      (q.options && q.options.length > 0)
    );
    const nonFilterable = questions.filter(q => 
      !filterableTypes.includes(q.question_type) && 
      (!q.options || q.options.length === 0)
    );
    
    // Apply search filter
    let searchFiltered = filterable;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      searchFiltered = filterable.filter(q => 
        q.question_text.toLowerCase().includes(term)
      );
    }
    
    return { 
      filterableQuestions: searchFiltered, 
      unfilteredCount: nonFilterable.length 
    };
  }, [questions, searchTerm]);

  // Update scroll indicator when questions change or popover opens
  useEffect(() => {
    if (open) {
      // Use requestAnimationFrame for immediate update after DOM changes
      const updateAfterRender = () => {
        requestAnimationFrame(() => {
          updateScrollIndicator();
        });
      };
      updateAfterRender();
    }
  }, [open, filterableQuestions, expandedQuestion, updateScrollIndicator]);

  // Check if a question is selected
  const isQuestionSelected = (questionText: string) => {
    return value.some(v => v.question === questionText);
  };

  // Get selected answers for a question
  const getSelectedAnswers = (questionText: string): string[] => {
    const filter = value.find(v => v.question === questionText);
    return filter?.answers ?? [];
  };

  // Check if "Alla" is selected (empty answers array)
  const isAllSelected = (questionText: string): boolean => {
    const filter = value.find(v => v.question === questionText);
    return filter ? filter.answers.length === 0 : false;
  };

  // Toggle a specific answer for a question (multi-select)
  const toggleAnswer = (questionText: string, answer: string, options: string[]) => {
    const currentAnswers = getSelectedAnswers(questionText);
    const isCurrentlyAll = currentAnswers.length === 0;
    
    let newAnswers: string[];
    
    if (isCurrentlyAll) {
      // Was "Alla", now select this specific answer
      newAnswers = [answer];
    } else if (currentAnswers.includes(answer)) {
      // Remove this answer
      newAnswers = currentAnswers.filter(a => a !== answer);
      // If no answers left, remove the filter entirely
      if (newAnswers.length === 0) {
        onChange(value.filter(v => v.question !== questionText));
        return;
      }
    } else if (options.length <= 2) {
      // Ja/Nej-frågor byter direkt — ett tryck räcker, aldrig via "Alla".
      newAnswers = [answer];
    } else {
      // Add this answer — valet stannar exakt där användaren satte det.
      newAnswers = [...currentAnswers, answer];
    }
    
    const existingIndex = value.findIndex(v => v.question === questionText);
    if (existingIndex >= 0) {
      const newValue = [...value];
      newValue[existingIndex] = { question: questionText, answers: newAnswers };
      onChange(newValue);
    } else {
      onChange([...value, { question: questionText, answers: newAnswers }]);
    }
  };

  // Set "Alla" (any answer)
  const setAllAnswers = (questionText: string) => {
    const existingIndex = value.findIndex(v => v.question === questionText);
    if (existingIndex >= 0) {
      // If already "Alla", remove filter
      if (value[existingIndex].answers.length === 0) {
        onChange(value.filter(v => v.question !== questionText));
        return;
      }
      // Otherwise set to "Alla"
      const newValue = [...value];
      newValue[existingIndex] = { question: questionText, answers: [] };
      onChange(newValue);
    } else {
      onChange([...value, { question: questionText, answers: [] }]);
    }
  };

  // Remove a specific filter
  const removeFilter = (questionText: string) => {
    onChange(value.filter(v => v.question !== questionText));
  };

  // Clear all filters
  const clearAll = () => {
    onChange([]);
    setOpen(false);
  };

  // Get options for a question - use yes/no for text questions
  const getQuestionOptions = (question: OrganizationQuestion): string[] => {
    if (question.options && question.options.length > 0) {
      return question.options;
    }
    // Text questions get Ja/Nej options
    return YES_NO_OPTIONS;
  };

  const hasFilters = value.length > 0;

  // Dropdown styling matching nav dropdowns - left aligned
  const dropdownContentClass = "question-filter-content w-[calc(100vw-2rem)] min-w-0 sm:w-[22rem] sm:max-w-[calc(100vw-2rem)] lg:w-[24rem] glass-panel shadow-xl z-[10000] rounded-lg p-0 flex max-h-[min(480px,var(--radix-popover-content-available-height))] flex-col overflow-hidden";
  const dropdownItemClass = "flex items-start gap-2 cursor-pointer text-white md:hover:bg-white/15 focus-visible:bg-white/15 focus:outline-none rounded-md px-3 py-3 text-sm transition-colors min-h-[44px] touch-manipulation [-webkit-tap-highlight-color:transparent]";

  // chipsOnly mode: only render the filter chips
  if (chipsOnly) {
    return (
      <>
        {value.map((filter) => {
          const displayText = filter.answers.length === 0 ? 'Alla' : filter.answers.join(', ');
          const fullText = `${filter.question}: ${displayText}`;

          return (
            <ActiveFilterChip
              key={filter.question}
              fullText={fullText}
              questionText={filter.question}
              onRemove={() => removeFilter(filter.question)}
              className="px-3 py-1.5 text-xs font-medium rounded-full transition-all text-white ring-1 ring-inset ring-white/20 backdrop-blur-sm max-w-[240px] min-w-0 inline-flex items-center gap-1 bg-white/10 hover:bg-white/15"
            />
          );
        })}

      </>
    );
  }

  const filterLabel = value.length === 1 ? 'Filtrera på fråga' : 'Filtrera på frågor';

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Main filter button - matching nav dropdown triggers */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            className={`
              flex items-center justify-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all
              border whitespace-nowrap min-w-0 flex-shrink-0
              ${open || hasFilters 
                ? 'bg-white/20 border-white/30 text-white' 
                : 'bg-white/5 border-white/20 text-white hover:bg-white/10 hover:border-white/50'
              }
            `}
          >
            <span className="truncate">{filterLabel}</span>
            {hasFilters && (
              <span className="text-white text-xs">({value.length})</span>
            )}
            <ChevronDown className={`h-3 w-3 text-white transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
          </button>
        </PopoverTrigger>
        <PopoverContent 
          ref={popoverContentRef}
          align="start" 
          className={dropdownContentClass}
          sideOffset={8}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="question-filter-header px-2.5 py-1.5 border-b border-white/10">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white" />
              <input
                type="text"
                placeholder="Sök efter fråga..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-7 pr-2 py-1 bg-transparent border-0 text-white placeholder:text-white/50 text-sm focus:outline-none focus:ring-0"
              />
            </div>
          </div>

          <div className="question-filter-list relative min-h-0 flex-1">
            <div 
              ref={scrollContainerRef}
              onScroll={updateScrollIndicator}
              className="question-filter-scroll no-chrome-pad h-full min-h-0 overflow-y-auto scrollbar-none overscroll-contain [-webkit-overflow-scrolling:touch]"
            >
              {isLoading ? (
                <div className="p-4 text-center text-white text-sm">
                  Laddar frågor...
                </div>
              ) : filterableQuestions.length === 0 ? (
                <div className="p-4 text-center text-white text-sm">
                  {questions?.length === 0 
                    ? 'Inga frågor skapade än'
                    : 'Inga filterbara frågor hittades'
                  }
                </div>
              ) : (
                <div className="p-2 space-y-0">
                  {filterableQuestions.map((question, index) => {
                    const isSelected = isQuestionSelected(question.question_text);
                    const isExpanded = expandedQuestion === question.question_text;
                    const options = getQuestionOptions(question);
                    const selectedAnswers = getSelectedAnswers(question.question_text);
                    const allSelected = isAllSelected(question.question_text);
                    const isLastQuestion = index === filterableQuestions.length - 1;

                    return (
                      <div key={question.question_text}>
                        <div className="space-y-1 py-1">
                          <QuestionItem
                            question={question}
                            isSelected={isSelected}
                            isExpanded={isExpanded}
                            allSelected={allSelected}
                            selectedAnswers={selectedAnswers}
                            dropdownItemClass={dropdownItemClass}
                            onToggle={() => {
                              const willExpand = !isExpanded;
                              // Immediately show gradient when expanding to avoid flash
                              if (willExpand) {
                                setCanScrollDown(true);
                              }
                              setExpandedQuestion(willExpand ? question.question_text : null);
                            }}
                          />

                          {/* Options dropdown - always show for all questions */}
                          {isExpanded && (
                            <div className="space-y-0.5 pl-2">
                              {/* Alla option */}
                                <button
                                onClick={() => setAllAnswers(question.question_text)}
                                className="w-full flex min-h-[40px] touch-manipulation items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm text-white transition-colors [-webkit-tap-highlight-color:transparent] focus:outline-none focus-visible:bg-white/15 md:hover:bg-white/15"
                              >
                                <Checkbox 
                                  checked={allSelected}
                                  className="h-3.5 w-3.5 border-white/50 data-[state=checked]:bg-primary pointer-events-none"
                                />
                                <span className="text-white">Alla</span>
                              </button>

                              {/* Specific answer options - multi-select */}
                              {options.map((option) => {
                                const isOptionSelected = selectedAnswers.includes(option);
                                return (
                                  <button
                                    key={option}
                                    onClick={() => toggleAnswer(question.question_text, option, options)}
                                    className="w-full flex min-h-[40px] touch-manipulation items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm text-white transition-colors [-webkit-tap-highlight-color:transparent] focus:outline-none focus-visible:bg-white/15 md:hover:bg-white/15"
                                  >
                                    <Checkbox 
                                      checked={isOptionSelected}
                                      className="h-3.5 w-3.5 border-white/50 data-[state=checked]:bg-primary pointer-events-none"
                                    />
                                    <TruncatedText text={option} className="truncate text-white min-w-0" insideInteractive />
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                        
                        {/* Separator line between questions */}
                        {!isLastQuestion && (
                          <div className="mx-2 border-t border-white/10" />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Scroll indicator gradient */}
            {canScrollDown && (
              <div 
                className="question-filter-scroll-fade absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-slate-900/90 to-transparent pointer-events-none rounded-b-lg"
                aria-hidden="true"
              />
            )}
          </div>

          {/* Total question count (only filterable questions are listed) */}
          {filterableQuestions.length > 0 && (
            <div className="question-filter-footer px-2.5 py-1.5 border-t border-white/10 text-xs text-white text-center">
              {`Totalt ${filterableQuestions.length} ${filterableQuestions.length === 1 ? 'fråga' : 'frågor'}`}
            </div>
          )}

          {hasFilters && (
            <div className="question-filter-footer flex justify-center p-2 border-t border-white/10">
              <button
                type="button"
                onClick={clearAll}
                className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-5 py-2 text-sm font-medium text-white transition-colors touch-manipulation [-webkit-tap-highlight-color:transparent] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 md:hover:bg-white/20"
              >
                <X className="h-3.5 w-3.5" />
                Rensa alla filter
              </button>
            </div>
          )}
        </PopoverContent>
      </Popover>

      {/* Active filter badges - only when not hideChips */}
      {!hideChips && value.map((filter) => {
        const displayText = filter.answers.length === 0 ? 'Alla' : filter.answers.join(', ');
        const fullText = `${filter.question}: ${displayText}`;
        return (
          <ActiveFilterChip
            key={filter.question}
            fullText={fullText}
            questionText={filter.question}
            onRemove={() => removeFilter(filter.question)}
            className="px-3 py-1.5 text-xs font-medium rounded-full transition-all text-white ring-1 ring-inset ring-white/20 backdrop-blur-sm max-w-[200px] min-w-0 inline-flex items-center gap-1 bg-white/10 hover:bg-white/15"
          />
        );
      })}
    </div>
  );
};
