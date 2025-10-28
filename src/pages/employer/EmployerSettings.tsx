import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/hooks/useAuth';
import { useState } from 'react';
import { toast } from '@/hooks/use-toast';

const EmployerSettings = () => {
  const { user, updatePassword } = useAuth();
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
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="text-center mb-6">
        <h1 className="text-xl md:text-2xl font-semibold text-white mb-1">Inställningar</h1>
      </div>

      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-6 md:p-4">
        <div className="space-y-5 md:space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-sm text-white">E-postadress</Label>
            <Input 
              id="email"
              value={user?.email || ''} 
              disabled 
              className="bg-white/5 border-white/10 text-white/70 h-9 text-sm cursor-not-allowed"
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
              className="bg-white/5 border-white/10 text-white placeholder:text-white/40 h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-password" className="text-sm text-white">Nytt lösenord</Label>
            <Input
              id="new-password"
              type="password"
              value={passwordData.newPassword}
              onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/40 h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-password" className="text-sm text-white">Bekräfta nytt lösenord</Label>
            <Input
              id="confirm-password"
              type="password"
              value={passwordData.confirmPassword}
              onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/40 h-9 text-sm"
            />
          </div>
          <div className="flex justify-center pt-1">
            <Button onClick={handlePasswordUpdate} className="h-9 px-6 text-sm border border-white/30 text-white font-medium transition-all duration-300 md:hover:bg-white/10 md:hover:border-white/50">
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
    </div>
  );
};

export default EmployerSettings;