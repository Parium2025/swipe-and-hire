import { Dialog, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DialogContentNoFocus } from '@/components/ui/dialog-no-focus';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { useState } from 'react';
import { Loader2, Send, MessageSquare, WifiOff, X } from 'lucide-react';
import { useOnline } from '@/hooks/useOnlineStatus';
import { useFieldDraft } from '@/hooks/useFormDraft';
import { useCreateConversation } from '@/hooks/useConversations';
import { useNavigate } from 'react-router-dom';
import { AnimatedBackground } from '@/components/AnimatedBackground';
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
  /** Render above z-[100] overlays (e.g. SwipeViewer) */
  elevated?: boolean;
}

export function SendMessageDialog({
  open,
  onOpenChange,
  recipientId,
  recipientName,
  jobId,
  applicationId,
  navigateToMessages = false,
  elevated,
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
          elevated={elevated}
          className="parium-panel max-w-none w-[min(92vw,440px)] h-auto max-h-[75vh] sm:max-h-[80vh] bg-parium-gradient text-white [&>button]:hidden p-0 flex flex-col border-none shadow-none rounded-[24px] sm:rounded-xl overflow-hidden"
        >
          <DialogHeader className="sr-only">
            <DialogTitle className="sr-only">Chatta</DialogTitle>
            <DialogDescription className="sr-only">Skriv ditt meddelande till {recipientName}</DialogDescription>
          </DialogHeader>
          <AnimatedBackground showBubbles={false} />

          <div className="relative z-10 flex flex-col max-h-[75vh] sm:max-h-[80vh]">
            <div className="relative flex items-center justify-center p-4 border-b border-white/20 flex-shrink-0 bg-background/10">
              <h2 className="text-white text-lg font-semibold flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Chatta
              </h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClose}
                onMouseDown={(e) => e.currentTarget.blur()}
                onMouseUp={(e) => e.currentTarget.blur()}
                className="absolute right-4 top-4 h-8 w-8 !min-h-0 !min-w-0 rounded-full text-white bg-white/10 md:bg-transparent md:hover:bg-white/20 transition-colors duration-300 focus:outline-none focus:ring-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-5">
              <p className="text-white text-center text-sm leading-relaxed px-2">
                Skriv ett meddelande till {recipientName} för att starta chatten.
              </p>

              <div className="space-y-2">
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                  placeholder="Skriv ditt meddelande..."
                  className="h-[180px] md:h-[220px] min-h-[180px] md:min-h-[220px] bg-white/10 border-white/20 hover:border-white/30 focus:border-white/40 text-white placeholder:text-white/50 resize-y transition-all duration-150 text-base"
                disabled={!isOnline}
              />
              </div>

              <Button
                onClick={handleSend}
                onMouseDown={(e) => e.currentTarget.blur()}
                onMouseUp={(e) => e.currentTarget.blur()}
                disabled={isDisabled}
                className={`w-full h-11 !min-h-0 rounded-full border transition-[border-color,transform] duration-150 active:scale-95 focus:outline-none focus:ring-0 ${
                  !sending && message.trim() && isOnline ? 'border-white/30' : 'border-transparent'
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
            </div>
          </div>
        </DialogContentNoFocus>
      </Dialog>

      {/* Discard confirmation dialog - matching UnsavedChangesDialog design */}
      <AlertDialog open={showDiscardConfirm} onOpenChange={setShowDiscardConfirm}>
        <AlertDialogContentNoFocus
          elevated={elevated}
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
