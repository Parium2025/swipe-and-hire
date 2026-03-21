import type { Dispatch, SetStateAction } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import SettingsPanel from './SettingsPanel';

interface PasswordData {
  newPassword: string;
  confirmPassword: string;
}

interface EmployerPasswordPanelProps {
  passwordData: PasswordData;
  setPasswordData: Dispatch<SetStateAction<PasswordData>>;
  onUpdatePassword: () => void;
}

const EmployerPasswordPanel = ({ passwordData, setPasswordData, onUpdatePassword }: EmployerPasswordPanelProps) => {
  return (
    <SettingsPanel>
      <div className="space-y-5 md:space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="new-password" className="text-sm text-white">Nytt lösenord</Label>
          <Input
            id="new-password"
            type="password"
            value={passwordData.newPassword}
            onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
            className="bg-white/5 border-white/10 text-white placeholder:text-white h-11 !min-h-0 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm-password" className="text-sm text-white">Bekräfta nytt lösenord</Label>
          <Input
            id="confirm-password"
            type="password"
            value={passwordData.confirmPassword}
            onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
            className="bg-white/5 border-white/10 text-white placeholder:text-white h-11 !min-h-0 text-sm"
          />
        </div>
        <div className="flex justify-center pt-1">
          <Button onClick={onUpdatePassword} variant="glass" className="h-11 !min-h-0 px-6 text-sm">
            Uppdatera lösenord
          </Button>
        </div>
      </div>
    </SettingsPanel>
  );
};

export default EmployerPasswordPanel;