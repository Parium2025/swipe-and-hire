import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import SettingsPanel from './SettingsPanel';

interface EmployerAccountEmailPanelProps {
  email: string;
}

const EmployerAccountEmailPanel = ({ email }: EmployerAccountEmailPanelProps) => {
  return (
    <SettingsPanel>
      <div className="space-y-5 md:space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-sm text-white">E-postadress</Label>
          <Input
            id="email"
            value={email}
            disabled
            className="bg-white/5 border-white/10 text-white h-11 !min-h-0 text-sm cursor-not-allowed"
          />
        </div>
      </div>
    </SettingsPanel>
  );
};

export default EmployerAccountEmailPanel;