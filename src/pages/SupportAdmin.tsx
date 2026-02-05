import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Clock, CheckCircle, AlertCircle, MessageCircle, User, Calendar, Tag } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface SupportTicket {
  id: string;
  category: string;
  subject: string;
  message: string;
  status: string;
  created_at: string;
  updated_at: string;
  profiles?: {
    first_name: string;
    last_name: string;
  };
}

interface SupportMessage {
  id: string;
  ticket_id: string;
  message: string;
  is_admin_reply: boolean;
  created_at: string;
  profiles?: {
    first_name: string;
    last_name: string;
  };
}

const SupportAdmin = () => {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [replyMessage, setReplyMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [replyLoading, setReplyLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchTickets();
  }, []);

  useEffect(() => {
    if (selectedTicket) {
      fetchMessages(selectedTicket.id);
    }
  }, [selectedTicket]);

  const fetchTickets = async () => {
    try {
      const { data: ticketsData, error } = await supabase
        .from('support_tickets')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Hämta användardata separat
      if (ticketsData && ticketsData.length > 0) {
        const userIds = [...new Set(ticketsData.map(t => t.user_id))];
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name')
          .in('user_id', userIds);

        const ticketsWithProfiles = ticketsData.map(ticket => ({
          ...ticket,
          profiles: profilesData?.find(p => p.user_id === ticket.user_id) || null
        }));
        
        setTickets(ticketsWithProfiles);
      } else {
        setTickets(ticketsData || []);
      }
    } catch (error) {
      console.error('Error fetching tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (ticketId: string) => {
    try {
      const { data: messagesData, error } = await supabase
        .from('support_messages')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      // Hämta användardata separat för meddelanden
      if (messagesData && messagesData.length > 0) {
        const userIds = [...new Set(messagesData.filter(m => m.user_id).map(m => m.user_id))];
        let profilesData: any[] = [];
        
        if (userIds.length > 0) {
          const { data } = await supabase
            .from('profiles')
            .select('user_id, first_name, last_name')
            .in('user_id', userIds);
          profilesData = data || [];
        }

        const messagesWithProfiles = messagesData.map(message => ({
          ...message,
          profiles: message.user_id ? profilesData.find(p => p.user_id === message.user_id) || null : null
        }));
        
        setMessages(messagesWithProfiles);
      } else {
        setMessages(messagesData || []);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const updateTicketStatus = async (ticketId: string, status: string) => {
    try {
      const { error } = await supabase
        .from('support_tickets')
        .update({ status })
        .eq('id', ticketId);

      if (error) throw error;

      toast({
        title: "Status uppdaterad",
        description: `Ärendet har markerats som ${getStatusLabel(status).toLowerCase()}`
      });

      fetchTickets();
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket({ ...selectedTicket, status });
      }
    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        title: "Fel",
        description: "Kunde inte uppdatera status",
        variant: "destructive"
      });
    }
  };

  const sendReply = async () => {
    if (!selectedTicket || !replyMessage.trim()) return;
    
    // Check if online before sending
    if (!navigator.onLine) {
      toast({
        title: 'Offline',
        description: 'Du måste vara online för att skicka svar',
        variant: 'destructive'
      });
      return;
    }

    setReplyLoading(true);
    try {
      const { error } = await supabase
        .from('support_messages')
        .insert({
          ticket_id: selectedTicket.id,
          message: replyMessage,
          is_admin_reply: true,
          admin_email: 'fredrikandits@hotmail.com'
        });

      if (error) throw error;

      // Uppdatera status till "in_progress" om det var "open"
      if (selectedTicket.status === 'open') {
        await updateTicketStatus(selectedTicket.id, 'in_progress');
      }

      toast({
        title: "Svar skickat",
        description: "Ditt svar har skickats till kunden"
      });

      setReplyMessage('');
      fetchMessages(selectedTicket.id);
    } catch (error) {
      console.error('Error sending reply:', error);
      toast({
        title: "Fel",
        description: "Kunde inte skicka svar",
        variant: "destructive"
      });
    } finally {
      setReplyLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'closed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'in_progress':
        return <Clock className="h-4 w-4 text-blue-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-yellow-100 text-yellow-800';
      case 'closed':
        return 'bg-green-100 text-green-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'open':
        return 'Öppen';
      case 'closed':
        return 'Stängd';
      case 'in_progress':
        return 'Pågår';
      default:
        return status;
    }
  };

  const getCategoryLabel = (category: string) => {
    const categoryMap: { [key: string]: string } = {
      'technical': 'Teknisk support',
      'billing': 'Fakturering',
      'account': 'Kontofrågor',
      'feature': 'Funktionsfrågor',
      'other': 'Övrigt'
    };
    return categoryMap[category] || category;
  };

  if (loading) {
    return (
       <div className="max-w-4xl mx-auto space-y-6 px-3 md:px-8 py-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white">Support Admin</h1>
          <p className="text-white mt-2">Laddar ärenden...</p>
        </div>
      </div>
    );
  }

  return (
     <div className="max-w-4xl mx-auto space-y-6 px-3 md:px-8 py-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-white">Support Admin</h1>
        <p className="text-white mt-2">Hantera alla supportärenden</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ärendelista */}
        <div className="lg:col-span-1">
          <Card className="bg-white/10 backdrop-blur-sm border-white/20">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <MessageCircle className="h-5 w-5" />
                Supportärenden ({tickets.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-96 overflow-y-auto">
                {tickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    className={`p-4 border-b border-white/10 cursor-pointer hover:bg-white/5 hover:border-white/50 transition-colors ${
                      selectedTicket?.id === ticket.id ? 'bg-white/10' : ''
                    }`}
                    onClick={() => setSelectedTicket(ticket)}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(ticket.status)}
                        <Badge className={`${getStatusColor(ticket.status)} text-sm`}>
                          {getStatusLabel(ticket.status)}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-white font-medium text-sm truncate mb-1">
                      {ticket.subject}
                    </p>
                    <p className="text-white text-sm mb-2">
                      {ticket.profiles?.first_name} {ticket.profiles?.last_name}
                    </p>
                    <p className="text-white text-sm">
                      {new Date(ticket.created_at).toLocaleString('sv-SE')}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Ärendedetaljer */}
        <div className="lg:col-span-2">
          {selectedTicket ? (
            <Card className="bg-white/10 backdrop-blur-sm border-white/20">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-white">{selectedTicket.subject}</CardTitle>
                    <CardDescription className="text-white mt-1">
                      Ärende {selectedTicket.id.slice(0, 8)}
                    </CardDescription>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Badge className={`${getStatusColor(selectedTicket.status)} self-end`}>
                      {getStatusLabel(selectedTicket.status)}
                    </Badge>
                    <Select
                      value={selectedTicket.status}
                      onValueChange={(value) => updateTicketStatus(selectedTicket.id, value)}
                    >
                      <SelectTrigger className="w-32 h-8 text-sm bg-white/10 border-white/20 hover:border-white/50 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900/85 backdrop-blur-xl border border-white/20">
                        <SelectItem value="open">Öppen</SelectItem>
                        <SelectItem value="in_progress">Pågår</SelectItem>
                        <SelectItem value="closed">Stängd</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Ärendeinfo */}
                <div className="grid grid-cols-2 gap-4 p-4 bg-white/5 rounded-lg">
                  <div className="flex items-center gap-2 text-white">
                    <User className="h-4 w-4" />
                    <span className="text-sm">
                      {selectedTicket.profiles?.first_name} {selectedTicket.profiles?.last_name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-white">
                    <Tag className="h-4 w-4" />
                    <span className="text-sm">{getCategoryLabel(selectedTicket.category)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-white">
                    <Calendar className="h-4 w-4" />
                    <span className="text-sm">
                      {new Date(selectedTicket.created_at).toLocaleString('sv-SE')}
                    </span>
                  </div>
                </div>

                {/* Ursprungligt meddelande */}
                <div className="p-4 bg-white/5 rounded-lg">
                  <p className="text-white text-sm font-medium mb-2">Ursprungligt meddelande:</p>
                  <p className="text-white text-sm whitespace-pre-wrap">
                    {selectedTicket.message}
                  </p>
                </div>

                {/* Konversation */}
                {messages.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-white text-sm font-medium">Konversation:</p>
                    <div className="max-h-64 overflow-y-auto space-y-3">
                      {messages.map((message) => (
                        <div
                          key={message.id}
                          className={`p-3 rounded-lg ${
                            message.is_admin_reply
                              ? 'bg-blue-500/20 ml-8'
                              : 'bg-white/5 mr-8'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-white text-sm font-medium">
                              {message.is_admin_reply 
                                ? 'Admin (Du)' 
                                : `${message.profiles?.first_name} ${message.profiles?.last_name}`
                              }
                            </span>
                            <span className="text-white text-sm">
                              {new Date(message.created_at).toLocaleString('sv-SE')}
                            </span>
                          </div>
                          <p className="text-white text-sm whitespace-pre-wrap">
                            {message.message}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Svarsformulär */}
                {selectedTicket.status !== 'closed' && (
                  <div className="space-y-3">
                    <Label className="text-white text-sm">Svara på ärende:</Label>
                    <Textarea
                      value={replyMessage}
                      onChange={(e) => setReplyMessage(e.target.value)}
                      placeholder="Skriv ditt svar här..."
                      className="bg-white/10 border-white/20 hover:border-white/50 text-white placeholder:text-white min-h-24"
                      rows={4}
                    />
                    <div className="flex gap-2">
                      <Button
                        onClick={sendReply}
                        disabled={!replyMessage.trim() || replyLoading}
                        className="bg-primary hover:bg-primary/90 text-white"
                      >
                        {replyLoading ? 'Skickar...' : 'Skicka svar'}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => updateTicketStatus(selectedTicket.id, 'closed')}
                        className="border-white/20 text-white hover:bg-white/10"
                      >
                        Stäng ärende
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-white/10 backdrop-blur-sm border-white/20">
              <CardContent className="flex items-center justify-center h-96">
                <p className="text-white">Välj ett ärende för att visa detaljer</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default SupportAdmin;