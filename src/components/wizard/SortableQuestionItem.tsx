import { memo, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Pencil, Trash2, AlertTriangle } from 'lucide-react';
import { JobQuestion } from '@/types/jobWizard';
import { TruncatedText } from '@/components/TruncatedText';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertDialogContentNoFocus } from '@/components/ui/alert-dialog-no-focus';

interface SortableQuestionItemProps {
  question: JobQuestion;
  onEdit: (question: JobQuestion) => void;
  onDelete: (id: string) => void;
}

const getQuestionTypeLabel = (type: string) => {
  switch (type) {
    case 'yes_no': return 'Ja/Nej';
    case 'text': return 'Text';
    case 'number': return 'Siffra';
    case 'multiple_choice': return 'Flerval';
    default: return type;
  }
};

const SortableQuestionItemComponent = ({ question, onEdit, onDelete }: SortableQuestionItemProps) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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
    transition: isDragging ? undefined : transition,
    opacity: isDragging ? 0.5 : 1,
    willChange: 'transform',
    zIndex: isDragging ? 20 : 'auto',
  };

  const questionText = question.question_text || 'Ingen frågetext';
  const typeLabel = getQuestionTypeLabel(question.question_type);
  const displayText = `${questionText} (${typeLabel})`;

  const stopPropagation = (event: React.SyntheticEvent<HTMLElement>) => {
    event.stopPropagation();
  };

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className={`group select-none rounded-lg border p-2.5 transition-colors duration-150 ${
          isDragging
            ? 'border-white/30 bg-white/10 shadow-sm'
            : 'border-white/10 bg-white/5 md:hover:border-white/20 md:hover:bg-white/8'
        }`}
      >
        {/* Desktop: single row | Mobile: stacked */}
        <div className="flex flex-col gap-1.5 md:flex-row md:items-center md:justify-between md:gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {/* Drag handle */}
            <div
              data-dnd-draggable="true"
              {...attributes}
              {...listeners}
              className="-m-1 flex h-9 w-9 flex-shrink-0 cursor-grab touch-none select-none items-center justify-center rounded-full text-white transition-colors active:cursor-grabbing md:hover:bg-white/10"
            >
              <GripVertical className="h-4 w-4" />
            </div>
            
            <TruncatedText 
              text={displayText}
              className="flex-1 min-w-0 text-white font-medium text-sm leading-tight truncate"
            >
              {questionText}
              <span className="text-white font-normal ml-1">({typeLabel})</span>
            </TruncatedText>

            {/* Desktop: inline buttons */}
            <div className="hidden md:flex items-center gap-0.5 flex-shrink-0">
              <button
                type="button"
                onPointerDown={stopPropagation}
                onTouchStart={stopPropagation}
                onClick={(event) => {
                  event.stopPropagation();
                  onEdit(question);
                }}
                className="p-1.5 text-white hover:text-white hover:bg-white/10 rounded-full transition-all duration-300"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onPointerDown={stopPropagation}
                onTouchStart={stopPropagation}
                onClick={(event) => {
                  event.stopPropagation();
                  setShowDeleteConfirm(true);
                }}
                className="rounded-full border border-destructive/40 bg-destructive/20 p-1.5 text-white transition-all duration-300 md:hover:!border-destructive/50 md:hover:!bg-destructive/30 md:hover:!text-white"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          
          {/* Mobile: buttons on own row, larger touch targets */}
          <div className="flex md:hidden items-center gap-2 pl-8">
            <button
              type="button"
              onPointerDown={stopPropagation}
              onTouchStart={stopPropagation}
              onClick={(event) => {
                event.stopPropagation();
                onEdit(question);
              }}
              className="flex items-center gap-1.5 px-3 h-9 min-h-[2.25rem] text-white text-xs bg-white/10 hover:bg-white/15 rounded-full transition-all duration-300 active:scale-[0.97]"
            >
              <Pencil className="h-3.5 w-3.5" />
              <span>Redigera</span>
            </button>
            <button
              type="button"
              onPointerDown={stopPropagation}
              onTouchStart={stopPropagation}
              onClick={(event) => {
                event.stopPropagation();
                setShowDeleteConfirm(true);
              }}
              className="flex items-center gap-1.5 px-3 h-9 min-h-[2.25rem] rounded-full border border-destructive/40 bg-destructive/20 text-white text-xs transition-all duration-300 active:scale-[0.97]"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Ta bort</span>
            </button>
          </div>
        </div>
      </div>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContentNoFocus
          elevated
          className="border-white/20 text-white w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] sm:max-w-md sm:w-[28rem] p-4 sm:p-6 bg-white/10 backdrop-blur-sm rounded-xl shadow-lg mx-0"
        >
          <AlertDialogHeader className="space-y-4 text-center">
            <div className="flex items-center justify-center gap-2.5">
              <div className="bg-red-500/20 p-2 rounded-full">
                <AlertTriangle className="h-4 w-4 text-red-400" />
              </div>
              <AlertDialogTitle className="text-white text-base md:text-lg font-semibold">
                Ta bort fråga
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-white text-sm leading-relaxed">
              Är du säker på att du vill ta bort denna fråga? Denna åtgärd går inte att ångra.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2 mt-4 sm:justify-center">
            <AlertDialogCancel
              onClick={() => setShowDeleteConfirm(false)}
              style={{ height: '44px', minHeight: '44px', padding: '0 1rem' }}
              className="rounded-full border-white/30 text-white bg-white/10 hover:bg-white/20"
            >
              Avbryt
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowDeleteConfirm(false);
                onDelete(question.id!);
              }}
              variant="destructiveSoft"
              style={{ height: '44px', minHeight: '44px', padding: '0 1rem' }}
              className="rounded-full"
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              Ta bort
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContentNoFocus>
      </AlertDialog>
    </>
  );
};

export const SortableQuestionItem = memo(SortableQuestionItemComponent);

export default SortableQuestionItem;
