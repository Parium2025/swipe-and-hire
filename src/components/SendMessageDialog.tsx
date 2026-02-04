import { Dialog, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DialogContentNoFocus } from '@/components/ui/dialog-no-focus';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { useState } from 'react';
import { Loader2, Send, MessageSquare, WifiOff, X } from 'lucide-react';
import { useOnline } from '@/hooks/useOnlineStatus';
import { useFieldDraft } from '@/hooks/useFormDraft';
import { useCreateConversation } from '@/hooks/useConversations';
import { useNavigate } from 'react-router-dom';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertDialogContentNoFocus } from '@/components/ui/alert-dialog-no-focus';

interface SendMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipientId: string;
  recipientName: string;
  jobId?: string | null;
  /** Application ID for frozen profile snapshot - required for candidate chats */
  applicationId?: string | null;
  /** If true, navigate to messages page after sending */
  navigateToMessages?: boolean;
}

export function SendMessageDialog({
  open,
  onOpenChange,
  recipientId,
  recipientName,
  jobId,
  applicationId,
  navigateToMessages = false,
}: SendMessageDialogProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { isOnline, showOfflineToast } = useOnline();
  const createConversation = useCreateConversation();
  
  // Auto-save message draft to localStorage (unique per recipient + application)
  const draftKey = applicationId ? `message-${recipientId}-${applicationId}` : `message-${recipientId}`;
  const [message, setMessage, clearMessageDraft] = useFieldDraft(draftKey);
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
      // Use the new conversation system with frozen profile support
      const result = await createConversation.mutateAsync({
        memberIds: [recipientId],
        jobId: jobId || null,
        applicationId: applicationId || null,
        initialMessage: message.trim(),
      });

      toast.success(`Meddelande skickat till ${recipientName}`);
      setMessage('');
      clearMessageDraft();
      onOpenChange(false);
      
      // Navigate to the conversation if requested
      if (navigateToMessages && result.id) {
        navigate(`/messages?conversation=${result.id}`);
      }
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
                <button
                  onClick={handleClose}
                  className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full text-white bg-white/10 md:bg-transparent md:hover:bg-white/20 transition-colors focus:outline-none"
                >
                  <X className="h-4 w-4" />
                </button>
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
                onMouseDown={(e) => e.currentTarget.blur()}
                onMouseUp={(e) => e.currentTarget.blur()}
                disabled={isDisabled}
                className={`w-full min-h-[44px] rounded-full transition-colors duration-150 active:scale-95 focus:outline-none focus:ring-0 ${
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

      {/* Discard confirmation dialog - matching UnsavedChangesDialog design */}
      <AlertDialog open={showDiscardConfirm} onOpenChange={setShowDiscardConfirm}>
        <AlertDialogContentNoFocus
          className="max-w-lg bg-white/10 backdrop-blur-sm border-white/20 text-white shadow-lg overflow-hidden"
        >
          <AlertDialogHeader className="text-center">
            <AlertDialogTitle className="text-center">Osparade ändringar</AlertDialogTitle>
            <AlertDialogDescription className="text-white text-center">
              Du har skrivit ett meddelande som inte skickats. Vad vill du göra?
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="flex flex-row gap-2 justify-center pt-2">
            <AlertDialogCancel
              onClick={() => setShowDiscardConfirm(false)}
              className="rounded-full px-3 py-2 text-sm bg-white/5 backdrop-blur-[2px] border-white/20 text-white transition-all duration-300 md:hover:bg-white/15 md:hover:text-white md:hover:border-white/50 mt-0 outline-none focus:outline-none focus:ring-0 focus:ring-offset-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
            >
              Fortsätt skriva
            </AlertDialogCancel>

            <AlertDialogAction
              onClick={handleDiscardAndClose}
              className="rounded-full px-3 py-2 text-sm bg-red-500/20 backdrop-blur-sm text-white border border-red-500/40 md:hover:bg-red-500/30 md:hover:border-red-500/50 transition-all duration-300 whitespace-nowrap outline-none focus:outline-none focus:ring-0 focus:ring-offset-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
            >
              Lämna utan att spara
            </AlertDialogAction>
          </div>
        </AlertDialogContentNoFocus>
      </AlertDialog>
    </>
  );
}
