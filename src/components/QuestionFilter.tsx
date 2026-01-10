import { useState, useMemo } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Filter, Search, X, ChevronDown, MessageSquare } from 'lucide-react';
import { useOrganizationQuestions, OrganizationQuestion } from '@/hooks/useOrganizationQuestions';

export interface QuestionFilterValue {
  question: string;
  answer: string | null; // null means "any answer to this question"
}

interface QuestionFilterProps {
  value: QuestionFilterValue[];
  onChange: (filters: QuestionFilterValue[]) => void;
}

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

  // Get selected answer for a question
  const getSelectedAnswer = (questionText: string): string | null => {
    const filter = value.find(v => v.question === questionText);
    return filter?.answer ?? null;
  };

  // Toggle question filter (any answer)
  const toggleQuestion = (question: OrganizationQuestion) => {
    if (isQuestionSelected(question.question_text)) {
      // Remove this question from filters
      onChange(value.filter(v => v.question !== question.question_text));
    } else {
      // Add with null answer (means "any answer")
      onChange([...value, { question: question.question_text, answer: null }]);
    }
  };

  // Set specific answer for a question
  const setAnswer = (questionText: string, answer: string) => {
    const existingIndex = value.findIndex(v => v.question === questionText);
    if (existingIndex >= 0) {
      // Update existing
      const newValue = [...value];
      newValue[existingIndex] = { question: questionText, answer };
      onChange(newValue);
    } else {
      // Add new
      onChange([...value, { question: questionText, answer }]);
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

  const hasFilters = value.length > 0;

  // Dropdown styling matching nav dropdowns
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
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Sök efter fråga..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 bg-white/5 border-white/20 text-white placeholder:text-muted-foreground text-sm"
              />
            </div>
          </div>

          <ScrollArea className="max-h-72">
            {isLoading ? (
              <div className="p-4 text-center text-muted-foreground text-sm">
                Laddar frågor...
              </div>
            ) : filteredQuestions.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground text-sm">
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
                  const hasOptions = question.options && question.options.length > 0;
                  const selectedAnswer = getSelectedAnswer(question.question_text);

                  return (
                    <div key={question.question_text} className="space-y-1">
                      <button
                        onClick={() => {
                          if (hasOptions) {
                            setExpandedQuestion(isExpanded ? null : question.question_text);
                          } else {
                            toggleQuestion(question);
                          }
                        }}
                        className={`${dropdownItemClass} w-full text-left ${
                          isSelected 
                            ? 'bg-white/15 text-white' 
                            : 'text-muted-foreground hover:text-white'
                        }`}
                      >
                        <MessageSquare className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm leading-tight truncate font-medium">{question.question_text}</p>
                          {selectedAnswer && (
                            <p className="text-xs text-primary mt-0.5">= "{selectedAnswer}"</p>
                          )}
                        </div>
                        {hasOptions && (
                          <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        )}
                        {!hasOptions && (
                          <Checkbox 
                            checked={isSelected}
                            className="border-white/50 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                          />
                        )}
                      </button>

                      {/* Options dropdown */}
                      {isExpanded && hasOptions && (
                        <div className="ml-6 pl-2 border-l border-white/10 space-y-0.5">
                          {/* Any answer option */}
                          <button
                            onClick={() => {
                              if (isSelected && selectedAnswer === null) {
                                removeFilter(question.question_text);
                              } else {
                                onChange([
                                  ...value.filter(v => v.question !== question.question_text),
                                  { question: question.question_text, answer: null }
                                ]);
                              }
                            }}
                            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-sm transition-colors ${
                              isSelected && selectedAnswer === null
                                ? 'bg-white/15 text-white'
                                : 'hover:bg-white/20 text-muted-foreground hover:text-white'
                            }`}
                          >
                            <Checkbox 
                              checked={isSelected && selectedAnswer === null}
                              className="h-3.5 w-3.5 border-white/50 data-[state=checked]:bg-primary"
                            />
                            <span className="italic">Alla svar</span>
                          </button>

                          {/* Specific answer options */}
                          {question.options!.map((option) => (
                            <button
                              key={option}
                              onClick={() => {
                                if (selectedAnswer === option) {
                                  removeFilter(question.question_text);
                                } else {
                                  setAnswer(question.question_text, option);
                                }
                              }}
                              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-sm transition-colors ${
                                selectedAnswer === option
                                  ? 'bg-white/15 text-white'
                                  : 'hover:bg-white/20 text-muted-foreground hover:text-white'
                              }`}
                            >
                              <Checkbox 
                                checked={selectedAnswer === option}
                                className="h-3.5 w-3.5 border-white/50 data-[state=checked]:bg-primary"
                              />
                              <span className="truncate">{option}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          {hasFilters && (
            <div className="p-2 border-t border-white/10">
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAll}
                className="w-full text-muted-foreground hover:text-white"
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
          <span className="truncate max-w-32">
            {filter.question.length > 25 
              ? filter.question.slice(0, 25) + '...' 
              : filter.question
            }
            {filter.answer && `: ${filter.answer}`}
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
