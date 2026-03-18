import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/hooks/useAuth';
import { useState, useEffect } from 'react';
import { toast } from '@/hooks/use-toast';
import TeamManagement from '@/components/TeamManagement';
import { Capacitor } from '@capacitor/core';
import { MapPin, Smartphone, Bell, Mail } from 'lucide-react';
import { MessageTemplatesSettings } from '@/components/MessageTemplatesSettings';
import { useNotificationPreferences } from '@/hooks/useNotificationPreferences';
import { ActiveSessionsSettings } from '@/components/ActiveSessionsSettings';

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

      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-6 md:p-4">
        <div className="space-y-5 md:space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-sm text-white">E-postadress</Label>
            <Input 
              id="email"
              value={user?.email || ''} 
              disabled 
              className="bg-white/5 border-white/10 text-white h-11 !min-h-0 text-sm cursor-not-allowed"
            />
          </div>
        </div>
      </div>

      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-6 md:p-4">
        <div className="space-y-5 md:space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="current-password" className="text-sm text-white">Nuvarande lösenord</Label>
            <Input
              id="current-password"
              type="password"
              value={passwordData.currentPassword}
              onChange={(e) => setPasswordData({...passwordData, currentPassword: e.target.value})}
              className="bg-white/5 border-white/10 text-white placeholder:text-white h-11 !min-h-0 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-password" className="text-sm text-white">Nytt lösenord</Label>
            <Input
              id="new-password"
              type="password"
              value={passwordData.newPassword}
              onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})}
              className="bg-white/5 border-white/10 text-white placeholder:text-white h-11 !min-h-0 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-password" className="text-sm text-white">Bekräfta nytt lösenord</Label>
            <Input
              id="confirm-password"
              type="password"
              value={passwordData.confirmPassword}
              onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})}
              className="bg-white/5 border-white/10 text-white placeholder:text-white h-11 !min-h-0 text-sm"
            />
          </div>
          <div className="flex justify-center pt-1">
            <Button onClick={handlePasswordUpdate} variant="glass" className="h-9 px-6 text-sm">
              Uppdatera lösenord
            </Button>
          </div>
        </div>
      </div>

      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-6 md:p-4">
        <div className="space-y-5 md:space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <Bell className="h-4 w-4 text-white" />
            <h3 className="text-sm font-medium text-white">Aviseringar</h3>
          </div>

          {/* Column headers */}
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

          {[
            { type: 'new_application' as const, label: 'Nya ansökningar', desc: 'När någon söker dina jobb' },
            { type: 'new_message' as const, label: 'Meddelanden', desc: 'När du får nya meddelanden' },
            { type: 'interview_scheduled' as const, label: 'Intervjupåminnelser', desc: 'Påminnelser om bokade intervjuer' },
          ].map(({ type, label, desc }) => (
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
      </div>

      {/* Background Location Settings - Only show on native apps or always show for awareness */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-6 md:p-4">
        <div className="space-y-5 md:space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="h-4 w-4 text-white" />
            <h3 className="text-sm font-medium text-white">Platsinställningar</h3>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <Label className="text-sm text-white">Bakgrundsplats för väder</Label>
              <p className="text-sm text-white/70">
                {isNativeApp 
                  ? "Uppdatera vädret automatiskt även när appen är i bakgrunden"
                  : "Aktiveras endast i native-appen (iOS/Android)"
                }
              </p>
              {!isNativeApp && (
                <div className="flex items-center gap-1.5 mt-1.5 text-xs text-white/50">
                  <Smartphone className="h-3 w-3" />
                  <span>Tillgänglig i mobilappen</span>
                </div>
              )}
            </div>
            <Switch
              checked={backgroundLocationEnabled}
              onCheckedChange={handleBackgroundLocationToggle}
              disabled={savingBackgroundLocation || !isNativeApp}
            />
          </div>
        </div>
      </div>

      {/* Message Templates */}
      <MessageTemplatesSettings />

      {/* Active Sessions */}
      <ActiveSessionsSettings />

      {/* Team Management - Only visible for admins */}
      <TeamManagement />

    </div>
  );
};

export default EmployerSettings;