import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { MessageCircle, Mail, Phone, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const Support = () => {
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      toast({
        title: "Meddelande skickat!",
        description: "Vi kommer att svara inom 24 timmar."
      });
      setSubject('');
      setCategory('');
      setMessage('');
      setLoading(false);
    }, 1000);
  };

  const tickets = [
    {
      id: 'T-001',
      subject: 'Problem med profiluppladdning',
      status: 'öppen',
      created: '2024-01-20',
      updated: '2024-01-21'
    },
    {
      id: 'T-002',
      subject: 'Fråga om fakturering',
      status: 'löst',
      created: '2024-01-15',
      updated: '2024-01-16'
    }
  ];

  const faqs = [
    {
      question: 'Hur ändrar jag min profilbild?',
      answer: 'Gå till Min Profil, klicka på kameraikon bredvid din nuvarande profilbild och välj en ny bild från din dator.'
    },
    {
      question: 'Hur fungerar abonnemangen?',
      answer: 'Vi erbjuder tre olika abonnemang: Basic (gratis), Premium (199 kr/månad) och Enterprise (999 kr/månad). Du kan ändra ditt abonnemang när som helst.'
    },
    {
      question: 'Kan jag avbryta mitt abonnemang?',
      answer: 'Ja, du kan avbryta ditt abonnemang när som helst. Avbrytningen träder i kraft vid nästa faktureringsperiod.'
    },
    {
      question: 'Hur kontaktar jag kundtjänst?',
      answer: 'Du kan kontakta oss via supportformuläret nedan, via e-post på support@parium.se eller telefon 08-123 456 78.'
    },
    {
      question: 'Vilka filformat stöds för CV-uppladdning?',
      answer: 'Vi stöder PDF, Word-dokument (.doc, .docx) och vissa bildformat. Maximal filstorlek är 5 MB.'
    }
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'öppen':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'löst':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'öppen':
        return 'bg-yellow-100 text-yellow-800';
      case 'löst':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4 md:space-y-6 overflow-x-hidden">
      <div className="text-center px-4">
        <h1 className="text-2xl md:text-3xl font-bold text-white">Kundtjänst</h1>
        <p className="text-white text-sm md:text-base">
          Vi hjälper dig gärna med dina frågor och problem
        </p>
      </div>

      <div className="px-4 pb-6 space-y-4 md:space-y-6 overflow-x-hidden">
        {/* Support Form */}
        <Card className="bg-white/10 backdrop-blur-sm border-white/20">
            <CardHeader className="pb-3 md:pb-6">
              <CardTitle className="text-white text-base md:text-lg">Skicka ett meddelande</CardTitle>
              <CardDescription className="text-white/70 text-sm">
                Beskriv ditt problem eller din fråga så detaljerat som möjligt
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="category" className="text-white text-sm">Kategori</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="bg-white/10 border-white/20 text-white h-11 md:h-10">
                      <SelectValue placeholder="Välj kategori" className="text-white/70" />
                    </SelectTrigger>
                    <SelectContent className="bg-white/95 backdrop-blur-sm border-white/20">
                      <SelectItem value="technical">Teknisk support</SelectItem>
                      <SelectItem value="billing">Fakturering</SelectItem>
                      <SelectItem value="account">Kontofrågor</SelectItem>
                      <SelectItem value="feature">Funktionsfrågor</SelectItem>
                      <SelectItem value="other">Övrigt</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subject" className="text-white text-sm">Ämne</Label>
                  <Input
                    id="subject"
                    placeholder="Kort beskrivning av ditt problem"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    required
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/50 h-11 md:h-10"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message" className="text-white text-sm">Meddelande</Label>
                  <Textarea
                    id="message"
                    placeholder="Beskriv ditt problem eller din fråga detaljerat..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={4}
                    required
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/50 resize-none"
                  />
                </div>

                <Button 
                  type="submit" 
                  className="w-full bg-primary hover:bg-primary/90 text-white h-11 md:h-10 font-medium" 
                  disabled={loading}
                >
                  {loading ? 'Skickar...' : 'Skicka meddelande'}
                </Button>
              </form>
            </CardContent>
          </Card>

        {/* Existing Tickets */}
        <Card className="bg-white/10 backdrop-blur-sm border-white/20">
          <CardHeader className="pb-3 md:pb-6">
            <CardTitle className="text-white text-base md:text-lg">Dina supportärenden</CardTitle>
            <CardDescription className="text-white/70 text-sm">
              Översikt över dina tidigare och pågående supportärenden
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-3">
              {tickets.map((ticket) => (
                <div key={ticket.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 border border-white/20 rounded-lg bg-white/5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex-shrink-0">
                      {getStatusIcon(ticket.status)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-white text-sm md:text-base truncate">{ticket.subject}</p>
                      <p className="text-xs md:text-sm text-white/70">
                        Ärende {ticket.id} • Skapad {ticket.created}
                      </p>
                    </div>
                  </div>
                  <Badge className={`${getStatusColor(ticket.status)} border-white/20 text-xs self-start sm:self-center flex-shrink-0`}>
                    {ticket.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* FAQ Section */}
        <Card className="bg-white/10 backdrop-blur-sm border-white/20">
          <CardHeader className="pb-3 md:pb-6">
            <CardTitle className="text-white text-base md:text-lg">Vanliga frågor</CardTitle>
            <CardDescription className="text-white/70 text-sm">
              Hitta snabba svar på de vanligaste frågorna
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((faq, index) => (
                <AccordionItem key={index} value={`item-${index}`} className="border-white/20">
                  <AccordionTrigger className="text-left text-white hover:text-white/80 text-sm md:text-base py-3 md:py-4">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-white/70 text-sm pb-3 md:pb-4">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Support;
