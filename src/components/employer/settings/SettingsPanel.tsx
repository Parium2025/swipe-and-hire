import type { ReactNode } from 'react';

interface SettingsPanelProps {
  children: ReactNode;
}

const SettingsPanel = ({ children }: SettingsPanelProps) => {
  return (
    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-6 md:p-4">
      {children}
    </div>
  );
};

export default SettingsPanel;