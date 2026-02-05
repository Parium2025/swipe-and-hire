import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Clock, CheckCircle, AlertCircle, ChevronDown, Check, WifiOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useOnline } from '@/hooks/useOnlineStatus';
import { useFieldDraft } from '@/hooks/useFormDraft';

interface SupportTicket {
  id: string;
  category: string;
  subject: string;
  message: string;
  status: string;
  created_at: string;
  updated_at: string;
}

const Support = () => {
  const [category, setCategory] = useState('');
  // Auto-save message draft to localStorage
  const [message, setMessage, clearMessageDraft, hasMessageDraft] = useFieldDraft('support-message');
  const [loading, setLoading] = useState(false);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(true);
  const { toast } = useToast();
  const { isOnline, showOfflineToast } = useOnline();

  // Hämta befintliga ärenden
  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTickets(data || []);
    } catch (error) {
      console.error('Error fetching tickets:', error);
    } finally {
      setTicketsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isOnline) {
      showOfflineToast();
      return;
    }
    
    if (!category || !message) {
      toast({
        title: "Fel",
        description: "Vänligen fyll i alla fält",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    
    try {
      const { data: newTicket, error } = await supabase
        .from('support_tickets')
        .insert({
          category,
          subject: categoryOptions.find(opt => opt.value === category)?.label || 'Supportärende',
          message,
          status: 'open'
        })
        .select()
        .single();

      if (error) throw error;

      // Skicka e-mail notifiering
      try {
        await supabase.functions.invoke('notify-support-ticket', {
          body: { ticketId: newTicket.id }
        });
      } catch (emailError) {
        console.error('Error sending notification email:', emailError);
        // Fortsätt ändå även om e-mailet misslyckas
      }

      toast({
        title: "Meddelande skickat!",
        description: "Vi kommer att svara inom 24 timmar."
      });
      
      setCategory('');
      setMessage('');
      clearMessageDraft(); // Rensa sparad draft efter lyckad submit
      fetchTickets(); // Uppdatera listan
    } catch (error) {
      console.error('Error creating ticket:', error);
      toast({
        title: "Fel",
        description: "Kunde inte skicka meddelandet. Försök igen.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Mock tickets ersatt med riktiga data från databasen

  // Kategorier för dropdown (matchar stilen från Sök jobb)
  const categoryOptions = [
    { value: 'technical', label: 'Teknisk support' },
    { value: 'billing', label: 'Fakturering' },
    { value: 'account', label: 'Kontofrågor' },
    { value: 'other', label: 'Övrigt' },
  ];

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

  return (
     <div className="space-y-8 max-w-4xl mx-auto px-3 md:px-8 animate-fade-in">
      <div className="text-center mb-6">
        <h1 className="text-xl md:text-2xl font-semibold text-white tracking-tight">Kundtjänst</h1>
      </div>

      {/* Support Form */}
      <div className="bg-white/5 border border-white/10 rounded-lg">
        <div className="px-6 py-4 border-b border-white/10">
          <h3 className="text-lg font-semibold text-white">Skicka ett meddelande</h3>
          <p className="text-sm text-white">Beskriv ditt problem eller din fråga så detaljerat som möjligt</p>
        </div>
        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="category" className="text-sm text-white">Kategori</Label>
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full h-9 bg-white/5 border-white/10 text-white transition-colors justify-between text-sm md:hover:bg-white/10 md:hover:text-white md:hover:border-white/50 [&_svg]:text-white md:hover:[&_svg]:text-white"
                  >
                    <span className="truncate text-left flex-1 px-1">
                      {categoryOptions.find(o => o.value === category)?.label || 'Välj kategori'}
                    </span>
                    <ChevronDown className="h-4 w-4 flex-shrink-0 opacity-50 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-80 bg-slate-900/85 backdrop-blur-xl border border-white/20 shadow-lg z-50 rounded-md text-white"
                  side="bottom"
                  align="center"
                  alignOffset={0}
                  sideOffset={8}
                  avoidCollisions={false}
                  onCloseAutoFocus={(e) => e.preventDefault()}
                >
                  <div className="p-2">
                    {categoryOptions.map((opt) => {
                      const isSelected = category === opt.value;
                      return (
                        <DropdownMenuItem
                          key={opt.value}
                          onClick={() => setCategory(opt.value)}
                          className="cursor-pointer hover:bg-white/10 focus:bg-white/10 py-2 px-3 text-white flex items-center justify-between rounded-md transition-colors"
                        >
                          <span className="text-sm">{opt.label}</span>
                          {isSelected && <Check className="h-4 w-4 text-green-400" />}
                        </DropdownMenuItem>
                      );
                    })}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="message" className="text-sm text-white">Meddelande</Label>
            <Textarea
                id="message"
                placeholder="Beskriv ditt problem eller din fråga detaljerat..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                required
                className="bg-white/5 border-white/10 hover:border-white/50 text-white placeholder:text-white resize-none text-sm"
              />
            </div>

            <div className="flex justify-center">
              <Button 
                type="submit" 
                variant="glass"
                className={`h-9 px-6 text-sm ${!isOnline ? 'bg-gray-500/50 cursor-not-allowed' : ''}`}
                disabled={loading || !isOnline}
              >
                {loading ? 'Skickar...' : !isOnline ? (
                  <>
                    <WifiOff className="mr-2 h-4 w-4" />
                    Offline
                  </>
                ) : 'Skicka meddelande'}
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* Existing Tickets */}
      <div className="bg-white/5 border border-white/10 rounded-lg">
        <div className="px-6 py-4 border-b border-white/10">
          <h3 className="text-lg font-semibold text-white">Dina supportärenden</h3>
          <p className="text-sm text-white">Översikt över dina tidigare och pågående supportärenden</p>
        </div>
        <div className="p-6">
          {ticketsLoading ? (
            <div className="text-center text-white py-8 text-sm">
              Laddar ärenden...
            </div>
          ) : tickets.length === 0 ? (
            <div className="text-center text-white py-8 text-sm">
              Inga supportärenden ännu
            </div>
          ) : (
            <div className="space-y-3">
              {tickets.map((ticket) => (
                <div key={ticket.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 border border-white/10 rounded-lg bg-white/5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex-shrink-0">
                      {getStatusIcon(ticket.status)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-white text-sm truncate">{ticket.subject}</p>
                      <p className="text-sm text-white">
                        Ärende {ticket.id.slice(0, 8)} • Skapad {new Date(ticket.created_at).toLocaleDateString('sv-SE')}
                      </p>
                    </div>
                  </div>
                  <Badge className={`${getStatusColor(ticket.status)} border-white/20 text-sm self-start sm:self-center flex-shrink-0`}>
                    {getStatusLabel(ticket.status)}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Support;
