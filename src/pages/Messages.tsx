import { useState } from 'react';
import { useMessages, Message } from '@/hooks/useMessages';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Inbox, 
  Send, 
  Mail, 
  MailOpen, 
  Clock, 
  Briefcase,
  MessageSquare,
  Loader2,
  Reply
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { sv } from 'date-fns/locale';

export default function Messages() {
  const { user } = useAuth();
  const { inbox, sent, isLoading, unreadCount, markAsRead } = useMessages();
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  const handleOpenMessage = (message: Message) => {
    setSelectedMessage(message);
    if (!message.is_read && message.recipient_id === user?.id) {
      markAsRead(message.id);
    }
  };

  const handleSendReply = async () => {
    if (!selectedMessage || !replyContent.trim() || !user) return;

    setSendingReply(true);
    try {
      const recipientId = selectedMessage.sender_id === user.id 
        ? selectedMessage.recipient_id 
        : selectedMessage.sender_id;

      const { error } = await supabase.from('messages').insert({
        sender_id: user.id,
        recipient_id: recipientId,
        content: replyContent.trim(),
        job_id: selectedMessage.job_id,
      });

      if (error) throw error;

      toast.success('Svar skickat!');
      setReplyContent('');
      setSelectedMessage(null);
    } catch (error) {
      console.error('Error sending reply:', error);
      toast.error('Kunde inte skicka svar');
    } finally {
      setSendingReply(false);
    }
  };

  const getDisplayName = (profile: Message['sender_profile'] | Message['recipient_profile']) => {
    if (!profile) return 'Okänd användare';
    if (profile.role === 'employer' && profile.company_name) {
      return profile.company_name;
    }
    return `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Okänd användare';
  };

  const getAvatarUrl = (profile: Message['sender_profile'] | Message['recipient_profile']) => {
    if (!profile) return null;
    if (profile.role === 'employer' && profile.company_logo_url) {
      return profile.company_logo_url;
    }
    return profile.profile_image_url;
  };

  const getInitials = (profile: Message['sender_profile'] | Message['recipient_profile']) => {
    if (!profile) return '?';
    if (profile.role === 'employer' && profile.company_name) {
      return profile.company_name.substring(0, 2).toUpperCase();
    }
    const first = profile.first_name?.[0] || '';
    const last = profile.last_name?.[0] || '';
    return (first + last).toUpperCase() || '?';
  };

  const MessageCard = ({ message, isSent }: { message: Message; isSent: boolean }) => {
    const profile = isSent ? message.recipient_profile : message.sender_profile;
    const isUnread = !isSent && !message.is_read;

    return (
      <Card 
        className={`bg-white/5 border-white/10 hover:bg-white/10 transition-colors cursor-pointer ${isUnread ? 'border-l-2 border-l-blue-400' : ''}`}
        onClick={() => handleOpenMessage(message)}
      >
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Avatar className="h-10 w-10 flex-shrink-0">
              <AvatarImage src={getAvatarUrl(profile) || undefined} />
              <AvatarFallback className="bg-white/10 text-white text-sm">
                {getInitials(profile)}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-medium text-white truncate">
                    {isSent ? 'Till: ' : ''}{getDisplayName(profile)}
                  </span>
                  {isUnread && (
                    <Badge variant="secondary" className="bg-blue-500/20 text-blue-300 text-xs">
                      Nytt
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1 text-white/50 text-xs flex-shrink-0">
                  <Clock className="h-3 w-3" />
                  {formatDistanceToNow(new Date(message.created_at), { 
                    addSuffix: true, 
                    locale: sv 
                  })}
                </div>
              </div>

              {message.job && (
                <div className="flex items-center gap-1 text-white/60 text-xs mb-1">
                  <Briefcase className="h-3 w-3" />
                  <span className="truncate">{message.job.title}</span>
                </div>
              )}

              <p className="text-white/70 text-sm line-clamp-2">
                {message.content}
              </p>
            </div>

            {isUnread ? (
              <Mail className="h-5 w-5 text-blue-400 flex-shrink-0" />
            ) : (
              <MailOpen className="h-5 w-5 text-white/30 flex-shrink-0" />
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  const EmptyState = ({ type }: { type: 'inbox' | 'sent' }) => (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
        {type === 'inbox' ? (
          <Inbox className="h-8 w-8 text-white/40" />
        ) : (
          <Send className="h-8 w-8 text-white/40" />
        )}
      </div>
      <h3 className="text-lg font-medium text-white mb-1">
        {type === 'inbox' ? 'Inga mottagna meddelanden' : 'Inga skickade meddelanden'}
      </h3>
      <p className="text-white/60 text-sm max-w-sm">
        {type === 'inbox' 
          ? 'När någon skickar ett meddelande till dig visas det här.'
          : 'Meddelanden du skickar till kandidater eller arbetsgivare visas här.'}
      </p>
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-white/50" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
          <MessageSquare className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Meddelanden</h1>
          <p className="text-white/60 text-sm">
            {unreadCount > 0 ? `${unreadCount} olästa meddelanden` : 'Alla meddelanden lästa'}
          </p>
        </div>
      </div>

      <Tabs defaultValue="inbox" className="w-full">
        <TabsList className="bg-white/5 border border-white/10 mb-4">
          <TabsTrigger 
            value="inbox" 
            className="data-[state=active]:bg-white/10 text-white/70 data-[state=active]:text-white gap-2"
          >
            <Inbox className="h-4 w-4" />
            Inkorg
            {unreadCount > 0 && (
              <Badge className="bg-blue-500 text-white text-xs ml-1">
                {unreadCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger 
            value="sent" 
            className="data-[state=active]:bg-white/10 text-white/70 data-[state=active]:text-white gap-2"
          >
            <Send className="h-4 w-4" />
            Skickat
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inbox" className="space-y-3">
          {inbox.length === 0 ? (
            <EmptyState type="inbox" />
          ) : (
            inbox.map((message) => (
              <MessageCard key={message.id} message={message} isSent={false} />
            ))
          )}
        </TabsContent>

        <TabsContent value="sent" className="space-y-3">
          {sent.length === 0 ? (
            <EmptyState type="sent" />
          ) : (
            sent.map((message) => (
              <MessageCard key={message.id} message={message} isSent={true} />
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Message Detail Dialog */}
      <Dialog open={!!selectedMessage} onOpenChange={(open) => !open && setSelectedMessage(null)}>
        <DialogContent className="bg-slate-900 border-white/10 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Meddelande
            </DialogTitle>
            <DialogDescription className="text-white/60">
              {selectedMessage?.job && (
                <span className="flex items-center gap-1">
                  <Briefcase className="h-3 w-3" />
                  Angående: {selectedMessage.job.title}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {selectedMessage && (
            <div className="space-y-4">
              {/* Sender/Recipient info */}
              <div className="flex items-center gap-3 p-3 bg-white/5 rounded-lg">
                <Avatar className="h-10 w-10">
                  <AvatarImage 
                    src={getAvatarUrl(
                      selectedMessage.sender_id === user?.id 
                        ? selectedMessage.recipient_profile 
                        : selectedMessage.sender_profile
                    ) || undefined} 
                  />
                  <AvatarFallback className="bg-white/10 text-white">
                    {getInitials(
                      selectedMessage.sender_id === user?.id 
                        ? selectedMessage.recipient_profile 
                        : selectedMessage.sender_profile
                    )}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-white">
                    {selectedMessage.sender_id === user?.id ? 'Till: ' : 'Från: '}
                    {getDisplayName(
                      selectedMessage.sender_id === user?.id 
                        ? selectedMessage.recipient_profile 
                        : selectedMessage.sender_profile
                    )}
                  </p>
                  <p className="text-white/50 text-xs">
                    {formatDistanceToNow(new Date(selectedMessage.created_at), { 
                      addSuffix: true, 
                      locale: sv 
                    })}
                  </p>
                </div>
              </div>

              {/* Message content */}
              <div className="p-4 bg-white/5 rounded-lg">
                <p className="text-white/90 whitespace-pre-wrap">
                  {selectedMessage.content}
                </p>
              </div>

              {/* Reply section */}
              <div className="space-y-3 pt-2 border-t border-white/10">
                <Textarea
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  placeholder="Skriv ett svar..."
                  className="min-h-[100px] bg-white/5 border-white/10 text-white placeholder:text-white/40"
                />
                <div className="flex justify-end gap-2">
                  <Button 
                    variant="ghost" 
                    onClick={() => setSelectedMessage(null)}
                  >
                    Stäng
                  </Button>
                  <Button
                    variant="glassBlue"
                    disabled={!replyContent.trim() || sendingReply}
                    onClick={handleSendReply}
                  >
                    {sendingReply ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                    ) : (
                      <Reply className="h-4 w-4 mr-1.5" />
                    )}
                    Svara
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
