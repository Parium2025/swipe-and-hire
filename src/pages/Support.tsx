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
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="text-center px-4">
        <h1 className="text-2xl md:text-3xl font-bold text-white">Kundtjänst</h1>
        <p className="text-white text-sm md:text-base">
          Vi hjälper dig gärna med dina frågor och problem
        </p>
      </div>

      <div className="px-4 pb-6 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Contact Information */}
          <Card className="bg-white/10 backdrop-blur-sm border-white/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <MessageCircle className="h-5 w-5 text-white" />
                Kontakta oss
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-white/70" />
                <div>
                  <p className="text-sm font-medium text-white">E-post</p>
                  <p className="text-sm text-white/70">support@parium.se</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-white/70" />
                <div>
                  <p className="text-sm font-medium text-white">Telefon</p>
                  <p className="text-sm text-white/70">08-123 456 78</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-white/70" />
                <div>
                  <p className="text-sm font-medium text-white">Öppettider</p>
                  <p className="text-sm text-white/70">Mån-Fre 9:00-17:00</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Support Form */}
          <Card className="lg:col-span-2 bg-white/10 backdrop-blur-sm border-white/20">
            <CardHeader>
              <CardTitle className="text-white">Skicka ett meddelande</CardTitle>
              <CardDescription className="text-white/70">
                Beskriv ditt problem eller din fråga så detaljerat som möjligt
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="category" className="text-white">Kategori</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="bg-white/10 border-white/20 text-white">
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
                  <Label htmlFor="subject" className="text-white">Ämne</Label>
                  <Input
                    id="subject"
                    placeholder="Kort beskrivning av ditt problem"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    required
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message" className="text-white">Meddelande</Label>
                  <Textarea
                    id="message"
                    placeholder="Beskriv ditt problem eller din fråga detaljerat..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={6}
                    required
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                  />
                </div>

                <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-white" disabled={loading}>
                  {loading ? 'Skickar...' : 'Skicka meddelande'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Existing Tickets */}
        <Card className="bg-white/10 backdrop-blur-sm border-white/20">
          <CardHeader>
            <CardTitle className="text-white">Dina supportärenden</CardTitle>
            <CardDescription className="text-white/70">
              Översikt över dina tidigare och pågående supportärenden
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {tickets.map((ticket) => (
                <div key={ticket.id} className="flex items-center justify-between p-3 border border-white/20 rounded-lg bg-white/5">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(ticket.status)}
                    <div>
                      <p className="font-medium text-white">{ticket.subject}</p>
                      <p className="text-sm text-white/70">
                        Ärende {ticket.id} • Skapad {ticket.created}
                      </p>
                    </div>
                  </div>
                  <Badge className={`${getStatusColor(ticket.status)} border-white/20`}>
                    {ticket.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* FAQ Section */}
        <Card className="bg-white/10 backdrop-blur-sm border-white/20">
          <CardHeader>
            <CardTitle className="text-white">Vanliga frågor</CardTitle>
            <CardDescription className="text-white/70">
              Hitta snabba svar på de vanligaste frågorna
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((faq, index) => (
                <AccordionItem key={index} value={`item-${index}`} className="border-white/20">
                  <AccordionTrigger className="text-left text-white hover:text-white/80">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-white/70">
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
