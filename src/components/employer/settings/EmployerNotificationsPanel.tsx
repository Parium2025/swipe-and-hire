import { Bell, Mail, Smartphone } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import SettingsPanel from './SettingsPanel';

type NotificationPreferenceType = 'new_application' | 'new_message' | 'interview_scheduled';
type Channel = 'push' | 'email' | 'in_app';

interface EmployerNotificationsPanelProps {
  isEnabled: (type: NotificationPreferenceType, channel: Channel) => boolean;
  toggle: (type: NotificationPreferenceType, checked: boolean, channel: Channel) => void;
  prefsLoading: boolean;
}

const notificationItems: { type: NotificationPreferenceType; label: string; desc: string; hasEmail?: boolean }[] = [
  { type: 'new_application', label: 'Nya ansökningar', desc: 'När någon söker dina jobb' },
  { type: 'new_message', label: 'Meddelanden', desc: 'När du får nya meddelanden' },
  { type: 'interview_scheduled', label: 'Intervjupåminnelser', desc: 'Påminnelser om bokade intervjuer', hasEmail: true },
];

const EmployerNotificationsPanel = ({ isEnabled, toggle, prefsLoading }: EmployerNotificationsPanelProps) => {
  return (
    <SettingsPanel>
      <div className="space-y-5 md:space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <Bell className="h-4 w-4 text-white" />
          <h3 className="text-sm font-medium text-white">Aviseringar</h3>
        </div>

        <div className="flex items-center justify-end gap-4 pb-1 border-b border-white/10">
          <div className="flex w-14 items-center justify-center gap-1 text-xs text-white whitespace-nowrap">
            <Bell className="h-3 w-3 shrink-0" />
            <span>I appen</span>
          </div>
          <div className="flex w-14 items-center justify-center gap-1 text-xs text-white whitespace-nowrap">
            <Smartphone className="h-3 w-3 shrink-0" />
            <span>Push</span>
          </div>
          <div className="flex w-14 items-center justify-center gap-1 text-xs text-white whitespace-nowrap">
            <Mail className="h-3 w-3 shrink-0" />
            <span>Mejl</span>
          </div>
        </div>

        {notificationItems.map(({ type, label, desc, hasEmail }) => (
          <div key={type} className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <Label className="text-sm text-white">{label}</Label>
              <p className="text-sm text-white">{desc}</p>
            </div>
            <div className="flex items-center gap-4 shrink-0">
              <div className="flex w-14 justify-center">
                <Switch
                  checked={isEnabled(type, 'in_app')}
                  onCheckedChange={(checked) => toggle(type, checked, 'in_app')}
                  disabled={prefsLoading}
                  aria-label={`I appen: ${label}`}
                />
              </div>
              <div className="flex w-14 justify-center">
                <Switch
                  checked={isEnabled(type, 'push')}
                  onCheckedChange={(checked) => toggle(type, checked, 'push')}
                  disabled={prefsLoading}
                  aria-label={`Push: ${label}`}
                />
              </div>
              <div className="flex w-14 justify-center">
                {hasEmail && (
                  <Switch
                    checked={isEnabled(type, 'email')}
                    onCheckedChange={(checked) => toggle(type, checked, 'email')}
                    disabled={prefsLoading}
                    aria-label={`Mejl: ${label}`}
                  />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </SettingsPanel>
  );
};

export default EmployerNotificationsPanel;
