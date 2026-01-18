import { Dialog, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DialogContentNoFocus } from '@/components/ui/dialog-no-focus';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { useState } from 'react';
import { Loader2, Send, MessageSquare, WifiOff, X } from 'lucide-react';
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
      <DialogContentNoFocus 
        hideClose
        className="w-[min(90vw,500px)] bg-card-parium text-white backdrop-blur-md border-white/20 max-h-[85vh] shadow-lg rounded-[24px] sm:rounded-xl overflow-hidden"
      >
        <DialogHeader className="sr-only">
          <DialogTitle className="sr-only">Skicka meddelande</DialogTitle>
          <DialogDescription className="sr-only">Skriv ett meddelande till {recipientName}</DialogDescription>
        </DialogHeader>
        
        <Card className="bg-white/10 backdrop-blur-sm border-white/20 ring-0 shadow-none relative w-full">
          <CardHeader className="pb-4 pt-6">
            <div className="flex items-center justify-between">
              <CardTitle className="text-white flex-1 text-center text-xl flex items-center justify-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Skicka meddelande
              </CardTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onOpenChange(false)}
                className="absolute right-2 top-2 h-8 w-8 text-white transition-all duration-300 md:hover:text-white md:hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <CardDescription className="text-white text-center text-sm leading-snug mt-2">
              Skriv ett meddelande till {recipientName}
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4 px-4 pb-5 pt-2">
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Skriv ditt meddelande här..."
              className="min-h-[180px] bg-white/10 border-white/20 hover:border-white/50 text-white placeholder:text-white/50 resize-none transition-all duration-150 text-base"
              disabled={!isOnline}
            />

            <div className="flex gap-2">
              <Button
                onClick={handleSend}
                disabled={isDisabled}
                size="sm"
                className={`flex-1 min-h-[38px] text-sm rounded-full transition-all duration-150 active:scale-95 ${
                  !sending && message.trim() && isOnline ? 'border border-white/30' : ''
                }`}
              >
                {sending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                ) : !isOnline ? (
                  <WifiOff className="h-3.5 w-3.5 mr-1.5" />
                ) : (
                  <Send className="h-3.5 w-3.5 mr-1.5" />
                )}
                {!isOnline ? 'Offline' : 'Skicka'}
              </Button>
              <Button 
                variant="glass"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="min-h-[38px] text-sm rounded-full"
              >
                Avbryt
              </Button>
            </div>
          </CardContent>
        </Card>
      </DialogContentNoFocus>
    </Dialog>
  );
}
