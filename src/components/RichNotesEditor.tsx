import { memo, useState, useCallback, useEffect, useRef, forwardRef, useImperativeHandle, type TouchEvent } from 'react';
import { Bold, Italic, Strikethrough, List, CheckSquare, Undo, Redo } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Placeholder from '@tiptap/extension-placeholder';
import { useTouchCapable } from '@/hooks/useInputCapability';

interface RichNotesEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  hideToolbar?: boolean;
  onEditorReady?: (editor: Editor) => void;
  /** When true, scrolling is handled by a parent container — editor grows with content */
  externalScroll?: boolean;
}

export interface RichNotesEditorHandle {
  getEditor: () => Editor | null;
}

const ToolbarButton = memo(({ 
  onClick, 
  icon: Icon, 
  title,
  isActive = false,
  disabled = false,
  compact = false,
  large = false,
  tapToPreview = false,
  previewingId,
  buttonId,
  onTapPreview
}: { 
  onClick: () => void; 
  icon: React.ComponentType<{ className?: string }>; 
  title: string;
  isActive?: boolean;
  disabled?: boolean;
  compact?: boolean;
  large?: boolean;
  tapToPreview?: boolean;
  previewingId?: string | null;
  buttonId?: string;
  onTapPreview?: (id: string) => void;
}) => {
  const isShowingPreview = tapToPreview && previewingId === buttonId;

  const handleClick = () => {
    if (tapToPreview && buttonId && onTapPreview) {
      if (previewingId === buttonId) {
        // Second tap → activate
        onClick();
      } else {
        // First tap → show tooltip
        onTapPreview(buttonId);
        return;
      }
    } else {
      onClick();
    }
  };

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip open={isShowingPreview || undefined}>
        <TooltipTrigger asChild>
          <button
            type="button"
            tabIndex={-1}
            onMouseDown={(e) => {
              e.preventDefault();
            }}
            onFocus={(e) => {
              e.currentTarget.blur();
            }}
            onClick={handleClick}
            disabled={disabled}
            className={cn(
              "flex-shrink-0 flex items-center justify-center rounded-lg transition-all duration-150 caret-transparent",
              large ? "w-11 h-11" : compact ? "w-7 h-7" : "w-8 h-8",
              "bg-transparent md:hover:bg-white/20",
              "active:scale-90",
              "disabled:opacity-30 disabled:cursor-not-allowed",
              isActive ? "bg-white/30 ring-1 ring-white/40 shadow-sm" : "border border-transparent"
            )}
          >
            <Icon className={cn(large ? "h-5 w-5" : compact ? "h-3.5 w-3.5" : "h-4 w-4", "text-pure-white")} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p>{title}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});

ToolbarButton.displayName = 'ToolbarButton';

// Standalone toolbar component that can be rendered separately
interface NotesToolbarProps {
  editor: Editor | null;
  className?: string;
  compact?: boolean;
  large?: boolean;
  showUndoRedo?: boolean;
}

export const NotesToolbar = ({ editor, className, compact = false, large = false, showUndoRedo = true }: NotesToolbarProps) => {
  const isTouch = useTouchCapable();
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const previewTimeout = useRef<ReturnType<typeof setTimeout>>();

  const handleTapPreview = useCallback((id: string) => {
    if (previewTimeout.current) clearTimeout(previewTimeout.current);
    setPreviewingId(id);
    previewTimeout.current = setTimeout(() => setPreviewingId(null), 2500);
  }, []);

  useEffect(() => {
    return () => {
      if (previewTimeout.current) clearTimeout(previewTimeout.current);
    };
  }, []);

  const tapProps = isTouch ? {
    tapToPreview: true,
    previewingId,
    onTapPreview: handleTapPreview,
  } : {};

  // Force re-render on every editor transaction so undo/redo disabled state updates in real-time
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!editor) return;
    const handler = () => setTick(t => t + 1);
    editor.on('transaction', handler);
    editor.on('selectionUpdate', handler);
    return () => { editor.off('transaction', handler); editor.off('selectionUpdate', handler); };
  }, [editor]);
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

  if (!editor) return null;

  return (
    <div className={cn("flex items-center gap-0.5 flex-wrap", compact ? "gap-0" : "gap-1", className)}>
      <ToolbarButton onClick={handleBold} icon={Bold} title="Fet" isActive={editor.isActive('bold')} compact={compact} large={large} buttonId="bold" {...tapProps} />
      <ToolbarButton onClick={handleItalic} icon={Italic} title="Kursiv" isActive={editor.isActive('italic')} compact={compact} large={large} buttonId="italic" {...tapProps} />
      <ToolbarButton onClick={handleStrikethrough} icon={Strikethrough} title="Genomstruken" isActive={editor.isActive('strike')} compact={compact} large={large} buttonId="strike" {...tapProps} />
      <div className={cn("w-px bg-white/20 flex-shrink-0", large ? "h-5 mx-1.5" : compact ? "h-3 mx-0.5" : "h-4 mx-1")} />
      <ToolbarButton onClick={handleBulletList} icon={List} title="Punktlista" isActive={editor.isActive('bulletList')} compact={compact} large={large} buttonId="bulletList" {...tapProps} />
      <ToolbarButton onClick={handleCheckbox} icon={CheckSquare} title="Checkbox" isActive={editor.isActive('taskList')} compact={compact} large={large} buttonId="taskList" {...tapProps} />
      {showUndoRedo && (
        <>
          <div className={cn("w-px bg-white/20 flex-shrink-0", large ? "h-5 mx-1.5" : compact ? "h-3 mx-0.5" : "h-4 mx-1")} />
          <ToolbarButton onClick={handleUndo} icon={Undo} title="Ångra" disabled={!editor.can().undo()} compact={compact} large={large} buttonId="undo" {...tapProps} />
          <ToolbarButton onClick={handleRedo} icon={Redo} title="Gör om" disabled={!editor.can().redo()} compact={compact} large={large} buttonId="redo" {...tapProps} />
        </>
      )}
    </div>
  );
};

NotesToolbar.displayName = 'NotesToolbar';

export const RichNotesEditor = memo(forwardRef<RichNotesEditorHandle, RichNotesEditorProps>(({ 
  value, 
  onChange, 
  placeholder = "Skriv påminnelser och anteckningar...",
  className,
  hideToolbar = false,
  onEditorReady,
  externalScroll = false
}, ref) => {
  const scrollTrackRef = useRef<HTMLDivElement>(null);
  const scrollThumbRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const lastEmittedRef = useRef<string>(value || '');

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        undoRedo: { newGroupDelay: 350 },
        bulletList: { HTMLAttributes: { class: 'list-disc ml-4 my-1' } },
        orderedList: { HTMLAttributes: { class: 'list-decimal ml-4 my-1' } },
        listItem: { HTMLAttributes: { class: 'my-0.5' } },
      }),
      TaskList.configure({ HTMLAttributes: { class: 'task-list' } }),
      TaskItem.configure({ nested: false, HTMLAttributes: { class: 'task-item' } }),
      Placeholder.configure({ placeholder, emptyEditorClass: 'is-editor-empty' }),
    ],
    content: value || '',
    onUpdate: ({ editor }) => {
      const html = editor.isEmpty ? '' : editor.getHTML();
      lastEmittedRef.current = html;
      onChange(html);
      updateScrollbar();
    },
    editorProps: {
      attributes: {
        class: cn(
          "relative",
          "bg-white/10 rounded-lg p-2 pr-4",
          "text-sm leading-relaxed",
          "text-pure-white",
          "focus:outline-none focus-visible:ring-1 focus-visible:ring-white/30",
          "touch-auto",
          "min-h-[100px]",
          "pb-4",
          "[&]:[-webkit-overflow-scrolling:touch]"
        ),
      },
    },
  });

  useImperativeHandle(ref, () => ({ getEditor: () => editor }), [editor]);

  useEffect(() => {
    if (editor && onEditorReady) onEditorReady(editor);
  }, [editor, onEditorReady]);

  useEffect(() => {
    if (!editor) return;
    // Only sync if the incoming value differs from what the editor last emitted
    // This prevents clobbering the editor during rapid typing
    if (value === lastEmittedRef.current) return;
    const editorEmpty = editor.isEmpty;
    const valueEmpty = !value || value === '<p></p>' || value.trim() === '';
    if (editorEmpty && valueEmpty) return;
    lastEmittedRef.current = value || '';
    editor.commands.setContent(value || '', { emitUpdate: false });
  }, [value, editor]);

  // Safe accessor for editor DOM — Tiptap throws if view isn't mounted yet
  const getEditorDom = useCallback((): HTMLElement | null => {
    try {
      return editor?.view?.dom ?? null;
    } catch {
      return null;
    }
  }, [editor]);

  // Direct DOM scrollbar update — no React state, instant response
  const updateScrollbar = useCallback(() => {
    const dom = getEditorDom();
    const track = scrollTrackRef.current;
    const thumb = scrollThumbRef.current;
    if (!dom || !track || !thumb) return;

    const { scrollTop, scrollHeight, clientHeight } = dom;
    const hasScroll = scrollHeight > clientHeight + 5;

    track.style.display = hasScroll ? '' : 'none';
    if (!hasScroll) return;

    const thumbHeight = Math.max((clientHeight / scrollHeight) * 100, 20);
    const maxScroll = scrollHeight - clientHeight;
    const thumbTop = maxScroll > 0 ? (scrollTop / maxScroll) * (100 - thumbHeight) : 0;

    thumb.style.top = `${thumbTop}%`;
    thumb.style.height = `${thumbHeight}%`;
  }, [getEditorDom]);

  // Attach scroll listener with rAF throttle
  useEffect(() => {
    const dom = getEditorDom();
    if (!dom) return;
    const handler = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(updateScrollbar);
    };
    dom.addEventListener('scroll', handler, { passive: true });
    updateScrollbar();
    return () => {
      dom.removeEventListener('scroll', handler);
      cancelAnimationFrame(rafRef.current);
    };
  }, [editor, getEditorDom, updateScrollbar]);

  // Update on content changes
  useEffect(() => {
    updateScrollbar();
    const timer = setTimeout(updateScrollbar, 100);
    return () => clearTimeout(timer);
  }, [value, updateScrollbar]);

  if (!editor) return null;

  return (
    <div className={cn(
      "flex flex-col rich-notes-editor",
      !externalScroll && "h-full",
      className
    )}>
      {!hideToolbar && (
        <div className="pb-1.5 mb-1.5 border-b border-white/10">
          <NotesToolbar editor={editor} />
        </div>
      )}
      
      {externalScroll ? (
        /* External scroll mode: editor grows with content, parent scrolls. Background removed from ProseMirror so the fixed parent can own it. */
        <div className="relative min-h-full">
          <EditorContent 
            editor={editor} 
            className="[&_.ProseMirror]:pb-8 [&_.ProseMirror]:min-h-full [&_.ProseMirror]:!bg-transparent [&_.ProseMirror]:!rounded-none"
          />
        </div>
      ) : (
        /* Internal scroll mode: editor scrolls within fixed container */
        <div className="relative flex-1 min-h-0 overflow-hidden">
          <EditorContent 
            editor={editor} 
            className="h-full [&_.ProseMirror]:h-full [&_.ProseMirror]:overflow-y-auto [&_.ProseMirror]:overscroll-contain [&_.ProseMirror]:pb-8 [&_.ProseMirror]:[-webkit-overflow-scrolling:touch]"
          />
          
          {/* Mini scrollbar indicator */}
          <div 
            ref={scrollTrackRef}
            className="absolute right-1 top-1 bottom-1 w-1 rounded-full bg-white/10 pointer-events-none"
            aria-hidden="true"
            style={{ display: 'none' }}
          >
            <div 
              ref={scrollThumbRef}
              className="absolute w-full rounded-full bg-white/40"
            />
          </div>
        </div>
      )}
    </div>
  );
}));

RichNotesEditor.displayName = 'RichNotesEditor';
