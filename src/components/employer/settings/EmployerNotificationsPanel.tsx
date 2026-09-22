import SettingsPanel from './SettingsPanel';
import NotificationPreferencesPanel, {
  type NotificationRow,
} from '@/components/notifications/NotificationPreferencesPanel';
import type { NotificationType, NotificationChannel } from '@/hooks/useNotificationPreferences';

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
}: EmployerNotificationsPanelProps) => (
  <SettingsPanel>
    <NotificationPreferencesPanel
      rows={EMPLOYER_ROWS}
      isEnabled={isEnabled}
      toggle={toggle}
      disabled={prefsLoading}
      intro={
        <>
          <span className="font-medium">I appen</span> är notisklockan i menyn,{' '}
          <span className="font-medium">Push</span> är skärmnotisen i mobilen och{' '}
          <span className="font-medium">Mejl</span> går till din e-post. Inställningarna gäller bara
          dig — dina kollegor styr sina egna.
        </>
      }
    />
  </SettingsPanel>
);

export default EmployerNotificationsPanel;
