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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

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
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

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
      clearMessageDraft();
      onOpenChange(false);
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Kunde inte skicka meddelande');
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    if (message.trim()) {
      setShowDiscardConfirm(true);
    } else {
      onOpenChange(false);
    }
  };

  const handleDiscardAndClose = () => {
    setMessage('');
    clearMessageDraft();
    setShowDiscardConfirm(false);
    onOpenChange(false);
  };

  const isDisabled = !message.trim() || sending || !isOnline;

  return (
    <>
      <Dialog open={open} onOpenChange={(newOpen) => {
        if (!newOpen && message.trim()) {
          setShowDiscardConfirm(true);
        } else {
          onOpenChange(newOpen);
        }
      }}>
        <DialogContentNoFocus 
          hideClose
          className="w-[min(90vw,500px)] bg-card-parium text-white backdrop-blur-md border-white/20 max-h-[90vh] shadow-lg rounded-[24px] sm:rounded-xl overflow-x-hidden overflow-y-auto"
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
                  onClick={handleClose}
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
                className="h-[180px] md:h-[220px] min-h-[180px] md:min-h-[220px] bg-white/10 border-white/20 hover:border-white/50 text-white placeholder:text-white/50 resize-y transition-all duration-150 text-base"
                disabled={!isOnline}
              />

              <Button
                onClick={handleSend}
                disabled={isDisabled}
                className={`w-full min-h-[44px] rounded-full transition-all duration-150 active:scale-95 ${
                  !sending && message.trim() && isOnline ? 'border border-white/30' : ''
                }`}
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
            </CardContent>
          </Card>
        </DialogContentNoFocus>
      </Dialog>

      {/* Discard confirmation dialog */}
      <AlertDialog open={showDiscardConfirm} onOpenChange={setShowDiscardConfirm}>
        <AlertDialogContent className="bg-card-parium border-white/20 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Lämna utan att spara?</AlertDialogTitle>
            <AlertDialogDescription className="text-white/70">
              Du har skrivit ett meddelande som inte skickats. Om du lämnar nu kommer meddelandet att raderas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white">
              Fortsätt skriva
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDiscardAndClose}
              className="bg-red-500/20 border border-red-500/40 text-white hover:bg-red-500/30"
            >
              Lämna utan att spara
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
