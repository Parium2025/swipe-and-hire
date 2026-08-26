import { useAuth } from '@/hooks/useAuth';
import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import TeamManagement from '@/components/TeamManagement';
import { Capacitor } from '@capacitor/core';
import { MessageTemplatesSettings } from '@/components/MessageTemplatesSettings';
import { AutoMessagesPanel } from '@/components/employer/outreach/AutoMessagesPanel';
import { useNotificationPreferences } from '@/hooks/useNotificationPreferences';
import { ActiveSessionsSettings } from '@/components/ActiveSessionsSettings';
import { PrivacyDataPanel } from '@/components/PrivacyDataPanel';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';


import EmployerAccountEmailPanel from '@/components/employer/settings/EmployerAccountEmailPanel';
import EmployerPasswordPanel from '@/components/employer/settings/EmployerPasswordPanel';
import EmployerNotificationsPanel from '@/components/employer/settings/EmployerNotificationsPanel';
import EmployerLocationPanel from '@/components/employer/settings/EmployerLocationPanel';
import { prewarmEmployerSettings } from '@/lib/settingsPrewarm';

const EmployerSettings = () => {
  const { user, profile, updateProfile, updatePassword } = useAuth();
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
  const [openSection, setOpenSection] = useState<string>('');

  // Förvärm panelernas data direkt när sidan öppnas, medan dragspelen är stängda.
  // Då finns team, regler och mallar redan i cache när användaren fäller ut dem.
  useEffect(() => {
    prewarmEmployerSettings(user?.id);
  }, [user?.id]);

  useEffect(() => {
    if (location.pathname !== '/settings') {
      setOpenSection('');
      return;
    }

    if (location.hash === '#notifications') {
      setOpenSection('notifications');
      const frame = requestAnimationFrame(() => {
        notificationSettingsRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      });
      return () => cancelAnimationFrame(frame);
    }

    setOpenSection('');
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
    if (passwordData.newPassword.length < 6) {
      toast({
        title: "Fel",
        description: "Lösenordet måste vara minst 6 tecken.",
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
      await updatePassword(passwordData.newPassword);
      setPasswordData({ newPassword: '', confirmPassword: '' });
      toast({
        title: "Lösenord uppdaterat",
        description: "Ditt lösenord har uppdaterats framgångsrikt."
      });
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
      value: 'utskick',
      label: 'Automatiska utskick & mallar',
      content: (
        <div className="space-y-8">
          <AutoMessagesPanel />
          <MessageTemplatesSettings />
        </div>
      ),
    },
    {
      value: 'integritet',
      label: 'Dina uppgifter & integritet',
      content: <PrivacyDataPanel showDpaLink />,
    },
    {
      value: 'team',
      label: 'Teamet',
      content: <TeamManagement />,
    },
  ];

  return (
    <div className="space-y-4 responsive-container [padding-bottom:calc(env(safe-area-inset-bottom,0px)+50px)]">
      <div className="text-center mb-6">
        <h1 className="text-xl md:text-2xl font-semibold text-white tracking-tight">Inställningar</h1>
      </div>

      <Accordion
        type="single"
        collapsible
        value={openSection}
        onValueChange={setOpenSection}
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
            <AccordionTrigger className="rounded-lg border border-white/10 bg-white/5 backdrop-blur-sm px-6 md:px-4 py-4 text-sm font-medium text-white no-underline hover:no-underline hover:bg-white/10 transition-colors data-[state=open]:rounded-b-none">
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