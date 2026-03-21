import { Bell, Mail, Smartphone } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import SettingsPanel from './SettingsPanel';

type NotificationPreferenceType = 'new_application' | 'new_message' | 'interview_scheduled';

interface EmployerNotificationsPanelProps {
  isEnabled: (type: NotificationPreferenceType, channel: 'push' | 'email') => boolean;
  toggle: (type: NotificationPreferenceType, checked: boolean, channel: 'push' | 'email') => void;
  prefsLoading: boolean;
}

const notificationItems: { type: NotificationPreferenceType; label: string; desc: string }[] = [
  { type: 'new_application', label: 'Nya ansökningar', desc: 'När någon söker dina jobb' },
  { type: 'new_message', label: 'Meddelanden', desc: 'När du får nya meddelanden' },
  { type: 'interview_scheduled', label: 'Intervjupåminnelser', desc: 'Påminnelser om bokade intervjuer' },
];

const EmployerNotificationsPanel = ({ isEnabled, toggle, prefsLoading }: EmployerNotificationsPanelProps) => {
  return (
    <SettingsPanel>
      <div className="space-y-5 md:space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <Bell className="h-4 w-4 text-white" />
          <h3 className="text-sm font-medium text-white">Aviseringar</h3>
        </div>

        <div className="flex items-center justify-end gap-6 pr-1 pb-1 border-b border-white/10">
          <div className="flex items-center gap-1 text-xs text-white/50">
            <Smartphone className="h-3 w-3" />
            <span>Push</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-white/50">
            <Mail className="h-3 w-3" />
            <span>Mejl</span>
          </div>
        </div>

        {notificationItems.map(({ type, label, desc }) => (
          <div key={type} className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <Label className="text-sm text-white">{label}</Label>
              <p className="text-sm text-white/70">{desc}</p>
            </div>
            <div className="flex items-center gap-6 ml-3">
              <Switch
                checked={isEnabled(type, 'push')}
                onCheckedChange={(checked) => toggle(type, checked, 'push')}
                disabled={prefsLoading}
              />
              <Switch
                checked={isEnabled(type, 'email')}
                onCheckedChange={(checked) => toggle(type, checked, 'email')}
                disabled={prefsLoading}
              />
            </div>
          </div>
        ))}
      </div>
    </SettingsPanel>
  );
};

export default EmployerNotificationsPanel;