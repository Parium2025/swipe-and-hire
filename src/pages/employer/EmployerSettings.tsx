import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/hooks/useAuth';
import { useState, useEffect } from 'react';
import { toast } from '@/hooks/use-toast';
import TeamManagement from '@/components/TeamManagement';
import { Capacitor } from '@capacitor/core';
import { MapPin, Smartphone, WifiOff, Bug } from 'lucide-react';
import { useForceOffline } from '@/hooks/useOnlineStatus';

const EmployerSettings = () => {
  const { user, profile, updateProfile, updatePassword } = useAuth();
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [notifications, setNotifications] = useState({
    emailNotifications: true,
    newApplications: true,
    messagesFromCandidates: true,
    weeklyReports: false
  });
  const [backgroundLocationEnabled, setBackgroundLocationEnabled] = useState(false);
  const [savingBackgroundLocation, setSavingBackgroundLocation] = useState(false);
  const isNativeApp = Capacitor.isNativePlatform();
  const { isForced: isOfflineForced, toggle: toggleOfflineMode } = useForceOffline();

  // Visa dev tools endast för specifikt testkonto
  const isDevAccount = user?.email?.toLowerCase().includes('parium') || 
                       user?.email?.toLowerCase().includes('@hp.com') ||
                       profile?.company_name?.toLowerCase().includes('parium');

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
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
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
              className="bg-white/5 border-white/10 text-white h-9 text-sm cursor-not-allowed"
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
              className="bg-white/5 border-white/10 text-white placeholder:text-white h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-password" className="text-sm text-white">Nytt lösenord</Label>
            <Input
              id="new-password"
              type="password"
              value={passwordData.newPassword}
              onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})}
              className="bg-white/5 border-white/10 text-white placeholder:text-white h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-password" className="text-sm text-white">Bekräfta nytt lösenord</Label>
            <Input
              id="confirm-password"
              type="password"
              value={passwordData.confirmPassword}
              onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})}
              className="bg-white/5 border-white/10 text-white placeholder:text-white h-9 text-sm"
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
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm text-white">E-postaviseringar</Label>
              <p className="text-sm text-white">Få aviseringar via e-post</p>
            </div>
            <Switch
              checked={notifications.emailNotifications}
              onCheckedChange={(checked) => setNotifications({...notifications, emailNotifications: checked})}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm text-white">Nya ansökningar</Label>
              <p className="text-sm text-white">När någon söker dina jobb</p>
            </div>
            <Switch
              checked={notifications.newApplications}
              onCheckedChange={(checked) => setNotifications({...notifications, newApplications: checked})}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm text-white">Meddelanden från kandidater</Label>
              <p className="text-sm text-white">När kandidater skickar meddelanden</p>
            </div>
            <Switch
              checked={notifications.messagesFromCandidates}
              onCheckedChange={(checked) => setNotifications({...notifications, messagesFromCandidates: checked})}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm text-white">Veckorapporter</Label>
              <p className="text-sm text-white">Få veckovisa statistikrapporter</p>
            </div>
            <Switch
              checked={notifications.weeklyReports}
              onCheckedChange={(checked) => setNotifications({...notifications, weeklyReports: checked})}
            />
          </div>
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

      {/* Team Management - Only visible for admins */}
      <TeamManagement />

      {/* Developer Tools - Only for specific test account */}
      {isDevAccount && (
        <div className="bg-amber-500/10 backdrop-blur-sm border border-amber-500/30 rounded-lg p-6 md:p-4">
          <div className="space-y-5 md:space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <Bug className="h-4 w-4 text-amber-400" />
              <h3 className="text-sm font-medium text-amber-300">Developer Tools</h3>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <Label className="text-sm text-white flex items-center gap-2">
                  <WifiOff className="h-4 w-4 text-amber-400" />
                  Offline Mode
                </Label>
                <p className="text-sm text-white/70">
                  Simulera offline-läge för att testa hur appen beter sig utan internet
                </p>
              </div>
              <Switch
                checked={isOfflineForced}
                onCheckedChange={(checked) => {
                  toggleOfflineMode(checked);
                  toast({
                    title: checked ? "Offline-läge aktiverat" : "Offline-läge inaktiverat",
                    description: checked 
                      ? "Appen beter sig nu som om den är offline" 
                      : "Normal anslutning återställd"
                  });
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployerSettings;