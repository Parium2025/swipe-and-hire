import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Pencil, Trash2 } from 'lucide-react';
import { JobQuestion } from '@/types/jobWizard';

interface SortableQuestionItemProps {
  question: JobQuestion;
  onEdit: (question: JobQuestion) => void;
  onDelete: (id: string) => void;
}

export const SortableQuestionItem = ({ question, onEdit, onDelete }: SortableQuestionItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: question.id! });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-white/5 backdrop-blur-sm rounded-lg p-2.5 border border-white/10 hover:border-white/20 hover:bg-white/8 transition-all duration-200 group"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {/* Drag handle */}
          <div
            {...attributes}
            {...listeners}
            className="text-white hover:text-white cursor-grab active:cursor-grabbing touch-none flex-shrink-0 transition-colors"
          >
            <GripVertical className="h-4 w-4" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="text-white font-medium text-sm leading-tight truncate">
              {question.question_text || 'Ingen frågetext'}
              <span className="text-white/60 font-normal ml-1">
                ({question.question_type === 'yes_no' ? 'Ja/Nej' : 
                  question.question_type === 'text' ? 'Text' : 
                  question.question_type === 'number' ? 'Siffra' : 
                  question.question_type === 'multiple_choice' ? 'Flerval' : 
                  question.question_type})
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-0.5 flex-shrink-0 transition-opacity">
          <button
            type="button"
            onClick={() => onEdit(question)}
            className="p-1.5 text-white hover:text-white hover:bg-white/10 rounded-full transition-all duration-300"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(question.id!)}
            className="p-1.5 text-white hover:text-red-400 hover:bg-red-500/10 rounded-full transition-all duration-300"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default SortableQuestionItem;