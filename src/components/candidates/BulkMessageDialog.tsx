import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface BulkMessageDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  count: number;
  onSend: (content: string) => Promise<void>;
  progress?: { current: number; total: number } | null;
}

export function BulkMessageDialog({ open, onOpenChange, count, onSend, progress }: BulkMessageDialogProps) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);

  // Reset sent state when dialog opens
  useEffect(() => {
    if (open) setSentSuccess(false);
  }, [open]);

  const handleSend = async () => {
    if (!message.trim()) return;
    setSending(true);
    try {
      await onSend(message.trim());
      setSentSuccess(true);
      setMessage('');
    } catch (error) {
      console.error('Bulk message send failed:', error);
      // Error toast is typically handled by the caller, but ensure we surface something
    } finally {
      setSending(false);
    }
  };

  if (!open) return null;

  const isSending = sending || (progress !== null && progress !== undefined);
  const progressPct = progress ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => !isSending && onOpenChange(false)}>
      <div 
        className="w-[min(90vw,400px)] glass-panel rounded-[24px] sm:rounded-xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 relative">
          {/* Header */}
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-white flex-1 text-center text-xl font-semibold">
              Skicka meddelande
            </h3>
            <button
              onClick={() => !isSending && onOpenChange(false)}
              disabled={isSending}
              className="absolute right-2 top-2 h-8 w-8 flex items-center justify-center rounded-md text-white transition-colors duration-300 md:hover:bg-white/10 disabled:opacity-40"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-white text-center text-sm leading-snug mb-5">
            Till {count} kandidat{count !== 1 ? 'er' : ''}
          </p>

          {/* Textarea */}
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Skriv ditt meddelande..."
            className="w-full h-32 bg-white/5 border border-white/20 rounded-lg p-3 text-white text-sm resize-none focus:outline-none focus:ring-1 focus:ring-white/30 placeholder:text-white/30"
            autoFocus
            disabled={isSending}
          />

          {/* Progress bar */}
          {progress && (
            <div className="mt-3 space-y-1">
              <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white/70 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <p className="text-white/50 text-xs text-center">
                {progress.current} av {progress.total} skickade
              </p>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 mt-5">
            <Button 
              variant="glass"
              onClick={handleSend}
              disabled={!message.trim() || isSending}
              className={`flex-1 min-h-[44px] rounded-full transition-colors duration-150 active:scale-95 ${
                !isSending && message.trim() ? 'border border-white/30' : 'border border-transparent'
              }`}
            >
              {isSending ? (progress ? `Skickar ${progress.current}/${progress.total}...` : 'Skickar...') : 'Skicka'}
            </Button>
            <Button 
              variant="glass"
              onClick={() => onOpenChange(false)}
              disabled={isSending}
              className="min-h-[44px] rounded-full"
            >
              Avbryt
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
