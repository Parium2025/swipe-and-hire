import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface BulkMessageDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  count: number;
  onSend: (content: string) => Promise<void>;
}

export function BulkMessageDialog({ open, onOpenChange, count, onSend }: BulkMessageDialogProps) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!message.trim()) return;
    setSending(true);
    try {
      await onSend(message.trim());
      setMessage('');
    } finally {
      setSending(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => onOpenChange(false)}>
      <div 
        className="w-[min(90vw,400px)] bg-card-parium backdrop-blur-md border border-white/20 rounded-[24px] sm:rounded-xl shadow-lg overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="bg-white/10 backdrop-blur-sm border-white/20 p-6 relative">
          {/* Header */}
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-white flex-1 text-center text-xl font-semibold">
              Skicka meddelande
            </h3>
            <button
              onClick={() => onOpenChange(false)}
              className="absolute right-2 top-2 h-8 w-8 flex items-center justify-center rounded-md text-white transition-colors duration-300 md:hover:bg-white/10"
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
          />

          {/* Buttons — centered, matching Skapa jobb style */}
          <div className="flex gap-3 mt-5">
            <Button 
              variant="glass"
              onClick={handleSend}
              disabled={!message.trim() || sending}
              className={`flex-1 min-h-[44px] rounded-full transition-colors duration-150 active:scale-95 ${
                !sending && message.trim() ? 'border border-white/30' : 'border border-transparent'
              }`}
            >
              {sending ? 'Skickar...' : 'Skicka'}
            </Button>
            <Button 
              variant="glass"
              onClick={() => onOpenChange(false)}
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
