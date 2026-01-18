import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';
import { Loader2, Send, MessageSquare, WifiOff } from 'lucide-react';
import { useOnline } from '@/hooks/useOnlineStatus';
import { useFieldDraft } from '@/hooks/useFormDraft';

interface SendMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipientId: string;
  recipientName: string;
  jobId?: string | null;
}

export function SendMessageDialog({
  open,
  onOpenChange,
  recipientId,
  recipientName,
  jobId,
}: SendMessageDialogProps) {
  const { user } = useAuth();
  const { isOnline, showOfflineToast } = useOnline();
  // Auto-save message draft to localStorage (unique per recipient)
  const [message, setMessage, clearMessageDraft] = useFieldDraft(`message-${recipientId}`);
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!isOnline) {
      showOfflineToast();
      return;
    }
    
    if (!user || !message.trim()) return;

    setSending(true);
    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          sender_id: user.id,
          recipient_id: recipientId,
          content: message.trim(),
          job_id: jobId || null,
        });

      if (error) throw error;

      toast.success(`Meddelande skickat till ${recipientName}`);
      setMessage('');
      clearMessageDraft(); // Rensa sparad draft efter lyckad skickning
      onOpenChange(false);
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Kunde inte skicka meddelande');
    } finally {
      setSending(false);
    }
  };

  const isDisabled = !message.trim() || sending || !isOnline;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-white/10 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Skicka meddelande
          </DialogTitle>
          <DialogDescription className="text-white">
            Skriv ett meddelande till {recipientName}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Skriv ditt meddelande här..."
            className="min-h-[120px] bg-white/5 border-white/10 text-white placeholder:text-white/40 resize-none"
            disabled={!isOnline}
          />
        </div>

        <div className="flex justify-end gap-3">
          <Button
            variant="glassBlue"
            disabled={isDisabled}
            onClick={handleSend}
            className={`min-h-[44px] rounded-full transition-all duration-150 active:scale-95 ${
              !isDisabled ? 'border border-white/30' : ''
            } ${!isOnline ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
            ) : !isOnline ? (
              <WifiOff className="h-4 w-4 mr-1.5" />
            ) : (
              <Send className="h-4 w-4 mr-1.5" />
            )}
            {!isOnline ? 'Offline' : 'Skicka'}
          </Button>
          <Button 
            onClick={() => onOpenChange(false)}
            className="bg-white/10 hover:bg-white/20 text-white border-0"
          >
            Avbryt
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
