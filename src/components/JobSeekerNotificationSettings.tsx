import { useState } from 'react';
import { Bell, Mail, MailX, Smartphone } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { useNotificationPreferences, NotificationType } from '@/hooks/useNotificationPreferences';
import { useEmailSubscription } from '@/hooks/useEmailSubscription';

const JOBSEEKER_NOTIFICATION_TYPES: { type: NotificationType; label: string; description: string; hasEmail?: boolean }[] = [
  { type: 'application_status', label: 'Ansökningar', description: 'Bekräftelse när du söker ett jobb', hasEmail: true },
  { type: 'interview_scheduled', label: 'Intervjuinbjudningar', description: 'När du blir inbjuden till intervju' },
  { type: 'new_message', label: 'Meddelanden', description: 'När du får nya meddelanden' },
  { type: 'saved_search_match', label: 'Nya jobb i dina sökningar', description: 'När nya jobb stämmer med dina sparade sökningar' },
  { type: 'saved_job_expiring', label: 'Sparade jobb utgår', description: 'När ett sparat jobb snart går ut' },
  { type: 'job_closed', label: 'Avslutade annonser', description: 'När en annons du sökt stängs eller utgår', hasEmail: true },
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
      <div className="space-y-4 md:space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <Bell className="h-4 w-4 text-white" />
          <h3 className="text-sm font-medium text-white">Aviseringar</h3>
        </div>

        <p className="text-sm text-white">
          <span className="font-medium">I appen</span> är notisklockan i menyn, <span className="font-medium">Push</span> är
          skärmnotisen i mobilappen och <span className="font-medium">Mejl</span> går till din e-post. Chattmeddelanden från
          arbetsgivare hamnar alltid i din inkorg — men de puffar bara om du har notiser påslagna. Du kan tysta eller radera
          en enskild konversation direkt i chatten.
        </p>

        {emailBlocked && (
          <div className="rounded-lg border border-amber-400/40 bg-amber-400/10 p-4 md:p-3">
            <div className="flex flex-col items-center text-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-400/15">
                <MailX className="h-4 w-4 text-amber-300" />
              </div>
              <div className="min-w-0 space-y-2">
                <p className="text-sm font-medium text-white">Du har avregistrerat dig från mejl</p>
                <p className="text-sm text-white">
                  Dina mejlval nedan är sparade, men inga app-mejl skickas till din adress förrän du aktiverar dem igen.
                  Inloggnings- och lösenordsmejl påverkas inte.
                </p>
              </div>
              <Button
                variant="glass"
                size="sm"
                onClick={handleResubscribe}
                disabled={updatingSubscription}
                className="mt-1"
              >
                {updatingSubscription ? 'Aktiverar…' : 'Aktivera mejlutskick igen'}
              </Button>
            </div>
          </div>
        )}


        {/* Column headers */}
        <div className="flex items-center justify-end gap-2 md:gap-4 pb-1 border-b border-white/10">
          <div className="flex w-11 md:w-14 items-center justify-center gap-1 text-xs text-white whitespace-nowrap">
            <Bell className="h-3 w-3 shrink-0" />
            <span>I appen</span>
          </div>
          <div className="flex w-11 md:w-14 items-center justify-center gap-1 text-xs text-white whitespace-nowrap">
            <Smartphone className="h-3 w-3 shrink-0" />
            <span>Push</span>
          </div>
          <div className="flex w-11 md:w-14 items-center justify-center gap-1 text-xs text-white whitespace-nowrap">
            <Mail className="h-3 w-3 shrink-0" />
            <span>Mejl</span>
          </div>
        </div>

        {JOBSEEKER_NOTIFICATION_TYPES.map(({ type, label, description, hasEmail }) => (
          <div key={type} className="flex items-center justify-between gap-2 md:gap-3">
            <div className="flex-1 min-w-0">
              <Label className="text-sm font-medium leading-snug text-white">{label}</Label>
              <p className="text-[13px] md:text-sm leading-snug text-white">{description}</p>
            </div>
            <div className="flex items-center gap-2 md:gap-4 shrink-0">
              <div className="flex w-11 md:w-14 justify-center">
                <Switch
                  checked={isEnabled(type, 'in_app')}
                  onCheckedChange={(checked) => toggle(type, checked, 'in_app')}
                  disabled={isLoading}
                  aria-label={`I appen: ${label}`}
                />
              </div>
              <div className="flex w-11 md:w-14 justify-center">
                <Switch
                  checked={isEnabled(type, 'push')}
                  onCheckedChange={(checked) => toggle(type, checked, 'push')}
                  disabled={isLoading}
                  aria-label={`Push: ${label}`}
                />
              </div>
              <div className="flex w-11 md:w-14 justify-center">
                {hasEmail && (
                  <Switch
                    checked={!emailBlocked && isEnabled(type, 'email')}
                    onCheckedChange={(checked) => {
                      if (emailBlocked) return;
                      toggle(type, checked, 'email');
                    }}
                    disabled={isLoading || emailBlocked}
                    aria-label={`Mejl: ${label}`}
                  />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
