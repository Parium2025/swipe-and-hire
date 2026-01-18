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
      <DialogContent className="bg-gradient-to-br from-[#1a4a6e] to-[#0d2a3f] border-white/10 text-white max-w-md p-6">
        <DialogHeader className="text-center pb-2">
          <DialogTitle className="flex items-center justify-center gap-2 text-xl">
            <MessageSquare className="h-5 w-5" />
            Skicka meddelande
          </DialogTitle>
          <DialogDescription className="text-white/70">
            Skriv ett meddelande till {recipientName}
          </DialogDescription>
        </DialogHeader>

        {/* Inner content card - matching Skapa jobb style */}
        <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 space-y-4 border border-white/10">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Skriv ditt meddelande här..."
            className="min-h-[120px] bg-white/10 border-white/20 text-white placeholder:text-white/40 resize-none rounded-lg"
            disabled={!isOnline}
          />
        </div>

        <div className="flex justify-center gap-3 pt-2">
          <Button
            variant="glassBlue"
            disabled={isDisabled}
            onClick={handleSend}
            className={!isOnline ? 'opacity-50 cursor-not-allowed' : ''}
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
