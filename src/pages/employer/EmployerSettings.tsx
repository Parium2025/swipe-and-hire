import { useAuth } from '@/hooks/useAuth';
import { useState, useEffect } from 'react';
import { toast } from '@/hooks/use-toast';
import TeamManagement from '@/components/TeamManagement';
import { Capacitor } from '@capacitor/core';
import { MessageTemplatesSettings } from '@/components/MessageTemplatesSettings';
import { useNotificationPreferences } from '@/hooks/useNotificationPreferences';
import { ActiveSessionsSettings } from '@/components/ActiveSessionsSettings';
import EmployerAccountEmailPanel from '@/components/employer/settings/EmployerAccountEmailPanel';
import EmployerPasswordPanel from '@/components/employer/settings/EmployerPasswordPanel';
import EmployerNotificationsPanel from '@/components/employer/settings/EmployerNotificationsPanel';
import EmployerLocationPanel from '@/components/employer/settings/EmployerLocationPanel';

const EmployerSettings = () => {
  const { user, profile, updateProfile, updatePassword } = useAuth();
  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: ''
  });
  const { isEnabled, toggle, isLoading: prefsLoading } = useNotificationPreferences();
  const [backgroundLocationEnabled, setBackgroundLocationEnabled] = useState(false);
  const [savingBackgroundLocation, setSavingBackgroundLocation] = useState(false);
  const isNativeApp = Capacitor.isNativePlatform();

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

  return (
    <div className="space-y-8 responsive-container animate-fade-in">
      <div className="text-center mb-6">
        <h1 className="text-xl md:text-2xl font-semibold text-white tracking-tight">Inställningar</h1>
      </div>

      <EmployerAccountEmailPanel email={user?.email || ''} />

      <EmployerPasswordPanel
        passwordData={passwordData}
        setPasswordData={setPasswordData}
        onUpdatePassword={handlePasswordUpdate}
      />

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

      <MessageTemplatesSettings />
      <ActiveSessionsSettings />
      <TeamManagement />
    </div>
  );
};

export default EmployerSettings;