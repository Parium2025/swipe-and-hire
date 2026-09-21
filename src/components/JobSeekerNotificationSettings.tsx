import { useState } from 'react';
import { Loader2, Mail, MailX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { useNotificationPreferences } from '@/hooks/useNotificationPreferences';
import { useEmailSubscription } from '@/hooks/useEmailSubscription';
import NotificationPreferencesPanel, {
  type NotificationRow,
} from '@/components/notifications/NotificationPreferencesPanel';

const JOBSEEKER_ROWS: NotificationRow[] = [
  {
    type: 'application_status',
    label: 'Dina ansökningar',
    description: 'Bekräftelse när du söker ett jobb och besked från arbetsgivaren.',
    channels: ['in_app', 'push', 'email'],
  },
  {
    type: 'interview_scheduled',
    label: 'Intervjuer',
    description:
      'Kallelse, ombokning, avbokning och påminnelsen strax före intervjun. Du väljer själv om de även ska komma som push och mejl — i appen ligger de alltid kvar.',
    channels: ['in_app', 'push', 'email'],
    locked: ['in_app'],
  },
  {
    type: 'new_message',
    label: 'Meddelanden',
    description:
      'Nya chattmeddelanden. Meddelandet hamnar alltid i inkorgen — mejl skickas bara som en samlad påminnelse om olästa meddelanden, som mest ett mejl per dag.',
    channels: ['in_app', 'push', 'email'],
  },
  {
    type: 'saved_search_match',
    label: 'Nya jobb i dina sökningar',
    description: 'När nya jobb stämmer med dina sparade sökningar.',
    channels: ['in_app', 'push'],
  },
  {
    type: 'saved_job_expiring',
    label: 'Sparade jobb går ut',
    description: 'När ett sparat jobb du inte sökt snart går ut.',
    channels: ['in_app', 'push'],
  },
  {
    type: 'job_closed',
    label: 'Avslutade annonser',
    description: 'När en annons du sökt stängs eller utgår.',
    channels: ['in_app', 'push', 'email'],
  },
];

export const JobSeekerNotificationSettings = () => {
  const { isEnabled, toggle, isLoading } = useNotificationPreferences();
  const { subscribed, isKnown, setSubscribed } = useEmailSubscription();
  const [updatingSubscription, setUpdatingSubscription] = useState(false);

  const emailBlocked = isKnown && !subscribed;

  const handleResubscribe = async () => {
    setUpdatingSubscription(true);
    try {
      await setSubscribed(true);
      // Slå automatiskt på mejl igen för de händelser som har mejl som förval.
      for (const row of JOBSEEKER_ROWS) {
        if (!row.channels.includes('email')) continue;
        if (row.type === 'new_message') continue; // kräver aktivt val
        if (!isEnabled(row.type, 'email')) toggle(row.type, true, 'email');
      }
      toast({
        title: 'Mejlutskick aktiverade',
        description: 'Du får app-mejl igen enligt dina inställningar nedan.',
      });
    } catch {
      toast({
        title: 'Kunde inte aktivera mejlutskick',
        description: 'Försök igen om en stund.',
        variant: 'destructive',
      });
    } finally {
      setUpdatingSubscription(false);
    }
  };

  return (
    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-4">
      <NotificationPreferencesPanel
        rows={JOBSEEKER_ROWS}
        isEnabled={isEnabled}
        toggle={toggle}
        disabled={isLoading}
        emailBlocked={emailBlocked}
        intro={
          <>
            <span className="font-medium">I appen</span> är notisklockan i menyn,{' '}
            <span className="font-medium">Push</span> är skärmnotisen i mobilen och{' '}
            <span className="font-medium">Mejl</span> går till din e-post. Chattmeddelanden hamnar
            alltid i din inkorg — reglagen styr bara om de puffar. Du kan tysta en enskild
            konversation direkt i chatten.
          </>
        }
        banner={
          emailBlocked ? (
            <div className="rounded-lg border border-amber-400/40 bg-amber-400/10 p-4 md:p-3">
              <div className="flex flex-col items-center text-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-400/15">
                  <MailX className="h-4 w-4 text-amber-300" />
                </div>
                <div className="min-w-0 space-y-2">
                  <p className="text-sm font-medium text-white">Du har avregistrerat dig från mejl</p>
                  <p className="text-sm text-white">
                    Dina mejlval nedan är sparade, men inga app-mejl skickas till din adress förrän du
                    aktiverar dem igen. Inloggnings- och lösenordsmejl påverkas inte.
                  </p>
                </div>
                <Button
                  variant="glass"
                  onClick={(e) => { e.currentTarget.blur(); handleResubscribe(); }}
                  disabled={updatingSubscription}
                  className="mt-1 h-10 rounded-full px-5 text-sm text-white transition-none hover:bg-white/10 hover:text-white active:scale-100 focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
                >
                  {updatingSubscription ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Mail className="h-4 w-4 mr-2" />
                  )}
                  {updatingSubscription ? 'Aktiverar…' : 'Aktivera mejlutskick igen'}
                </Button>
              </div>
            </div>
          ) : null
        }
      />
    </div>
  );
};
