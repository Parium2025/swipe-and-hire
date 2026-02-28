import { useState } from 'react';

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
    await onSend(message.trim());
    setSending(false);
    setMessage('');
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => onOpenChange(false)}>
      <div className="bg-slate-900 border border-white/20 rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-white mb-1">Skicka meddelande</h3>
        <p className="text-sm text-white/60 mb-4">Till {count} kandidat{count !== 1 ? 'er' : ''}</p>
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="Skriv ditt meddelande..."
          className="w-full h-32 bg-white/5 border border-white/20 rounded-lg p-3 text-white text-sm resize-none focus:outline-none focus:ring-1 focus:ring-white/30 placeholder:text-white/30"
          autoFocus
        />
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={() => onOpenChange(false)}
            className="px-4 py-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 text-sm transition-colors"
          >
            Avbryt
          </button>
          <button
            onClick={handleSend}
            disabled={!message.trim() || sending}
            className="px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm hover:bg-white/20 transition-colors disabled:opacity-40"
          >
            {sending ? 'Skickar...' : 'Skicka'}
          </button>
        </div>
      </div>
    </div>
  );
}
