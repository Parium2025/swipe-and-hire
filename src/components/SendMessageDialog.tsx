import { Dialog, DialogHeader, DialogTitle, DialogDescription, dialogCloseButtonClassName, dialogCloseIconClassName } from '@/components/ui/dialog';
import { DialogContentNoFocus } from '@/components/ui/dialog-no-focus';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Mail, MessageSquare, Send, Smartphone, X } from 'lucide-react';
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
import { supabase } from '@/integrations/supabase/client';
import { renderOutreachText, type OutreachTemplate } from '@/lib/outreach';
import { getManualOutreachTemplateGroups, type ManualOutreachActionKey } from '@/lib/outreachManualActions';
import { readCachedOutreachTemplates, writeCachedOutreachTemplates } from '@/lib/outreachStudioCache';

type ManualChannel = 'chat' | 'email' | 'push';

const MANUAL_CHANNELS: Array<{ value: ManualChannel; label: string; icon: typeof MessageSquare }> = [
  { value: 'chat', label: 'Chat', icon: MessageSquare },
  { value: 'email', label: 'E-post', icon: Mail },
  { value: 'push', label: 'Push', icon: Smartphone },
];

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
  presetAction?: ManualOutreachActionKey | null;
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
  presetAction = null,
}: SendMessageDialogProps) {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { isOnline, showOfflineToast } = useOnline();
  const createConversation = useCreateConversation();
  
  // Auto-save message draft to localStorage (unique per recipient + application)
  const draftKey = applicationId ? `message-${recipientId}-${applicationId}` : `message-${recipientId}`;
  const [message, setMessage, clearMessageDraft] = useFieldDraft(draftKey);
  const [sending, setSending] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [templates, setTemplates] = useState<OutreachTemplate[]>(() => (user ? readCachedOutreachTemplates(user.id) ?? [] : []));
  const [selectedChannels, setSelectedChannels] = useState<ManualChannel[]>(['chat']);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<Partial<Record<ManualChannel, string>>>({});
  const appliedPresetRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open || !user) return;

    const cached = readCachedOutreachTemplates(user.id);
    if (cached && cached.length > 0) {
      setTemplates(cached);
    }

    const fetchTemplates = async () => {
      const { data, error } = await supabase.from('outreach_templates').select('*').eq('is_active', true).order('created_at', { ascending: false });
      if (!error) {
        const filtered = (data ?? []).filter((template) => ['chat', 'email', 'push'].includes(template.channel)) as OutreachTemplate[];
        setTemplates(filtered);
        writeCachedOutreachTemplates(user.id, filtered);
      }
    };
    void fetchTemplates();
  }, [open, user]);

  const templateContext = useMemo(() => ({
    candidate_name: recipientName,
    first_name: recipientName.split(' ')[0] ?? recipientName,
    company_name: profile?.company_name ?? 'Parium',
    message: message.trim(),
    job_title: 'din process',
  }), [recipientName, profile?.company_name, message]);

  const templatesByChannel = useMemo(() => ({
    chat: templates.filter((template) => template.channel === 'chat'),
    email: templates.filter((template) => template.channel === 'email'),
    push: templates.filter((template) => template.channel === 'push'),
  }), [templates]);

  const manualActionTemplates = useMemo(() => getManualOutreachTemplateGroups(templates), [templates]);
  const presetGroup = presetAction ? manualActionTemplates[presetAction] : null;
  const dialogTitle = presetGroup?.action.label ?? 'Chatta';

  useEffect(() => {
    if (!open) {
      appliedPresetRef.current = null;
      return;
    }

    if (!presetAction || !presetGroup || presetGroup.channels.length === 0) {
      appliedPresetRef.current = null;
      return;
    }

    const presetSignature = `${presetAction}-${recipientId}-${jobId ?? 'no-job'}`;
    if (appliedPresetRef.current === presetSignature) return;

    const nextChannels = presetGroup.channels.filter((channel): channel is ManualChannel => ['chat', 'email', 'push'].includes(channel));
    const nextTemplateIds = nextChannels.reduce<Partial<Record<ManualChannel, string>>>((acc, channel) => {
      const template = presetGroup.templatesByChannel[channel];
      if (template) acc[channel] = template.id;
      return acc;
    }, {});

    setSelectedChannels(nextChannels);
    setSelectedTemplateIds(nextTemplateIds);

    const chatTemplate = presetGroup.templatesByChannel.chat;
    if (chatTemplate) {
      setMessage(renderOutreachText(chatTemplate.body, templateContext));
    }

    appliedPresetRef.current = presetSignature;
  }, [jobId, open, presetAction, presetGroup, recipientId, setMessage, templateContext]);

  const toggleChannel = (channel: ManualChannel) => {
    setSelectedChannels((prev) => prev.includes(channel) ? (prev.length === 1 ? prev : prev.filter((item) => item !== channel)) : [...prev, channel]);
  };

  const handleSend = async () => {
    if (!user) return;

    const chatSelected = selectedChannels.includes('chat');
    if (chatSelected && !message.trim() && !selectedTemplateIds.chat) return;

    if (selectedChannels.includes('email') && !selectedTemplateIds.email) {
      toast.error('Välj en e-postmall');
      return;
    }

    if (selectedChannels.includes('push') && !selectedTemplateIds.push) {
      toast.error('Välj en pushmall');
      return;
    }

    setSending(true);
    try {
      const multiChannel = selectedChannels.includes('email') || selectedChannels.includes('push') || Boolean(selectedTemplateIds.chat);
      let conversationId: string | undefined;

      if (multiChannel) {
        const { data, error } = await supabase.functions.invoke('outreach-dispatch', {
          body: {
            mode: 'manual',
            recipientUserId: recipientId,
            jobId: jobId || null,
            applicationId: applicationId || null,
            sends: selectedChannels.map((channel) => ({
              channel,
              templateId: selectedTemplateIds[channel] ?? null,
              customBody: channel === 'chat' ? message.trim() : null,
            })),
          },
        });

        if (error) throw error;
        conversationId = (data as { chatConversationId?: string } | null)?.chatConversationId;
      } else {
        const result = await createConversation.mutateAsync({
          memberIds: [recipientId],
          jobId: jobId || null,
          applicationId: applicationId || null,
          initialMessage: message.trim(),
        });

        conversationId = result.id;
      }

      toast.success(`Meddelande skickat till ${recipientName}`);
      setMessage('');
      clearMessageDraft();
      setSelectedChannels(['chat']);
      setSelectedTemplateIds({});
      onOpenChange(false);
      
      // Navigate to the conversation if requested
      if (navigateToMessages && conversationId) {
        navigate(`/messages?conversation=${conversationId}`);
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
    setSelectedChannels(['chat']);
    setSelectedTemplateIds({});
    setShowDiscardConfirm(false);
    onOpenChange(false);
  };

  const isDisabled = sending;

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
                {dialogTitle}
              </h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClose}
                onMouseDown={(e) => e.currentTarget.blur()}
                onMouseUp={(e) => e.currentTarget.blur()}
                className={dialogCloseButtonClassName}
              >
                <X className={dialogCloseIconClassName} />
              </Button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-5">
              <p className="text-white text-center text-sm leading-relaxed px-2">
                {presetGroup
                  ? `Skicka ${presetGroup.action.label.toLowerCase()} till ${recipientName} med de mallar som finns klara.`
                  : `Skicka ett premiumutskick till ${recipientName} via chat, e-post och push.`}
              </p>

              <div className="space-y-2">
                <Label className="text-white">Kanaler</Label>
                <div className="flex flex-wrap gap-2">
                  {MANUAL_CHANNELS.map(({ value, label, icon: Icon }) => {
                    const active = selectedChannels.includes(value);
                    return (
                      <Button key={value} type="button" variant={active ? 'glassBlue' : 'glass'} size="sm" onClick={() => toggleChannel(value)}>
                        <Icon className="h-3.5 w-3.5" />
                        {label}
                      </Button>
                    );
                  })}
                </div>
              </div>

              {selectedChannels.includes('chat') && templatesByChannel.chat.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-white">Chatmall</Label>
                  <Select
                    value={selectedTemplateIds.chat ?? ''}
                    onValueChange={(value) => {
                      setSelectedTemplateIds((prev) => ({ ...prev, chat: value }));
                      const template = templatesByChannel.chat.find((item) => item.id === value);
                      if (template) setMessage(renderOutreachText(template.body, templateContext));
                    }}
                  >
                    <SelectTrigger className="bg-white/10 border-white/20 text-white [&>svg]:text-white"><SelectValue placeholder="Välj chatmall" /></SelectTrigger>
                    <SelectContent>
                      {templatesByChannel.chat.map((template) => <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {selectedChannels.filter((channel) => channel !== 'chat').map((channel) => (
                <div key={channel} className="space-y-2">
                  <Label className="text-white">{channel === 'email' ? 'E-postmall' : 'Pushmall'}</Label>
                  <Select value={selectedTemplateIds[channel] ?? ''} onValueChange={(value) => setSelectedTemplateIds((prev) => ({ ...prev, [channel]: value }))}>
                    <SelectTrigger className="bg-white/10 border-white/20 text-white [&>svg]:text-white"><SelectValue placeholder="Välj mall" /></SelectTrigger>
                    <SelectContent>
                      {templatesByChannel[channel].map((template) => <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ))}

              <div className="space-y-2">
                <Label className="text-white">Chattmeddelande</Label>
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
