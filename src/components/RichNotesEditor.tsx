import { memo, useRef, useCallback, useEffect } from 'react';
import { Bold, Italic, Strikethrough, List, CheckSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  <button
    type="button"
    onClick={onClick}
    title={title}
    className={cn(
      "p-1 rounded transition-colors",
      isActive 
        ? "bg-white/30 text-white" 
        : "text-white/70 hover:bg-white/20 hover:text-white"
    )}
  >
    <Icon className="h-3.5 w-3.5" />
  </button>
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
    // Insert a checkbox using a special span that looks like a checkbox
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      
      // Create checkbox element
      const checkbox = document.createElement('span');
      checkbox.className = 'inline-checkbox';
      checkbox.setAttribute('data-checked', 'false');
      checkbox.innerHTML = '☐ ';
      checkbox.contentEditable = 'false';
      checkbox.style.cursor = 'pointer';
      checkbox.onclick = (e) => {
        e.preventDefault();
        const isChecked = checkbox.getAttribute('data-checked') === 'true';
        checkbox.setAttribute('data-checked', isChecked ? 'false' : 'true');
        checkbox.innerHTML = isChecked ? '☐ ' : '☑ ';
        handleInput();
      };
      
      range.insertNode(checkbox);
      range.setStartAfter(checkbox);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      
      handleInput();
    }
    editorRef.current?.focus();
  }, [handleInput]);

  // Handle click on checkboxes within the editor
  const handleEditorClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('inline-checkbox')) {
      e.preventDefault();
      const isChecked = target.getAttribute('data-checked') === 'true';
      target.setAttribute('data-checked', isChecked ? 'false' : 'true');
      target.innerHTML = isChecked ? '☐ ' : '☑ ';
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

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 pb-1.5 mb-1.5 border-b border-white/20">
        <ToolbarButton onClick={handleBold} icon={Bold} title="Fet (⌘B / Ctrl+B)" />
        <ToolbarButton onClick={handleItalic} icon={Italic} title="Kursiv (⌘I / Ctrl+I)" />
        <ToolbarButton onClick={handleStrikethrough} icon={Strikethrough} title="Genomstruken (⌘U / Ctrl+U)" />
        <div className="w-px h-4 bg-white/20 mx-1" />
        <ToolbarButton onClick={handleBulletList} icon={List} title="Punktlista (⌘L / Ctrl+L)" />
        <ToolbarButton onClick={handleCheckbox} icon={CheckSquare} title="Checkbox (⌘⇧C / Ctrl+Shift+C)" />
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
        className={cn(
          "flex-1 min-h-0 overflow-y-auto",
          "bg-white/10 rounded-lg p-2",
          "text-white text-sm leading-relaxed",
          "focus:outline-none focus-visible:ring-1 focus-visible:ring-white/30",
          "empty:before:content-[attr(data-placeholder)] empty:before:text-white/40",
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
