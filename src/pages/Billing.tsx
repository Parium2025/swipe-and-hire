import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  CreditCard,
  Calendar,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

type PurchaseRow = {
  id: string;
  price_sek: number | null;
  purchased_at: string | null;
  created_at: string;
  status: string | null;
  stripe_payment_intent_id: string | null;
};

type MonthGroup = {
  month: string;
  monthName: string;
  payments: {
    id: string;
    date: string;
    amount: number;
    currency: string;
    status: string;
    description: string;
    invoice: string | null;
  }[];
};

const Billing = () => {
  const { user } = useAuth();
  const [expandedMonths, setExpandedMonths] = useState<{ [key: string]: boolean }>({});

  // Riktiga köp från databasen. Betalningar är ännu inte aktiverade, så för de
  // allra flesta konton är listan tom — då visas ett korrekt tomt läge i stället
  // för påhittade kort och fakturor.
  const { data: purchases = [], isLoading } = useQuery({
    queryKey: ['billing-purchases', user?.id],
    enabled: !!user?.id,
    staleTime: 60_000,
    queryFn: async (): Promise<PurchaseRow[]> => {
      const { data, error } = await supabase
        .from('one_time_purchases')
        .select('id, price_sek, purchased_at, created_at, status, stripe_payment_intent_id')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as PurchaseRow[];
    },
  });

  const paymentHistory: MonthGroup[] = useMemo(() => {
    const groups = new Map<string, MonthGroup>();
    for (const p of purchases) {
      const iso = p.purchased_at ?? p.created_at;
      const d = new Date(iso);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!groups.has(key)) {
        groups.set(key, {
          month: key,
          monthName: d.toLocaleDateString('sv-SE', { year: 'numeric', month: 'long' }),
          payments: [],
        });
      }
      groups.get(key)!.payments.push({
        id: p.id,
        date: iso,
        amount: p.price_sek ?? 0,
        currency: 'SEK',
        status: p.status === 'active' || p.status === 'expired' ? 'paid' : (p.status ?? 'pending'),
        description: 'Köp av annonsplats',
        invoice: p.stripe_payment_intent_id,
      });
    }
    return Array.from(groups.values());
  }, [purchases]);

  const toggleMonth = (month: string) => {
    setExpandedMonths((prev) => ({ ...prev, [month]: !prev[month] }));
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'failed':
      case 'cancelled':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-white/50" />;
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
      case 'cancelled':
        return 'Avbruten';
      default:
        return 'Okänd';
    }
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

  const getTotalForMonth = (payments: MonthGroup['payments']) =>
    payments.reduce((sum, payment) => (payment.status === 'paid' ? sum + payment.amount : sum), 0);

  return (
    <div className="responsive-container-wide space-y-8 [padding-bottom:calc(env(safe-area-inset-bottom,0px)+50px)]">
      <div className="text-center mb-6">
        <h1 className="text-xl md:text-2xl font-semibold text-white tracking-tight">Betalningar</h1>
        <p className="text-sm text-white mt-1">
          Hantera dina betalningsmetoder och se din betalningshistorik.
        </p>
      </div>

      <div className="pb-6 space-y-6">
        {/* Betalningsmetod */}
        <div>
          <h2 className="text-base font-semibold text-white mb-3">Betalningsmetod</h2>
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 hover:border-white/50 rounded-lg p-6 md:p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-8 bg-white/10 rounded flex items-center justify-center flex-shrink-0">
                  <CreditCard className="h-4 w-4 text-white" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-white text-sm">Inget kort sparat</span>
                    <Badge variant="secondary" className="bg-white/20 text-white text-sm">
                      Kommer snart
                    </Badge>
                  </div>
                  <p className="text-sm text-white">
                    Betalningar aktiveras inom kort. Då kan du lägga till och byta kort här.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Betalningshistorik */}
        <div>
          <h2 className="text-base font-semibold text-white mb-3">Betalningshistorik</h2>

          {isLoading ? (
            <div className="space-y-2.5" aria-busy="true">
              {Array.from({ length: 2 }).map((_, i) => (
                <div
                  key={i}
                  className="h-[68px] rounded-lg border border-white/10 bg-white/5 animate-pulse"
                />
              ))}
            </div>
          ) : paymentHistory.length > 0 ? (
            <div className="space-y-2.5">
              {paymentHistory.map((monthData) => (
                <div
                  key={monthData.month}
                  className="bg-white/5 backdrop-blur-sm border border-white/10 hover:border-white/50 rounded-lg"
                >
                  <div
                    className="p-3 cursor-pointer hover:bg-white/5 hover:border-white/50 transition-colors rounded-lg"
                    onClick={() => toggleMonth(monthData.month)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Calendar className="h-4 w-4 text-white flex-shrink-0" />
                        <div className="min-w-0">
                          <h3 className="font-medium text-white text-sm truncate">
                            {monthData.monthName}
                          </h3>
                          <p className="text-sm text-white">
                            {monthData.payments.length} betalning
                            {monthData.payments.length !== 1 ? 'ar' : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="text-right">
                          <p className="font-semibold text-white text-sm">
                            {getTotalForMonth(monthData.payments)} kr
                          </p>
                          <p className="text-sm text-white">Totalt</p>
                        </div>
                        {expandedMonths[monthData.month] ? (
                          <ChevronUp className="h-4 w-4 text-white" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-white" />
                        )}
                      </div>
                    </div>
                  </div>

                  {expandedMonths[monthData.month] && (
                    <div className="border-t border-white/10">
                      {monthData.payments.map((payment, index) => (
                        <div key={payment.id}>
                          {index > 0 && <Separator className="bg-white/10" />}
                          <div className="p-3 hover:bg-white/5 hover:border-white/50 transition-colors">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div className="flex items-center gap-2.5 min-w-0">
                                {getStatusIcon(payment.status)}
                                <div className="min-w-0">
                                  <p className="font-medium text-white text-sm">
                                    {payment.description}
                                  </p>
                                  <p className="text-sm text-white">
                                    {formatDate(payment.date)} • {getStatusText(payment.status)}
                                  </p>
                                </div>
                              </div>
                              <div className="text-left sm:text-right">
                                <p className="font-semibold text-white text-sm">
                                  {payment.amount} {payment.currency}
                                </p>
                                {payment.invoice && (
                                  <p className="text-sm text-white">#{payment.invoice.slice(-8)}</p>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 hover:border-white/50 rounded-lg p-6 md:p-4 text-center">
              <CreditCard className="h-10 w-10 text-white mx-auto mb-4" />
              <h3 className="font-medium text-white mb-2 text-sm">Ingen betalningshistorik</h3>
              <p className="text-sm text-white">
                Du har inga betalningar att visa än. När du gör ditt första köp visas det här.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Billing;
