import { Bell, Mail, Smartphone } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useNotificationPreferences, NotificationType } from '@/hooks/useNotificationPreferences';

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

  return (
    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-6 md:p-4">
      <div className="space-y-5 md:space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <Bell className="h-4 w-4 text-white" />
          <h3 className="text-sm font-medium text-white">Aviseringar</h3>
        </div>

        {/* Column headers */}
        <div className="flex items-center justify-end gap-4 pb-1 border-b border-white/10">
          <div className="flex w-11 items-center justify-center gap-1 text-xs text-white">
            <Bell className="h-3 w-3" />
            <span>I appen</span>
          </div>
          <div className="flex w-11 items-center justify-center gap-1 text-xs text-white">
            <Smartphone className="h-3 w-3" />
            <span>Push</span>
          </div>
          <div className="flex w-11 items-center justify-center gap-1 text-xs text-white">
            <Mail className="h-3 w-3" />
            <span>Mejl</span>
          </div>
        </div>

        {JOBSEEKER_NOTIFICATION_TYPES.map(({ type, label, description, hasEmail }) => (
          <div key={type} className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <Label className="text-sm text-white">{label}</Label>
              <p className="text-sm text-white">{description}</p>
            </div>
            <div className="flex items-center gap-4 shrink-0">
              <div className="flex w-11 justify-center">
                <Switch
                  checked={isEnabled(type, 'in_app')}
                  onCheckedChange={(checked) => toggle(type, checked, 'in_app')}
                  disabled={isLoading}
                  aria-label={`I appen: ${label}`}
                />
              </div>
              <div className="flex w-11 justify-center">
                <Switch
                  checked={isEnabled(type, 'push')}
                  onCheckedChange={(checked) => toggle(type, checked, 'push')}
                  disabled={isLoading}
                  aria-label={`Push: ${label}`}
                />
              </div>
              <div className="flex w-11 justify-center">
                {hasEmail && (
                  <Switch
                    checked={isEnabled(type, 'email')}
                    onCheckedChange={(checked) => toggle(type, checked, 'email')}
                    disabled={isLoading}
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
