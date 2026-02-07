import { memo, useCallback, useEffect, useMemo, useState, forwardRef, useImperativeHandle } from 'react';
import { Bold, Italic, Strikethrough, List, CheckSquare, Undo, Redo, Heading1, Heading2, Maximize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Placeholder from '@tiptap/extension-placeholder';

interface RichNotesEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  hideToolbar?: boolean;
  onEditorReady?: (editor: Editor) => void;
}

export interface RichNotesEditorHandle {
  getEditor: () => Editor | null;
}

const ToolbarButton = memo(({ 
  onClick, 
  icon: Icon, 
  title,
  isActive = false,
  disabled = false
}: { 
  onClick: () => void; 
  icon: React.ComponentType<{ className?: string }>; 
  title: string;
  isActive?: boolean;
  disabled?: boolean;
}) => (
  <TooltipProvider delayDuration={300}>
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          tabIndex={-1}
          onMouseDown={(e) => {
            e.preventDefault();
          }}
          onFocus={(e) => {
            // Prevent focus from triggering tooltip on dialog open
            e.currentTarget.blur();
          }}
          onClick={onClick}
          disabled={disabled}
          className={cn(
            "w-5 h-5 flex items-center justify-center rounded transition-all duration-150 caret-transparent",
            "hover:bg-white/20",
            "active:scale-95",
            "disabled:opacity-30 disabled:cursor-not-allowed",
            isActive && "bg-white/25"
          )}
        >
          <Icon className="h-3 w-3 text-pure-white" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">
        <p>{title}</p>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
));

ToolbarButton.displayName = 'ToolbarButton';

// Standalone toolbar component that can be rendered separately
interface NotesToolbarProps {
  editor: Editor | null;
  className?: string;
  onExpand?: () => void;
  /** When true, hides less-used buttons on small screens. Default: false (show all) */
  compact?: boolean;
}

export const NotesToolbar = memo(({ editor, className, onExpand, compact = false }: NotesToolbarProps) => {
  const handleBold = useCallback(() => {
    editor?.chain().focus().toggleBold().run();
  }, [editor]);

  const handleItalic = useCallback(() => {
    editor?.chain().focus().toggleItalic().run();
  }, [editor]);

  const handleStrikethrough = useCallback(() => {
    editor?.chain().focus().toggleStrike().run();
  }, [editor]);

  const handleBulletList = useCallback(() => {
    editor?.chain().focus().toggleBulletList().run();
  }, [editor]);

  const handleCheckbox = useCallback(() => {
    editor?.chain().focus().toggleTaskList().run();
  }, [editor]);

  const handleUndo = useCallback(() => {
    editor?.chain().focus().undo().run();
  }, [editor]);

  const handleRedo = useCallback(() => {
    editor?.chain().focus().redo().run();
  }, [editor]);

  const handleHeading1 = useCallback(() => {
    editor?.chain().focus().toggleHeading({ level: 1 }).run();
  }, [editor]);

  const handleHeading2 = useCallback(() => {
    editor?.chain().focus().toggleHeading({ level: 2 }).run();
  }, [editor]);

  if (!editor) return null;

  return (
    <div className={cn("flex items-center gap-0.5 flex-shrink min-w-0 overflow-hidden", className)}>
      {/* Core formatting - always visible */}
      <ToolbarButton 
        onClick={handleBold} 
        icon={Bold} 
        title="Fet" 
        isActive={editor.isActive('bold')}
      />
      <ToolbarButton 
        onClick={handleItalic} 
        icon={Italic} 
        title="Kursiv" 
        isActive={editor.isActive('italic')}
      />
      <ToolbarButton 
        onClick={handleStrikethrough} 
        icon={Strikethrough} 
        title="Genomstruken" 
        isActive={editor.isActive('strike')}
      />
      <div className="w-px h-3 bg-white/20 mx-0.5 flex-shrink-0" />
      <ToolbarButton 
        onClick={handleBulletList} 
        icon={List} 
        title="Punktlista" 
        isActive={editor.isActive('bulletList')}
      />
      <ToolbarButton 
        onClick={handleCheckbox} 
        icon={CheckSquare} 
        title="Checkbox" 
        isActive={editor.isActive('taskList')}
      />
      {/* Headings + Undo/Redo - hidden on tight spaces */}
      <div className={compact ? "hidden md:contents" : "contents"}>
        <div className="w-px h-3 bg-white/20 mx-0.5 flex-shrink-0" />
        <ToolbarButton 
          onClick={handleHeading1} 
          icon={Heading1} 
          title="Rubrik 1" 
          isActive={editor.isActive('heading', { level: 1 })}
        />
        <ToolbarButton 
          onClick={handleHeading2} 
          icon={Heading2} 
          title="Rubrik 2" 
          isActive={editor.isActive('heading', { level: 2 })}
        />
        <div className="w-px h-3 bg-white/20 mx-0.5 flex-shrink-0" />
        <ToolbarButton 
          onClick={handleUndo} 
          icon={Undo} 
          title="Ångra" 
          disabled={!editor.can().undo()}
        />
        <ToolbarButton 
          onClick={handleRedo} 
          icon={Redo} 
          title="Gör om" 
          disabled={!editor.can().redo()}
        />
      </div>
      {onExpand && (
        <>
          <div className="w-px h-3 bg-white/20 mx-0.5 flex-shrink-0" />
          <ToolbarButton 
            onClick={onExpand} 
            icon={Maximize2} 
            title="Expandera" 
          />
        </>
      )}
    </div>
  );
});

NotesToolbar.displayName = 'NotesToolbar';

export const RichNotesEditor = memo(forwardRef<RichNotesEditorHandle, RichNotesEditorProps>(({ 
  value, 
  onChange, 
  placeholder = "Skriv påminnelser och anteckningar...",
  className,
  hideToolbar = false,
  onEditorReady
}, ref) => {
  const [scrollInfo, setScrollInfo] = useState({ scrollTop: 0, scrollHeight: 0, clientHeight: 0 });

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: {
          HTMLAttributes: {
            class: 'list-disc ml-4 my-1',
          },
        },
        orderedList: {
          HTMLAttributes: {
            class: 'list-decimal ml-4 my-1',
          },
        },
        listItem: {
          HTMLAttributes: {
            class: 'my-0.5',
          },
        },
      }),
      TaskList.configure({
        HTMLAttributes: {
          class: 'task-list',
        },
      }),
      TaskItem.configure({
        nested: false,
        HTMLAttributes: {
          class: 'task-item',
        },
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: 'is-editor-empty',
      }),
    ],
    content: value || '',
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const isEmpty = editor.isEmpty;
      onChange(isEmpty ? '' : html);
      updateScrollInfo();
    },
    editorProps: {
      attributes: {
        class: cn(
          "relative h-full overflow-y-auto",
          "bg-white/10 rounded-lg p-2 pr-4",
          "text-sm leading-relaxed",
          "text-pure-white",
          "focus:outline-none focus-visible:ring-1 focus-visible:ring-white/30",
          "touch-auto",
          "min-h-[100px]"
        ),
      },
    },
  });

  // Expose editor via ref
  useImperativeHandle(ref, () => ({
    getEditor: () => editor,
  }), [editor]);

  // Notify parent when editor is ready
  useEffect(() => {
    if (editor && onEditorReady) {
      onEditorReady(editor);
    }
  }, [editor, onEditorReady]);

  // Sync external value changes
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      const editorEmpty = editor.isEmpty;
      const valueEmpty = !value || value === '<p></p>' || value.trim() === '';
      
      if (editorEmpty && valueEmpty) return;
      
      editor.commands.setContent(value || '', { emitUpdate: false });
    }
  }, [value, editor]);

  const updateScrollInfo = useCallback(() => {
    const editorElement = document.querySelector('.ProseMirror');
    if (editorElement) {
      const { scrollTop, scrollHeight, clientHeight } = editorElement;
      setScrollInfo({ scrollTop, scrollHeight, clientHeight });
    }
  }, []);

  useEffect(() => {
    updateScrollInfo();
    const timer = setTimeout(updateScrollInfo, 100);
    return () => clearTimeout(timer);
  }, [value, updateScrollInfo]);

  const scrollbarInfo = useMemo(() => {
    const { scrollTop, scrollHeight, clientHeight } = scrollInfo;
    const hasScroll = scrollHeight > clientHeight + 5;
    if (!hasScroll) return { show: false, thumbTop: 0, thumbHeight: 0 };
    
    const thumbHeight = Math.max((clientHeight / scrollHeight) * 100, 20);
    const maxScroll = scrollHeight - clientHeight;
    const thumbTop = maxScroll > 0 ? (scrollTop / maxScroll) * (100 - thumbHeight) : 0;
    
    return { show: true, thumbTop, thumbHeight };
  }, [scrollInfo]);

  if (!editor) {
    return null;
  }

  return (
    <div className={cn("flex flex-col h-full rich-notes-editor", className)}>
      {/* Toolbar - only show if not hidden */}
      {!hideToolbar && (
        <div className="pb-1.5 mb-1.5 border-b border-white/10">
          <NotesToolbar editor={editor} />
        </div>
      )}
      
      {/* Editor with scrollbar indicator */}
      <div className="relative flex-1 min-h-0">
        <EditorContent 
          editor={editor} 
          className="h-full [&_.ProseMirror]:h-full"
          onScroll={updateScrollInfo}
        />
        
        {/* Mini scrollbar indicator */}
        {scrollbarInfo.show && (
          <div 
            className="absolute right-1 top-1 bottom-1 w-1 rounded-full bg-white/10 pointer-events-none"
            aria-hidden="true"
          >
            <div 
              className="absolute w-full rounded-full bg-white/40 transition-all duration-100"
              style={{
                top: `${scrollbarInfo.thumbTop}%`,
                height: `${scrollbarInfo.thumbHeight}%`,
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}));

RichNotesEditor.displayName = 'RichNotesEditor';
