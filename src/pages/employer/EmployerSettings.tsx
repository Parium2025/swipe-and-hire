import { useAuth } from '@/hooks/useAuth';
import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import TeamManagement from '@/components/TeamManagement';
import { Capacitor } from '@capacitor/core';
import { AutoMessagesPanel } from '@/components/employer/outreach/AutoMessagesPanel';
import { MessageTemplatesSettings } from '@/components/MessageTemplatesSettings';
import { useNotificationPreferences } from '@/hooks/useNotificationPreferences';
import { ActiveSessionsSettings } from '@/components/ActiveSessionsSettings';
import { PrivacyDataPanel } from '@/components/PrivacyDataPanel';
import CalendarConnectionCard from '@/components/settings/CalendarConnectionCard';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { Switch } from '@/components/ui/switch';


import EmployerAccountEmailPanel from '@/components/employer/settings/EmployerAccountEmailPanel';
import EmployerPasswordPanel from '@/components/employer/settings/EmployerPasswordPanel';
import EmployerNotificationsPanel from '@/components/employer/settings/EmployerNotificationsPanel';
import EmployerLocationPanel from '@/components/employer/settings/EmployerLocationPanel';
import { prewarmEmployerSettings } from '@/lib/settingsPrewarm';
import { EmployerSettingsSkeleton } from '@/components/employer/EmployerPageSkeleton';

// Kommer man tillbaka från t.ex. integritetspolicyn ska den sektion man
// hade öppen fortfarande vara öppen — vi sparar valet per session.
// Sparas bara vid användarens eget klick, inte vid kod-styrd nollställning.
const OPEN_SECTION_KEY = 'employer-settings-open-section';

const readSavedSection = (): string => {
  try {
    return sessionStorage.getItem(OPEN_SECTION_KEY) ?? '';
  } catch {
    return '';
  }
};

const EmployerSettings = () => {
  const { user, profile, updateProfile, updatePassword, loading: authLoading } = useAuth();
  const location = useLocation();
  const notificationSettingsRef = useRef<HTMLDivElement>(null);
  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: ''
  });
  const { isEnabled, toggle, isLoading: prefsLoading } = useNotificationPreferences();
  const [backgroundLocationEnabled, setBackgroundLocationEnabled] = useState(false);
  const [savingBackgroundLocation, setSavingBackgroundLocation] = useState(false);
  const isNativeApp = Capacitor.isNativePlatform();
  // Startvärdet läses direkt från sessionen: monteras sidan om helt (t.ex.
  // efter ett besök på integritetspolicyn) ska sektionen fortfarande vara öppen.
  const [openSection, setOpenSection] = useState<string>(readSavedSection);
  // Dragspelet monteras om när sidan lämnas. Sidan ligger kvar i minnet
  // (KeepAlive), så utan detta ligger en öppen sektion kvar och "blixtrar"
  // fram när man kommer tillbaka. Nyckelbytet sker medan vyn är dold, före
  // paint, så återkomsten alltid är ett rent, hopfällt läge utan animation.
  const [accordionKey, setAccordionKey] = useState(0);
  const wasAwayRef = useRef(false);
  const handleSectionChange = (value: string) => {
    setOpenSection(value);
    try {
      if (value) sessionStorage.setItem(OPEN_SECTION_KEY, value);
      else sessionStorage.removeItem(OPEN_SECTION_KEY);
    } catch { /* privat läge m.m. — ignoreras */ }
  };

  // Förvärm panelernas data direkt när sidan öppnas, medan dragspelen är stängda.
  // Då finns team, regler och mallar redan i cache när användaren fäller ut dem.
  useEffect(() => {
    prewarmEmployerSettings(user?.id);
  }, [user?.id]);

  useLayoutEffect(() => {
    if (location.pathname !== '/settings') {
      wasAwayRef.current = true;
      setOpenSection('');
      setAccordionKey((key) => key + 1);
      return;
    }

    if (location.hash === '#notifications') {
      wasAwayRef.current = false;
      setOpenSection('notifications');
      const frame = requestAnimationFrame(() => {
        notificationSettingsRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      });
      return () => cancelAnimationFrame(frame);
    }

    if (wasAwayRef.current) {
      wasAwayRef.current = false;
      // Återställ senast öppnade sektion. Nyckelbytet monterar om dragspelen
      // med värdet direkt, så återkomsten sker utan "blixt"-animation.
      let saved = '';
      try {
        saved = sessionStorage.getItem(OPEN_SECTION_KEY) ?? '';
      } catch { /* ignoreras */ }
      if (saved) {
        setAccordionKey((key) => key + 1);
        setOpenSection(saved);
      }
    }
  }, [location.pathname, location.hash]);


  // Load background location preference from profile
  useEffect(() => {
    if (profile) {
      setBackgroundLocationEnabled((profile as any)?.background_location_enabled ?? false);
    }
  }, [profile]);

  const handleBackgroundLocationToggle = async (enabled: boolean) => {
    setBackgroundLocationEnabled(enabled);
    setSavingBackgroundLocation(true);
    
    try {
      await updateProfile({ background_location_enabled: enabled } as any);
      toast({
        title: enabled ? "Bakgrundsplats aktiverad" : "Bakgrundsplats inaktiverad",
        description: enabled 
          ? "Vädret uppdateras automatiskt även när appen är i bakgrunden" 
          : "Vädret uppdateras endast när appen är aktiv"
      });
    } catch (error) {
      // Revert on error
      setBackgroundLocationEnabled(!enabled);
      toast({
        title: "Fel",
        description: "Kunde inte spara inställningen.",
        variant: "destructive"
      });
    } finally {
      setSavingBackgroundLocation(false);
    }
  };

  const handlePasswordUpdate = async () => {
    if (passwordData.newPassword.length < 7) {
      toast({
        title: "Fel",
        description: "Lösenordet måste vara minst 7 tecken.",
        variant: "destructive"
      });
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({
        title: "Fel",
        description: "Lösenorden matchar inte.",
        variant: "destructive"
      });
      return;
    }

    try {
      // updatePassword kastar inte — den returnerar { error } och visar egen toast.
      const result = await updatePassword(passwordData.newPassword);
      if (result?.error) return;
      setPasswordData({ newPassword: '', confirmPassword: '' });
    } catch (error) {
      toast({
        title: "Fel",
        description: "Kunde inte uppdatera lösenordet.",
        variant: "destructive"
      });
    }
  };

  const sections: { value: string; label: string; content: React.ReactNode }[] = [
    {
      value: 'konto',
      label: 'Konto & säkerhet',
      content: (
        <div className="space-y-8">
          <EmployerAccountEmailPanel email={user?.email || ''} />
          <EmployerPasswordPanel
            passwordData={passwordData}
            setPasswordData={setPasswordData}
            onUpdatePassword={handlePasswordUpdate}
          />
          <ActiveSessionsSettings />
        </div>
      ),
    },
    {
      value: 'notifications',
      label: 'Aviseringar & plats',
      content: (
        <div className="space-y-8">
          <EmployerNotificationsPanel
            isEnabled={isEnabled}
            toggle={toggle}
            prefsLoading={prefsLoading}
          />
          <EmployerLocationPanel
            isNativeApp={isNativeApp}
            backgroundLocationEnabled={backgroundLocationEnabled}
            savingBackgroundLocation={savingBackgroundLocation}
            onToggle={handleBackgroundLocationToggle}
          />
        </div>
      ),
    },
    {
      value: 'automatiska-floden',
      label: 'Automatiska flöden',
      content: <AutoMessagesPanel />,
    },
    {
      value: 'manuella-besked',
      label: 'Mallar, regler & utskick',
      content: <MessageTemplatesSettings />,
    },
    {
      value: 'systemutskick',
      label: 'Systemutskick',
      content: (
        <div className="space-y-3">
          <p className="text-sm text-white">Tekniska meddelanden som Parium sköter utanför de sex redigerbara händelserna.</p>
          <ul className="space-y-2">
            <li className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white">Intervjukallelse med svarsknappar och kalenderlänk.</li>
            <li className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-white">Påminnelse efter 14 dagar</p>
                  <p className="text-xs text-white">En samlad daglig notis om kandidater som fortfarande väntar på besked. Kandidaten får inget automatiskt avslag.</p>
                </div>
                <Switch
                  checked={isEnabled('application_decision_reminder', 'in_app')}
                  onCheckedChange={(checked) => toggle('application_decision_reminder', checked, 'in_app')}
                  disabled={prefsLoading}
                  aria-label="Påminnelse efter 14 dagar"
                />
              </div>
            </li>
            <li className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white">Påminnelser om sparade jobb och jobb som snart går ut.</li>
            <li className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white">Konto-, säkerhets- och supportmeddelanden.</li>
          </ul>
        </div>
      ),
    },
    {
      value: 'kalender',
      label: 'Kalender',
      content: <CalendarConnectionCard />,
    },
    {
      value: 'integritet',
      label: 'Dina uppgifter & integritet',
      content: <PrivacyDataPanel showDpaLink isEmployer />,
    },
    {
      value: 'team',
      label: 'Teamet',
      content: <TeamManagement />,
    },
  ];

  if (authLoading && !profile) {
    return <EmployerSettingsSkeleton />;
  }

  return (
    <div className="space-y-4 responsive-container [padding-bottom:calc(env(safe-area-inset-bottom,0px)+50px)]">
      <div className="text-center mb-6">
        <h1 className="text-xl md:text-2xl font-semibold text-white tracking-tight">Inställningar</h1>
      </div>

      <Accordion
        key={accordionKey}
        type="single"
        collapsible
        value={openSection}
        onValueChange={handleSectionChange}
        className="space-y-4"
      >
        {sections.map((section) => (
          <AccordionItem
            key={section.value}
            value={section.value}
            id={section.value}
            ref={section.value === 'notifications' ? notificationSettingsRef : undefined}
            className="border-0 scroll-mt-6"
          >
            <AccordionTrigger className="rounded-lg border border-white/10 bg-white/5 backdrop-blur-sm px-6 md:px-4 py-4 text-sm font-medium text-white no-underline hover:no-underline hover:bg-white/10 transition-colors">
              {section.label}
            </AccordionTrigger>
            <AccordionContent className="pb-0 pt-4">
              {section.content}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
};


export default EmployerSettings;