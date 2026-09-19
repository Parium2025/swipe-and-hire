import { ReactNode } from 'react';
import { Bell, Lock, Mail, Smartphone } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { NotificationType, NotificationChannel } from '@/hooks/useNotificationPreferences';

export interface NotificationRow {
  type: NotificationType;
  label: string;
  description: string;
  /** Kanaler som faktiskt skickas för händelsen. Övriga visas som "–". */
  channels: NotificationChannel[];
  /** Kanaler som alltid levereras och därför inte går att stänga av. */
  locked?: NotificationChannel[];
}

interface Props {
  title?: string;
  intro?: ReactNode;
  banner?: ReactNode;
  rows: NotificationRow[];
  isEnabled: (type: NotificationType, channel: NotificationChannel) => boolean;
  toggle: (type: NotificationType, enabled: boolean, channel: NotificationChannel) => void;
  disabled?: boolean;
  /** Mejl är helt blockerat (avregistrerad adress). */
  emailBlocked?: boolean;
}

const COLUMNS: { channel: NotificationChannel; label: string; icon: typeof Bell }[] = [
  { channel: 'in_app', label: 'I appen', icon: Bell },
  { channel: 'push', label: 'Push', icon: Smartphone },
  { channel: 'email', label: 'Mejl', icon: Mail },
];

const CELL = 'flex w-[52px] shrink-0 items-center justify-center sm:w-14';

const NotificationPreferencesPanel = ({
  title = 'Aviseringar',
  intro,
  banner,
  rows,
  isEnabled,
  toggle,
  disabled,
  emailBlocked,
}: Props) => {
  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-5">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-white" />
          <h3 className="text-sm font-medium text-white">{title}</h3>
        </div>

        {intro && <div className="text-sm leading-relaxed text-white">{intro}</div>}
        {banner}

        <div className="rounded-xl border border-white/10 bg-white/[0.03]">
          {/* Kolumnrubriker */}
          <div className="flex items-end justify-end gap-2 border-b border-white/10 px-3 py-2.5 sm:gap-3 sm:px-4">
            {COLUMNS.map(({ channel, label, icon: Icon }) => (
              <div
                key={channel}
                className={`${CELL} flex-col gap-1 text-[11px] leading-none text-white sm:text-xs`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="whitespace-nowrap">{label}</span>
              </div>
            ))}
          </div>

          <div className="divide-y divide-white/[0.07]">
            {rows.map((row) => (
              <div
                key={row.type}
                className="flex items-center justify-between gap-3 px-3 py-3.5 sm:gap-4 sm:px-4"
              >
                <div className="min-w-0 flex-1">
                  <Label className="block text-sm font-medium leading-snug text-white">
                    {row.label}
                  </Label>
                  <p className="mt-0.5 text-[13px] leading-snug text-white/95 sm:text-sm">
                    {row.description}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                  {COLUMNS.map(({ channel, label }) => {
                    const supported = row.channels.includes(channel);
                    const locked = row.locked?.includes(channel);

                    if (!supported) {
                      return (
                        <div key={channel} className={CELL}>
                          <span className="text-sm text-white/40" aria-hidden>
                            –
                          </span>
                          <span className="sr-only">{`${label}: skickas inte för ${row.label}`}</span>
                        </div>
                      );
                    }

                    if (locked) {
                      return (
                        <div key={channel} className={CELL}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white"
                                aria-label={`${label}: alltid på för ${row.label}`}
                              >
                                <Lock className="h-3.5 w-3.5" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[220px] text-center">
                              Alltid på — den här går inte att missa.
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      );
                    }

                    const blocked = channel === 'email' && emailBlocked;

                    return (
                      <div key={channel} className={CELL}>
                        <Switch
                          checked={!blocked && isEnabled(row.type, channel)}
                          onCheckedChange={(checked) => {
                            if (blocked) return;
                            toggle(row.type, checked, channel);
                          }}
                          disabled={disabled || blocked}
                          aria-label={`${label}: ${row.label}`}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
};

export default NotificationPreferencesPanel;
