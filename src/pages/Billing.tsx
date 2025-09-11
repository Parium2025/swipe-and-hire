import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  CreditCard, 
  Calendar, 
  Download, 
  Eye, 
  ChevronDown, 
  ChevronUp,
  CheckCircle,
  Clock,
  AlertCircle,
  Plus
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const Billing = () => {
  const { profile, user } = useAuth();
  const [expandedMonths, setExpandedMonths] = useState<{[key: string]: boolean}>({});

  // Mock data - ersätt med riktig Stripe-data senare
  const paymentMethod = {
    type: 'Visa',
    last4: '4242',
    expiryMonth: '12',
    expiryYear: '2028',
    isDefault: true
  };

  const paymentHistory = [
    {
      month: '2024-12',
      monthName: 'December 2024',
      payments: [
        {
          id: '1',
          date: '2024-12-15',
          amount: 29,
          currency: 'SEK',
          status: 'paid',
          description: 'Premium Abonnemang',
          invoice: 'inv_123456'
        }
      ]
    },
    {
      month: '2024-11', 
      monthName: 'November 2024',
      payments: [
        {
          id: '2',
          date: '2024-11-15',
          amount: 29,
          currency: 'SEK',
          status: 'paid',
          description: 'Premium Abonnemang',
          invoice: 'inv_123455'
        }
      ]
    },
    {
      month: '2024-10',
      monthName: 'Oktober 2024', 
      payments: [
        {
          id: '3',
          date: '2024-10-15',
          amount: 29,
          currency: 'SEK',
          status: 'paid',
          description: 'Premium Abonnemang',
          invoice: 'inv_123454'
        }
      ]
    }
  ];

  const toggleMonth = (month: string) => {
    setExpandedMonths(prev => ({
      ...prev,
      [month]: !prev[month]
    }));
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'paid':
        return 'Betald';
      case 'pending':
        return 'Väntar';
      case 'failed':
        return 'Misslyckad';
      default:
        return 'Okänd';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getTotalForMonth = (payments: typeof paymentHistory[0]['payments']) => {
    return payments.reduce((sum, payment) => {
      return payment.status === 'paid' ? sum + payment.amount : sum;
    }, 0);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-white">Betalningar</h1>
        <p className="text-white">
          Hantera dina betalningsmetoder och se din betalningshistorik
        </p>
      </div>

      <div className="px-4 pb-6 space-y-6">
        
        {/* Nuvarande betalningsmetod */}
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">Betalningsmetod</h2>
          <Card className="bg-white/10 backdrop-blur-sm border-white/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded flex items-center justify-center">
                    <CreditCard className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white">
                        {paymentMethod.type} •••• {paymentMethod.last4}
                      </span>
                      {paymentMethod.isDefault && (
                        <Badge variant="secondary" className="bg-white/20 text-white text-xs">
                          Standard
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-white/70">
                      Upphör {paymentMethod.expiryMonth}/{paymentMethod.expiryYear}
                    </p>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="bg-white/10 border-white/30 text-white hover:bg-white/20"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Lägg till kort
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Betalningshistorik */}
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">Betalningshistorik</h2>
          
          <div className="space-y-3">
            {paymentHistory.map((monthData) => (
              <Card key={monthData.month} className="bg-white/10 backdrop-blur-sm border-white/20">
                <CardContent className="p-0">
                  
                  {/* Månadsrubrik - klickbar för att expandera */}
                  <div 
                    className="p-4 cursor-pointer hover:bg-white/5 transition-colors"
                    onClick={() => toggleMonth(monthData.month)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Calendar className="h-5 w-5 text-white" />
                        <div>
                          <h3 className="font-medium text-white">{monthData.monthName}</h3>
                          <p className="text-sm text-white/70">
                            {monthData.payments.length} betalning{monthData.payments.length !== 1 ? 'ar' : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="font-semibold text-white">
                            {getTotalForMonth(monthData.payments)} kr
                          </p>
                          <p className="text-xs text-white/70">Totalt</p>
                        </div>
                        {expandedMonths[monthData.month] ? (
                          <ChevronUp className="h-4 w-4 text-white/70" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-white/70" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Betalningar för månaden - expanderbart */}
                  {expandedMonths[monthData.month] && (
                    <div className="border-t border-white/20">
                      {monthData.payments.map((payment, index) => (
                        <div key={payment.id}>
                          {index > 0 && <Separator className="bg-white/10" />}
                          <div className="p-4 hover:bg-white/5 transition-colors">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                {getStatusIcon(payment.status)}
                                <div>
                                  <p className="font-medium text-white">{payment.description}</p>
                                  <p className="text-sm text-white/70">
                                    {formatDate(payment.date)} • {getStatusText(payment.status)}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="text-right">
                                  <p className="font-semibold text-white">
                                    {payment.amount} {payment.currency}
                                  </p>
                                  <p className="text-xs text-white/70">
                                    #{payment.invoice}
                                  </p>
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 text-white/70 hover:text-white hover:bg-white/10"
                                    title="Visa faktura"
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 text-white/70 hover:text-white hover:bg-white/10"
                                    title="Ladda ner faktura"
                                  >
                                    <Download className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {paymentHistory.length === 0 && (
            <Card className="bg-white/10 backdrop-blur-sm border-white/20">
              <CardContent className="p-8 text-center">
                <CreditCard className="h-12 w-12 text-white/50 mx-auto mb-4" />
                <h3 className="font-medium text-white mb-2">Ingen betalningshistorik</h3>
                <p className="text-sm text-white/70">
                  Du har inga betalningar att visa än. När du gör ditt första köp kommer det att visas här.
                </p>
              </CardContent>
            </Card>
          )}
        </div>

      </div>
    </div>
  );
};

export default Billing;