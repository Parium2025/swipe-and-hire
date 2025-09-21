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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Inställningar</h1>
        <p className="text-white/70">Hantera dina kontoinställningar och preferenser</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Kontoinformation</CardTitle>
          <CardDescription>Din grundläggande kontoinformation</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>E-postadress</Label>
            <Input value={user?.email || ''} disabled />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ändra lösenord</CardTitle>
          <CardDescription>Uppdatera ditt kontolösenord</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="current-password">Nuvarande lösenord</Label>
            <Input
              id="current-password"
              type="password"
              value={passwordData.currentPassword}
              onChange={(e) => setPasswordData({...passwordData, currentPassword: e.target.value})}
            />
          </div>
          <div>
            <Label htmlFor="new-password">Nytt lösenord</Label>
            <Input
              id="new-password"
              type="password"
              value={passwordData.newPassword}
              onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})}
            />
          </div>
          <div>
            <Label htmlFor="confirm-password">Bekräfta nytt lösenord</Label>
            <Input
              id="confirm-password"
              type="password"
              value={passwordData.confirmPassword}
              onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})}
            />
          </div>
          <Button onClick={handlePasswordUpdate}>Uppdatera lösenord</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Aviseringar</CardTitle>
          <CardDescription>Hantera dina aviseringsinställningar</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>E-postaviseringar</Label>
              <p className="text-sm text-muted-foreground">Få aviseringar via e-post</p>
            </div>
            <Switch
              checked={notifications.emailNotifications}
              onCheckedChange={(checked) => setNotifications({...notifications, emailNotifications: checked})}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <Label>Nya ansökningar</Label>
              <p className="text-sm text-muted-foreground">När någon söker dina jobb</p>
            </div>
            <Switch
              checked={notifications.newApplications}
              onCheckedChange={(checked) => setNotifications({...notifications, newApplications: checked})}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Meddelanden från kandidater</Label>
              <p className="text-sm text-muted-foreground">När kandidater skickar meddelanden</p>
            </div>
            <Switch
              checked={notifications.messagesFromCandidates}
              onCheckedChange={(checked) => setNotifications({...notifications, messagesFromCandidates: checked})}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Veckorapporter</Label>
              <p className="text-sm text-muted-foreground">Få veckovisa statistikrapporter</p>
            </div>
            <Switch
              checked={notifications.weeklyReports}
              onCheckedChange={(checked) => setNotifications({...notifications, weeklyReports: checked})}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EmployerSettings;