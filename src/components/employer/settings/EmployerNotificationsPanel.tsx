import { useState } from 'react';
import { Loader2, Mail, MailX } from 'lucide-react';
import SettingsPanel from './SettingsPanel';
import NotificationPreferencesPanel, {
  type NotificationRow,
} from '@/components/notifications/NotificationPreferencesPanel';
import type { NotificationType, NotificationChannel } from '@/hooks/useNotificationPreferences';
import { useEmailSubscription } from '@/hooks/useEmailSubscription';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';

interface EmployerNotificationsPanelProps {
  isEnabled: (type: NotificationType, channel: NotificationChannel) => boolean;
  toggle: (type: NotificationType, checked: boolean, channel: NotificationChannel) => void;
  prefsLoading: boolean;
}

const EMPLOYER_ROWS: NotificationRow[] = [
  {
    type: 'new_application',
    label: 'Nya ansökningar',
    description:
      'När någon söker dina jobb. Mejlet är alltid en samlad sammanfattning, aldrig ett mejl per ansökan. Det skickas bara när det finns nya ansökningar du inte öppnat — som mest ett mejl per dag.',
    channels: ['in_app', 'push', 'email'],
  },
  {
    type: 'new_message',
    label: 'Meddelanden',
    description:
      'Nya chattmeddelanden. Meddelandet hamnar alltid i inkorgen — mejl skickas bara som en samlad påminnelse om olästa meddelanden, som mest ett mejl per dag.',
    channels: ['in_app', 'push', 'email'],
  },
  {
    type: 'interview_scheduled',
    label: 'Intervjuer',
    description:
      'Bokningar, av- och ombokningar samt påminnelsen strax före intervjun. Alltid på — det här är tider i din kalender.',
    channels: ['in_app', 'push', 'email'],
    locked: ['in_app', 'push', 'email'],
  },
  {
    type: 'interview_response',
    label: 'Kandidatens svar',
    description:
      'Kandidaten tackar ja eller nej till kallelsen. I appen betyder att svaret också landar som ett meddelande från kandidaten i chatten.',
    channels: ['in_app', 'push', 'email'],
  },
];

const EmployerNotificationsPanel = ({
  isEnabled,
  toggle,
  prefsLoading,
}: EmployerNotificationsPanelProps) => {
  const { subscribed, isKnown, setSubscribed } = useEmailSubscription();
  const [updatingSubscription, setUpdatingSubscription] = useState(false);

  const emailBlocked = isKnown && !subscribed;

  const handleResubscribe = async () => {
    setUpdatingSubscription(true);
    try {
      await setSubscribed(true);
      // Slå på mejl igen för de rader som har mejl, så reglagen speglar läget direkt.
      for (const row of EMPLOYER_ROWS) {
        if (!row.channels.includes('email')) continue;
        if (row.locked?.includes('email')) continue;
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
    <SettingsPanel>
      <NotificationPreferencesPanel
        rows={EMPLOYER_ROWS}
        isEnabled={isEnabled}
        toggle={toggle}
        disabled={prefsLoading}
        emailBlocked={emailBlocked}
        intro={
          <>
            <span className="font-medium">I appen</span> är notisklockan i menyn,{' '}
            <span className="font-medium">Push</span> är skärmnotisen i mobilen och{' '}
            <span className="font-medium">Mejl</span> går till din e-post. Inställningarna gäller bara
            dig — dina kollegor styr sina egna.
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
    </SettingsPanel>
  );
};

export default EmployerNotificationsPanel;
