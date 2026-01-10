import { memo, useRef, useCallback, useEffect, useMemo, useState } from 'react';
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
          onMouseDown={(e) => {
            // Keep selection in the editor (prevents caret/focus glitches)
            e.preventDefault();
          }}
          onClick={onClick}
          className={cn(
            "w-5 h-5 flex items-center justify-center rounded transition-all duration-150 caret-transparent",
            "hover:bg-white/20",
            "active:scale-95",
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

export const RichNotesEditor = memo(({ 
  value, 
  onChange, 
  placeholder = "Skriv påminnelser och anteckningar...",
  className 
}: RichNotesEditorProps) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const isInternalChange = useRef(false);
  const [scrollInfo, setScrollInfo] = useState({ scrollTop: 0, scrollHeight: 0, clientHeight: 0 });

  // Update scroll info when editor scrolls
  const updateScrollInfo = useCallback(() => {
    if (editorRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = editorRef.current;
      setScrollInfo({ scrollTop, scrollHeight, clientHeight });
    }
  }, []);

  // Update scroll info on mount, value change, and resize
  useEffect(() => {
    updateScrollInfo();
    // Also update after a short delay to catch layout changes
    const timer = setTimeout(updateScrollInfo, 100);
    return () => clearTimeout(timer);
  }, [value, updateScrollInfo]);

  // Calculate scrollbar thumb position and size
  const scrollbarInfo = useMemo(() => {
    const { scrollTop, scrollHeight, clientHeight } = scrollInfo;
    const hasScroll = scrollHeight > clientHeight + 5; // 5px threshold
    if (!hasScroll) return { show: false, thumbTop: 0, thumbHeight: 0 };
    
    const thumbHeight = Math.max((clientHeight / scrollHeight) * 100, 20); // Min 20% height
    const maxScroll = scrollHeight - clientHeight;
    const thumbTop = maxScroll > 0 ? (scrollTop / maxScroll) * (100 - thumbHeight) : 0;
    
    return { show: true, thumbTop, thumbHeight };
  }, [scrollInfo]);

  // Sync external value changes to editor
  useEffect(() => {
    if (editorRef.current && !isInternalChange.current) {
      if (editorRef.current.innerHTML !== value) {
        editorRef.current.innerHTML = value;
      }
    }
    isInternalChange.current = false;
  }, [value]);

  // Normalize caret position when it lands in checkbox-anchor or inline-checkbox
  // This ensures typing always goes into the text span
  useEffect(() => {
    const handleSelectionChange = () => {
      const sel = window.getSelection();
      const editorEl = editorRef.current;
      if (!sel || !editorEl || sel.rangeCount === 0) return;
      
      const range = sel.getRangeAt(0);
      if (!range.collapsed) return; // Only normalize for collapsed caret
      
      const container = range.startContainer;
      
      // Check if caret is inside checkbox anchor or checkbox glyph
      const anchor = container.nodeType === Node.TEXT_NODE 
        ? (container.parentElement?.closest('.checkbox-anchor') || container.parentElement?.closest('.inline-checkbox'))
        : (container instanceof Element ? container.closest('.checkbox-anchor') || container.closest('.inline-checkbox') : null);
      
      if (anchor && editorEl.contains(anchor)) {
        const line = anchor.closest('.checkbox-line') as HTMLElement | null;
        if (line) {
          const textEl = line.querySelector<HTMLElement>('.checkbox-text');
          if (textEl) {
            const newRange = document.createRange();
            if (textEl.firstChild) {
              newRange.setStart(textEl.firstChild, 0);
            } else {
              newRange.setStart(textEl, 0);
            }
            newRange.collapse(true);
            sel.removeAllRanges();
            sel.addRange(newRange);
          }
        }
      }
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, []);

  const handleInput = useCallback(() => {
    if (editorRef.current) {
      isInternalChange.current = true;
      onChange(editorRef.current.innerHTML);
      updateScrollInfo();
    }
  }, [onChange, updateScrollInfo]);

  const execCommand = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    handleInput();
  }, [handleInput]);

  const handleBold = useCallback(() => execCommand('bold'), [execCommand]);
  const handleItalic = useCallback(() => execCommand('italic'), [execCommand]);
  const handleStrikethrough = useCallback(() => execCommand('strikeThrough'), [execCommand]);
  
  const clearEditorIfEmpty = useCallback(() => {
    const editorEl = editorRef.current;
    if (!editorEl) return;
    const text = editorEl.textContent?.trim() || '';
    if (text === '') {
      editorEl.innerHTML = '';
    }
  }, []);

  const handleBulletList = useCallback(() => {
    const editorEl = editorRef.current;
    clearEditorIfEmpty();

    // Ensure caret is inside the editor so the command actually applies
    if (editorEl) {
      editorEl.focus();
      const selection = window.getSelection();
      if (selection && (!selection.rangeCount || !editorEl.contains(selection.anchorNode))) {
        const range = document.createRange();
        range.selectNodeContents(editorEl);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }

    execCommand('insertUnorderedList');
  }, [execCommand, clearEditorIfEmpty]);

  const handleCheckbox = useCallback(() => {
    const selection = window.getSelection();
    const editorEl = editorRef.current;
    if (!selection || !editorEl) return;

    // Clear if empty before inserting checkbox (placeholder is a pseudo-element)
    const text = editorEl.textContent?.trim() || '';
    if (text === '') {
      editorEl.innerHTML = '';
    }

    // Ensure caret is inside the editor before we insert
    editorEl.focus();

    const findCheckboxLine = (node: Node | null): HTMLElement | null => {
      let cur: Node | null = node;
      while (cur && cur !== editorEl) {
        if (cur instanceof HTMLElement && cur.classList.contains('checkbox-line')) return cur;
        cur = cur.parentNode;
      }
      return null;
    };

    // Build a wrapper div for the checkbox line
    const wrapper = document.createElement('div');
    wrapper.className = 'checkbox-line';
    wrapper.style.display = 'flex';
    wrapper.style.alignItems = 'flex-start';
    wrapper.style.gap = '8px';
    wrapper.style.marginBottom = '4px';

    const checkbox = document.createElement('span');
    checkbox.className = 'inline-checkbox';
    checkbox.setAttribute('data-checked', 'false');
    checkbox.textContent = '☐';
    checkbox.style.cursor = 'pointer';
    checkbox.style.userSelect = 'none';
    checkbox.style.flexShrink = '0';

    // Caret anchor - an editable span that gives the browser a stable place for the caret
    const caretAnchor = document.createElement('span');
    caretAnchor.className = 'checkbox-anchor';
    caretAnchor.textContent = '\u200b'; // Zero-width space

    const textSpan = document.createElement('span');
    textSpan.className = 'checkbox-text';
    textSpan.style.flex = '1';
    textSpan.style.minWidth = '0';

    wrapper.appendChild(checkbox);
    wrapper.appendChild(caretAnchor);
    wrapper.appendChild(textSpan);

    // If cursor is currently inside an existing checkbox-line, insert AFTER it (never inside)
    const currentCheckboxLine = findCheckboxLine(selection.focusNode);
    if (currentCheckboxLine) {
      currentCheckboxLine.insertAdjacentElement('afterend', wrapper);
    } else if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      range.insertNode(wrapper);
    } else {
      editorEl.appendChild(wrapper);
    }

    // Place cursor in the caret anchor (right after checkbox)
    placeCaretInCheckboxText(wrapper, false);

    editorEl.focus();
    handleInput();
  }, [handleInput]);

  const placeCaretInCheckboxText = useCallback((line: HTMLElement, atEnd: boolean) => {
    const anchorEl = line.querySelector<HTMLElement>('.checkbox-anchor');
    const textEl = line.querySelector<HTMLElement>('.checkbox-text');
    const sel = window.getSelection();
    if (!sel) return;

    const range = document.createRange();

    if (atEnd && textEl) {
      // Place caret at end of text
      const tn = textEl.lastChild;
      if (tn && tn.nodeType === Node.TEXT_NODE) {
        range.setStart(tn, tn.textContent?.length ?? 0);
      } else if (textEl.firstChild) {
        range.selectNodeContents(textEl);
        range.collapse(false);
      } else {
        range.setStart(textEl, 0);
      }
      range.collapse(true);
    } else if (anchorEl) {
      // Place caret in the anchor (right after checkbox)
      const tn = anchorEl.firstChild;
      if (tn && tn.nodeType === Node.TEXT_NODE) {
        range.setStart(tn, 1); // After the ZWSP
        range.collapse(true);
      } else {
        range.selectNodeContents(anchorEl);
        range.collapse(false);
      }
    } else if (textEl) {
      // Fallback: start of text
      range.selectNodeContents(textEl);
      range.collapse(true);
    } else {
      return;
    }

    sel.removeAllRanges();
    sel.addRange(range);
  }, []);

  const handleEditorMouseDown = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;

    if (target.classList.contains('inline-checkbox')) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && !sel.getRangeAt(0).collapsed) return;

      // Prevent the browser from placing the caret in odd positions (often "below" the line)
      // and set it deterministically right after the checkbox.
      e.preventDefault();

      const line = target.closest('.checkbox-line') as HTMLElement | null;
      if (line) placeCaretInCheckboxText(line, false);
      editorRef.current?.focus();
    }
  }, [placeCaretInCheckboxText]);

  // Handle click on checkboxes within the editor
  const handleEditorClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('inline-checkbox')) {
      const sel = window.getSelection();

      // If user is selecting text (drag/handles), don't toggle the checkbox.
      if (sel && sel.rangeCount > 0 && !sel.getRangeAt(0).collapsed) return;

      const isChecked = target.getAttribute('data-checked') === 'true';
      target.setAttribute('data-checked', isChecked ? 'false' : 'true');
      target.textContent = isChecked ? '☐' : '☑';

      const line = target.closest('.checkbox-line') as HTMLElement | null;
      if (line) placeCaretInCheckboxText(line, true);

      handleInput();
      updateScrollInfo();
    }
  }, [handleInput, updateScrollInfo, placeCaretInCheckboxText]);

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

    // Allow deleting checkbox-lines reliably (including the very first one)
    if (e.key === 'Backspace' || e.key === 'Delete') {
      const selection = window.getSelection();
      const editorEl = editorRef.current;

      if (selection && editorEl && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);

        const findCheckboxLine = (node: Node | null): HTMLElement | null => {
          let cur: Node | null = node;
          while (cur && cur !== editorEl) {
            if (cur instanceof HTMLElement && cur.classList.contains('checkbox-line')) return cur;
            cur = cur.parentNode;
          }
          return null;
        };

        const safeIntersects = (node: Node) => {
          try {
            return range.intersectsNode(node);
          } catch {
            return false;
          }
        };

        // If user has a selection range, remove any checkbox-lines touched by it
        if (!range.collapsed) {
          const checkboxLines = Array.from(editorEl.querySelectorAll<HTMLElement>('.checkbox-line'));
          const toRemove = checkboxLines.filter((el) => safeIntersects(el));

          if (toRemove.length > 0) {
            e.preventDefault();
            toRemove.forEach((el) => el.remove());
            handleInput();
            updateScrollInfo();
            return;
          }
        } else {
          // Collapsed caret inside a checkbox-line: protect the checkbox glyph from being deleted.
          const checkboxLine = findCheckboxLine(selection.focusNode);
          if (checkboxLine) {
            const checkboxText = checkboxLine.querySelector<HTMLElement>('.checkbox-text');
            const checkboxSpan = checkboxLine.querySelector<HTMLElement>('.inline-checkbox');
            const checkboxAnchor = checkboxLine.querySelector<HTMLElement>('.checkbox-anchor');

            const focusNode = selection.focusNode;
            const isOnCheckbox = !!(checkboxSpan && focusNode && checkboxSpan.contains(focusNode));
            const isInCheckboxText = !!(checkboxText && focusNode && checkboxText.contains(focusNode));
            const isInAnchor = !!(checkboxAnchor && focusNode && checkboxAnchor.contains(focusNode));

            // In contentEditable it's common that the caret "behind the checkbox" is represented as:
            // range.startContainer === checkboxLine AND startOffset === 1 or 2 (between [checkbox][anchor][text]).
            const caretInLineContainer = range.startContainer === checkboxLine;
            const caretBetweenElements = caretInLineContainer && (range.startOffset === 1 || range.startOffset === 2);

            const textContent = (checkboxText?.textContent || '').replace(/\u200b/g, '');

            const atStartOfCheckboxText = (() => {
              if (isOnCheckbox || isInAnchor || caretBetweenElements) return true;
              if (!isInCheckboxText) return false;
              if (range.startContainer.nodeType === Node.TEXT_NODE) return range.startOffset === 0;
              if (checkboxText && range.startContainer === checkboxText) return range.startOffset === 0;
              return false;
            })();

            // Delete (forward) from anchor or checkbox: move caret into text so we don't delete checkbox
            if (e.key === 'Delete' && (isOnCheckbox || isInAnchor || caretBetweenElements)) {
              e.preventDefault();
              // Move caret to start of actual text content
              if (checkboxText) {
                const sel = window.getSelection();
                if (sel) {
                  const r = document.createRange();
                  if (checkboxText.firstChild) {
                    r.setStart(checkboxText.firstChild, 0);
                  } else {
                    r.setStart(checkboxText, 0);
                  }
                  r.collapse(true);
                  sel.removeAllRanges();
                  sel.addRange(r);
                }
              }
              return;
            }

            // Backspace at the very start: let user remove the checkbox formatting (or the whole
            // line if it's empty), instead of getting stuck.
            if (e.key === 'Backspace' && atStartOfCheckboxText) {
              e.preventDefault();

              if (textContent.length === 0) {
                // Empty checkbox line: remove it entirely
                const prev = checkboxLine.previousSibling;
                checkboxLine.remove();

                const sel = window.getSelection();
                if (sel && editorEl) {
                  const r = document.createRange();
                  if (prev instanceof HTMLElement) {
                    r.selectNodeContents(prev);
                    r.collapse(false);
                  } else {
                    r.selectNodeContents(editorEl);
                    r.collapse(true);
                  }
                  sel.removeAllRanges();
                  sel.addRange(r);
                }

                handleInput();
                updateScrollInfo();
                return;
              }

              // Convert checkbox-line to a plain text line ("delete the checkbox", keep the text)
              const plain = document.createElement('div');
              plain.textContent = textContent;
              checkboxLine.replaceWith(plain);

              const sel = window.getSelection();
              if (sel) {
                const r = document.createRange();
                if (plain.firstChild) r.setStart(plain.firstChild, 0);
                else r.setStart(plain, 0);
                r.collapse(true);
                sel.removeAllRanges();
                sel.addRange(r);
              }

              handleInput();
              updateScrollInfo();
              return;
            }
          }
        }
      }
    }

    // If we're inside a checkbox-line, Enter behaves like a checklist editor
    if (e.key === 'Enter' && !e.shiftKey && !modKey) {
      const selection = window.getSelection();
      const editorEl = editorRef.current;

      if (selection && editorEl && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);

        const findCheckboxLine = (node: Node | null): HTMLElement | null => {
          let cur: Node | null = node;
          while (cur && cur !== editorEl) {
            if (cur instanceof HTMLElement && cur.classList.contains('checkbox-line')) return cur;
            cur = cur.parentNode;
          }
          return null;
        };

        const checkboxLine = findCheckboxLine(selection.focusNode);
        if (checkboxLine) {
          e.preventDefault();

          const checkboxText = checkboxLine.querySelector<HTMLElement>('.checkbox-text');
          const textContent = (checkboxText?.textContent || '').replace(/\u200b/g, '');

          const createCheckboxLine = (initialText: string) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'checkbox-line';
            wrapper.style.display = 'flex';
            wrapper.style.alignItems = 'flex-start';
            wrapper.style.gap = '8px';
            wrapper.style.marginBottom = '4px';

            const checkbox = document.createElement('span');
            checkbox.className = 'inline-checkbox';
            checkbox.setAttribute('data-checked', 'false');
            checkbox.textContent = '☐';
            checkbox.style.cursor = 'pointer';
            checkbox.style.userSelect = 'none';
            checkbox.style.flexShrink = '0';

            // Caret anchor - stable place for caret right after checkbox
            const caretAnchor = document.createElement('span');
            caretAnchor.className = 'checkbox-anchor';
            caretAnchor.textContent = '\u200b';

            const textSpan = document.createElement('span');
            textSpan.className = 'checkbox-text';
            textSpan.style.flex = '1';
            textSpan.style.minWidth = '0';
            textSpan.textContent = initialText;

            wrapper.appendChild(checkbox);
            wrapper.appendChild(caretAnchor);
            wrapper.appendChild(textSpan);
            return wrapper;
          };

          // Determine caret position inside the checkbox text (0..textContent.length)
          // With the new structure: [checkbox][anchor][text]
          const checkboxAnchor = checkboxLine.querySelector<HTMLElement>('.checkbox-anchor');
          const isInAnchor = checkboxAnchor && range.startContainer.nodeType === Node.TEXT_NODE && checkboxAnchor.contains(range.startContainer);
          
          let caretOffset = 0;
          if (isInAnchor) {
            caretOffset = 0; // Caret is in anchor, treat as start
          } else if (
            checkboxText &&
            range.startContainer.nodeType === Node.TEXT_NODE &&
            checkboxText.contains(range.startContainer)
          ) {
            caretOffset = range.startOffset;
          } else if (range.startContainer === checkboxLine) {
            // children: [checkbox][anchor][text] => offset <= 2 means "behind checkbox"
            caretOffset = range.startOffset <= 2 ? 0 : textContent.length;
          } else {
            caretOffset = 0;
          }

          if (caretOffset > 0 && caretOffset < textContent.length && checkboxText) {
            // Split into two checkbox items
            const beforeText = textContent.slice(0, caretOffset);
            const afterText = textContent.slice(caretOffset);

            checkboxText.textContent = beforeText;

            const newItem = createCheckboxLine(afterText);
            checkboxLine.insertAdjacentElement('afterend', newItem);
            placeCaretInCheckboxText(newItem, false);
          } else {
            // New empty checkbox item below (common checklist behavior)
            const newItem = createCheckboxLine('');
            checkboxLine.insertAdjacentElement('afterend', newItem);
            placeCaretInCheckboxText(newItem, false);
          }

          editorEl.focus();
          handleInput();
          updateScrollInfo();
          return;
        }
      }
      // Outside checkbox-lines: let the browser handle Enter normally (lists/paragraphs etc.)
    }

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
  }, [handleBold, handleItalic, handleStrikethrough, handleBulletList, handleCheckbox, handleInput, updateScrollInfo, placeCaretInCheckboxText]);

  const isEmpty = useMemo(() => {
    if (!value) return true;
    if (typeof document === 'undefined') return value.trim().length === 0;

    const el = document.createElement('div');
    el.innerHTML = value;

    // Important: an empty list (<ul><li><br/></li></ul>) has no textContent,
    // but it's still "real content" and should hide the placeholder.
    const hasStructure = !!el.querySelector('ul, ol, .checkbox-line, .inline-checkbox');
    if (hasStructure) return false;

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
      
      {/* Editor with scrollbar indicator */}
      <div className="relative flex-1 min-h-0">
        <div
          ref={editorRef}
          contentEditable
          onInput={handleInput}
          onMouseDown={handleEditorMouseDown}
          onClick={handleEditorClick}
          onPaste={handlePaste}
          onKeyDown={handleKeyDown}
          onScroll={updateScrollInfo}
          data-placeholder={placeholder}
          data-empty={isEmpty ? 'true' : 'false'}
          className={cn(
            "h-full overflow-y-auto",
            "bg-white/10 rounded-lg p-2 pr-4",
            "text-sm leading-relaxed",
            "text-pure-white",
            "focus:outline-none focus-visible:ring-1 focus-visible:ring-white/30",
            // Enable smooth touch scrolling and text selection on mobile/tablet
            "touch-auto",
            // Placeholder (contentEditable is rarely :empty due to <br>, so use data-empty)
            "data-[empty=true]:before:content-[attr(data-placeholder)]",
            "data-[empty=true]:before:text-pure-white",
            "data-[empty=true]:before:absolute data-[empty=true]:before:top-2 data-[empty=true]:before:left-2",
            "data-[empty=true]:before:pointer-events-none data-[empty=true]:before:select-none",
            // List styling
            "[&_ul]:list-disc [&_ul]:ml-4 [&_ul]:my-1",
            "[&_ol]:list-decimal [&_ol]:ml-4 [&_ol]:my-1",
            "[&_li]:my-0.5",
            // Checkbox styling
            "[&_.inline-checkbox]:cursor-pointer [&_.inline-checkbox]:select-none",
            "[&_.checkbox-anchor]:w-0 [&_.checkbox-anchor]:overflow-hidden",
            "[&_.checkbox-line]:select-text [&_.checkbox-text]:select-text"
          )}
          suppressContentEditableWarning
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
});

RichNotesEditor.displayName = 'RichNotesEditor';
