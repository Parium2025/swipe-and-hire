import { memo, useRef, useCallback, useEffect, useMemo } from 'react';
import { Bold, Italic, Strikethrough, List, CheckSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface RichNotesEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

const ToolbarButton = memo(({ 
  onClick, 
  icon: Icon, 
  title,
  isActive = false 
}: { 
  onClick: () => void; 
  icon: React.ComponentType<{ className?: string }>; 
  title: string;
  isActive?: boolean;
}) => (
  <TooltipProvider delayDuration={300}>
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          className={cn(
            "w-5 h-5 flex items-center justify-center rounded transition-all duration-150",
            "hover:bg-white/20",
            "active:scale-95",
            isActive && "bg-white/25"
          )}
        >
          <Icon className="h-3 w-3 text-white" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">
        <p>{title}</p>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
));

ToolbarButton.displayName = 'ToolbarButton';

export const RichNotesEditor = memo(({ 
  value, 
  onChange, 
  placeholder = "Skriv påminnelser och anteckningar...",
  className 
}: RichNotesEditorProps) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const isInternalChange = useRef(false);

  // Sync external value changes to editor
  useEffect(() => {
    if (editorRef.current && !isInternalChange.current) {
      if (editorRef.current.innerHTML !== value) {
        editorRef.current.innerHTML = value;
      }
    }
    isInternalChange.current = false;
  }, [value]);

  const handleInput = useCallback(() => {
    if (editorRef.current) {
      isInternalChange.current = true;
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  const execCommand = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    handleInput();
  }, [handleInput]);

  const handleBold = useCallback(() => execCommand('bold'), [execCommand]);
  const handleItalic = useCallback(() => execCommand('italic'), [execCommand]);
  const handleStrikethrough = useCallback(() => execCommand('strikeThrough'), [execCommand]);
  
  const handleBulletList = useCallback(() => {
    execCommand('insertUnorderedList');
  }, [execCommand]);

  const handleCheckbox = useCallback(() => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      
      // Create a wrapper div for the checkbox line
      const wrapper = document.createElement('div');
      wrapper.className = 'checkbox-line';
      wrapper.style.display = 'flex';
      wrapper.style.alignItems = 'flex-start';
      wrapper.style.gap = '8px';
      wrapper.style.marginBottom = '4px';
      
      // Create checkbox span
      const checkbox = document.createElement('span');
      checkbox.className = 'inline-checkbox';
      checkbox.setAttribute('data-checked', 'false');
      checkbox.textContent = '☐';
      checkbox.style.cursor = 'pointer';
      checkbox.style.userSelect = 'none';
      checkbox.style.flexShrink = '0';
      
      // Create text span for the content
      const textSpan = document.createElement('span');
      textSpan.className = 'checkbox-text';
      textSpan.textContent = ' ';
      
      wrapper.appendChild(checkbox);
      wrapper.appendChild(textSpan);
      
      range.insertNode(wrapper);
      
      // Position cursor in the text span
      const newRange = document.createRange();
      newRange.setStart(textSpan, 0);
      newRange.collapse(true);
      selection.removeAllRanges();
      selection.addRange(newRange);
      
      handleInput();
    }
    editorRef.current?.focus();
  }, [handleInput]);

  // Handle click on checkboxes within the editor
  const handleEditorClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('inline-checkbox')) {
      e.preventDefault();
      e.stopPropagation();
      const isChecked = target.getAttribute('data-checked') === 'true';
      target.setAttribute('data-checked', isChecked ? 'false' : 'true');
      target.textContent = isChecked ? '☐' : '☑';
      
      // Update strikethrough on sibling text
      const sibling = target.nextElementSibling;
      if (sibling && sibling.classList.contains('checkbox-text')) {
        (sibling as HTMLElement).style.textDecoration = isChecked ? 'none' : 'line-through';
        (sibling as HTMLElement).style.opacity = isChecked ? '1' : '0.6';
      }
      
      handleInput();
    }
  }, [handleInput]);

  // Handle paste to strip formatting except basic text
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
    handleInput();
  }, [handleInput]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const modKey = isMac ? e.metaKey : e.ctrlKey;

    if (modKey) {
      switch (e.key.toLowerCase()) {
        case 'b':
          e.preventDefault();
          handleBold();
          break;
        case 'i':
          e.preventDefault();
          handleItalic();
          break;
        case 'u':
          // Use underline shortcut for strikethrough since it's more useful here
          e.preventDefault();
          handleStrikethrough();
          break;
        case 'l':
          e.preventDefault();
          handleBulletList();
          break;
      }
    }

    // Shift+Ctrl+C for checkbox
    if (modKey && e.shiftKey && e.key.toLowerCase() === 'c') {
      e.preventDefault();
      handleCheckbox();
    }
  }, [handleBold, handleItalic, handleStrikethrough, handleBulletList, handleCheckbox]);

  const isEmpty = useMemo(() => {
    if (!value) return true;
    if (typeof document === 'undefined') return value.trim().length === 0;

    const el = document.createElement('div');
    el.innerHTML = value;
    const text = (el.textContent || '').replace(/\u00a0/g, ' ').trim();
    return text.length === 0;
  }, [value]);

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Compact Toolbar */}
      <div className="flex items-center gap-0.5 pb-1.5 mb-1.5 border-b border-white/10">
        <ToolbarButton onClick={handleBold} icon={Bold} title="Fet" />
        <ToolbarButton onClick={handleItalic} icon={Italic} title="Kursiv" />
        <ToolbarButton onClick={handleStrikethrough} icon={Strikethrough} title="Genomstruken" />
        <div className="w-px h-3 bg-white/20 mx-0.5" />
        <ToolbarButton onClick={handleBulletList} icon={List} title="Punktlista" />
        <ToolbarButton onClick={handleCheckbox} icon={CheckSquare} title="Checkbox" />
      </div>
      
      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onClick={handleEditorClick}
        onPaste={handlePaste}
        onKeyDown={handleKeyDown}
        data-placeholder={placeholder}
        data-empty={isEmpty ? 'true' : 'false'}
        className={cn(
          "relative flex-1 min-h-0 overflow-y-auto",
          "bg-white/10 rounded-lg p-2",
          "text-white text-sm leading-relaxed",
          "focus:outline-none focus-visible:ring-1 focus-visible:ring-white/30",
          // Placeholder (contentEditable is rarely :empty due to <br>, so use data-empty)
          "data-[empty=true]:before:content-[attr(data-placeholder)]",
          "data-[empty=true]:before:text-white",
          "data-[empty=true]:before:absolute data-[empty=true]:before:top-2 data-[empty=true]:before:left-2",
          "data-[empty=true]:before:pointer-events-none data-[empty=true]:before:select-none",
          // List styling
          "[&_ul]:list-disc [&_ul]:ml-4 [&_ul]:my-1",
          "[&_ol]:list-decimal [&_ol]:ml-4 [&_ol]:my-1",
          "[&_li]:my-0.5",
          // Checkbox styling
          "[&_.inline-checkbox]:cursor-pointer [&_.inline-checkbox]:select-none"
        )}
        suppressContentEditableWarning
      />
    </div>
  );
});

RichNotesEditor.displayName = 'RichNotesEditor';
