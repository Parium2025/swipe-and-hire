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
      className="bg-white/5 rounded-md p-2 border border-white/20"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          {/* Drag handle */}
          <div
            {...attributes}
            {...listeners}
            className="text-white hover:text-white cursor-grab active:cursor-grabbing touch-none flex-shrink-0"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="text-white font-medium text-sm leading-tight truncate">
              {question.question_text || 'Ingen frågetext'}
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-1 ml-1.5 flex-shrink-0">
          <button
            type="button"
            onClick={() => onEdit(question)}
            className="p-1.5 text-white hover:bg-white/10 rounded-full transition-all duration-300"
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(question.id!)}
            className="p-1.5 text-white hover:text-red-300 hover:bg-red-500/10 rounded-full transition-all duration-300"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default SortableQuestionItem;
