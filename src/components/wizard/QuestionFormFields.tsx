import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Plus, Minus, X } from 'lucide-react';
import { JobQuestion, QUESTION_TYPES, getQuestionTypeLabel } from '@/types/jobWizard';
import DropdownField from './DropdownField';

interface QuestionFormFieldsProps {
  question: JobQuestion;
  onUpdateField: <K extends keyof JobQuestion>(field: K, value: JobQuestion[K]) => void;
  onAddOption: () => void;
  onUpdateOption: (index: number, value: string) => void;
  onRemoveOption: (index: number) => void;
  questionTypeDropdown: {
    isOpen: boolean;
    searchTerm: string;
    onToggle: () => void;
    onSearchChange: (term: string) => void;
  };
}

export const QuestionFormFields = ({
  question,
  onUpdateField,
  onAddOption,
  onUpdateOption,
  onRemoveOption,
  questionTypeDropdown,
}: QuestionFormFieldsProps) => {
  return (
    <div className="space-y-4">
      {/* Question Type Dropdown */}
      <DropdownField
        label="Frågetyp"
        required
        value={question.question_type}
        displayValue={getQuestionTypeLabel(question.question_type)}
        placeholder="Välj frågetyp"
        options={QUESTION_TYPES}
        isOpen={questionTypeDropdown.isOpen}
        searchTerm={questionTypeDropdown.searchTerm}
        onToggle={questionTypeDropdown.onToggle}
        onSelect={(value) => onUpdateField('question_type', value as JobQuestion['question_type'])}
        onSearchChange={questionTypeDropdown.onSearchChange}
        showSearch={false}
      />

      {/* Question Text */}
      <div className="space-y-2">
        <Label className="text-white text-sm font-medium">
          Rubrik <span className="text-red-400">*</span>
        </Label>
        <Input
          value={question.question_text}
          onChange={(e) => onUpdateField('question_text', e.target.value)}
          placeholder="T.ex. Antal års erfarenhet inom..."
          className="bg-white/10 border-white/20 text-white placeholder:text-white/60 h-9 text-sm focus:border-white/40"
        />
      </div>

      {/* Multiple choice options */}
      {question.question_type === 'multiple_choice' && (
        <div className="space-y-2">
          <Label className="text-white text-sm font-medium">
            Alternativ <span className="text-red-400">*</span>
          </Label>
          <div className="space-y-2">
            {(question.options || []).map((option, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  value={option}
                  onChange={(e) => onUpdateOption(index, e.target.value)}
                  placeholder={`Alternativ ${index + 1}`}
                  className="flex-1 bg-white/10 border-white/20 text-white placeholder:text-white/60 h-8 text-sm"
                />
                <button
                  type="button"
                  onClick={() => onRemoveOption(index)}
                  className="p-1.5 text-white/60 hover:text-red-400 hover:bg-red-500/10 rounded-full transition-all duration-300"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={onAddOption}
              className="flex items-center gap-1.5 text-sm text-white/60 hover:text-white transition-all duration-300"
            >
              <Plus className="h-3.5 w-3.5" />
              Lägg till alternativ
            </button>
          </div>
        </div>
      )}

      {/* Number/Range min/max */}
      {(question.question_type === 'number' || question.question_type === 'range') && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="text-white text-sm font-medium">Min värde</Label>
            <Input
              type="number"
              value={question.min_value ?? 0}
              onChange={(e) => onUpdateField('min_value', parseInt(e.target.value) || 0)}
              className="bg-white/10 border-white/20 text-white h-9 text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-white text-sm font-medium">Max värde</Label>
            <Input
              type="number"
              value={question.max_value ?? 100}
              onChange={(e) => onUpdateField('max_value', parseInt(e.target.value) || 100)}
              className="bg-white/10 border-white/20 text-white h-9 text-sm"
            />
          </div>
        </div>
      )}

      {/* Required toggle */}
      <div className="flex items-center justify-between">
        <Label className="text-white text-sm font-medium">Obligatorisk fråga</Label>
        <Switch
          checked={question.is_required}
          onCheckedChange={(checked) => onUpdateField('is_required', checked)}
        />
      </div>
    </div>
  );
};

export default QuestionFormFields;
