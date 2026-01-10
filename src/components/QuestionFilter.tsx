import { useState, useMemo } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Filter, Search, X, ChevronDown, MessageSquare } from 'lucide-react';
import { useOrganizationQuestions, OrganizationQuestion } from '@/hooks/useOrganizationQuestions';

export interface QuestionFilterValue {
  question: string;
  answers: string[]; // empty array means "any answer", multiple values for multi-select
}

interface QuestionFilterProps {
  value: QuestionFilterValue[];
  onChange: (filters: QuestionFilterValue[]) => void;
}

// Default options for text/yes-no questions
const YES_NO_OPTIONS = ['Ja', 'Nej'];

export const QuestionFilter = ({ value, onChange }: QuestionFilterProps) => {
  const { data: questions, isLoading } = useOrganizationQuestions();
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);

  // Filter questions by search term
  const filteredQuestions = useMemo(() => {
    if (!questions) return [];
    if (!searchTerm.trim()) return questions;
    
    const term = searchTerm.toLowerCase();
    return questions.filter(q => 
      q.question_text.toLowerCase().includes(term)
    );
  }, [questions, searchTerm]);

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
    } else {
      // Add this answer
      newAnswers = [...currentAnswers, answer];
      // If all options are selected, switch to "Alla"
      if (newAnswers.length === options.length) {
        newAnswers = [];
      }
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
  const dropdownContentClass = "min-w-[280px] bg-slate-900/85 backdrop-blur-xl border border-white/20 shadow-xl z-[10000] rounded-lg p-0";
  const dropdownItemClass = "flex items-start gap-2 cursor-pointer text-white hover:bg-white/20 focus:bg-white/20 rounded-md px-2.5 py-2 text-sm transition-colors";

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Main filter button - matching nav dropdown triggers */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            className={`
              flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all
              ${hasFilters 
                ? 'bg-white/20 text-white' 
                : 'text-white hover:bg-white/10'
              }
            `}
          >
            <Filter className="h-4 w-4" />
            <span>Filtrera på frågor</span>
            {hasFilters && (
              <span className="text-white text-xs">({value.length})</span>
            )}
            <ChevronDown className="h-3 w-3 text-white" />
          </button>
        </PopoverTrigger>
        <PopoverContent 
          align="start" 
          className={dropdownContentClass}
          sideOffset={8}
        >
          <div className="p-3 border-b border-white/10">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
              <input
                type="text"
                placeholder="Sök efter fråga..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-transparent border-0 text-white placeholder:text-white/50 text-sm focus:outline-none focus:ring-0"
              />
            </div>
          </div>

          <div className="max-h-[320px] overflow-y-auto scrollbar-none">
            {isLoading ? (
              <div className="p-4 text-center text-white text-sm">
                Laddar frågor...
              </div>
            ) : filteredQuestions.length === 0 ? (
              <div className="p-4 text-center text-white/70 text-sm">
                {questions?.length === 0 
                  ? 'Inga frågor skapade än'
                  : 'Inga frågor matchar sökningen'
                }
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {filteredQuestions.map((question) => {
                  const isSelected = isQuestionSelected(question.question_text);
                  const isExpanded = expandedQuestion === question.question_text;
                  const options = getQuestionOptions(question);
                  const selectedAnswers = getSelectedAnswers(question.question_text);
                  const allSelected = isAllSelected(question.question_text);

                  return (
                    <div key={question.question_text} className="space-y-1">
                      <button
                        onClick={() => {
                          setExpandedQuestion(isExpanded ? null : question.question_text);
                        }}
                        className={`${dropdownItemClass} w-full text-left ${
                          isSelected 
                            ? 'bg-white/15 text-white' 
                            : 'text-white hover:text-white'
                        }`}
                      >
                        <MessageSquare className="h-4 w-4 mt-0.5 flex-shrink-0 text-white" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm leading-tight truncate font-medium text-white">{question.question_text}</p>
                          {isSelected && (
                            <p className="text-xs text-white/70 mt-0.5">
                              = {allSelected ? 'Alla' : selectedAnswers.join(', ')}
                            </p>
                          )}
                        </div>
                        <ChevronDown className={`h-4 w-4 transition-transform text-white ${isExpanded ? 'rotate-180' : ''}`} />
                      </button>

                      {/* Options dropdown - always show for all questions */}
                      {isExpanded && (
                        <div className="space-y-0.5 pl-2">
                          {/* Alla option */}
                          <button
                            onClick={() => setAllAnswers(question.question_text)}
                            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-sm transition-colors ${
                              allSelected
                                ? 'bg-white/15 text-white'
                                : 'hover:bg-white/20 text-white'
                            }`}
                          >
                            <Checkbox 
                              checked={allSelected}
                              className="h-3.5 w-3.5 border-white/50 data-[state=checked]:bg-primary"
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
                                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-sm transition-colors ${
                                  isOptionSelected
                                    ? 'bg-white/15 text-white'
                                    : 'hover:bg-white/20 text-white'
                                }`}
                              >
                                <Checkbox 
                                  checked={isOptionSelected}
                                  className="h-3.5 w-3.5 border-white/50 data-[state=checked]:bg-primary"
                                />
                                <span className="truncate text-white">{option}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {hasFilters && (
            <div className="p-2 border-t border-white/10">
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAll}
                className="w-full text-white hover:text-white hover:bg-white/10"
              >
                <X className="h-3.5 w-3.5 mr-1" />
                Rensa alla filter
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>

      {/* Active filter badges */}
      {value.map((filter) => (
        <Badge
          key={filter.question}
          variant="outline"
          className="gap-1 bg-primary/20 border-primary/50 text-white py-1 px-2"
        >
          <span className="truncate max-w-32 text-white">
            {filter.question.length > 20 
              ? filter.question.slice(0, 20) + '...' 
              : filter.question
            }
            : {filter.answers.length === 0 ? 'Alla' : filter.answers.join(', ')}
          </span>
          <button
            onClick={() => removeFilter(filter.question)}
            className="ml-1 hover:text-red-400 transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
    </div>
  );
};
