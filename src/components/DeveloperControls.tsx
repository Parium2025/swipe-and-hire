import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Settings, UserCheck, Building, Users, ArrowRightLeft, Code, Lightbulb } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useIsOrgAdmin } from '@/hooks/useIsOrgAdmin';
import { useNavigate } from 'react-router-dom';

interface DeveloperControlsProps {
  onViewChange: (view: string) => void;
  currentView: string;
}

const DeveloperControls: React.FC<DeveloperControlsProps> = ({ onViewChange, currentView }) => {
  const { user, userRole, switchRole, updateProfile } = useAuth();
  const { isAdmin, loading: adminLoading } = useIsOrgAdmin();
  const [switching, setSwitching] = useState(false);
  const navigate = useNavigate();

  const handleRoleSwitch = async (newRole: 'job_seeker' | 'employer') => {
    setSwitching(true);
    await switchRole(newRole);
    setSwitching(false);
    onViewChange('dashboard');
  };

  // Steg-definitioner per tunnel — används för dev-snabbhopp
  const jobSeekerSteps: { step: number; label: string }[] = [
    { step: -1, label: 'Swipe-intro' },
    { step: 0, label: 'Steg 0 · Introduktion' },
    { step: 1, label: 'Steg 1 · Personuppgifter' },
    { step: 2, label: 'Steg 2 · Profilbild & video' },
    { step: 3, label: 'Steg 3 · CV' },
    { step: 4, label: 'Steg 4 · Bio' },
    { step: 5, label: 'Steg 5 · Samtycke' },
    { step: 6, label: 'Steg 6 · Slutför' },
    { step: 7, label: 'Steg 7 · Färdigt' },
  ];

  const employerSteps: { step: number; label: string }[] = [
    { step: 0, label: 'Steg 0 · Välkommen' },
    { step: 1, label: 'Steg 1 · Företagslogga' },
    { step: 2, label: 'Steg 2 · Instruktioner' },
    { step: 3, label: 'Steg 3 · Slutför' },
  ];

  const jumpToTunnelStep = async (
    tunnel: 'welcome_tunnel' | 'employer_welcome_tunnel',
    step: number
  ) => {
    // Säkerställ rätt roll utan att reloada — hoppa direkt in i tunneln
    if (tunnel === 'welcome_tunnel' && userRole?.role !== 'job_seeker') {
      await switchRole('job_seeker');
    }
    if (tunnel === 'employer_welcome_tunnel' && userRole?.role !== 'employer') {
      await switchRole('employer');
    }
    onViewChange(`${tunnel}:${step}`);
  };

  const handleViewChange = async (view: string) => {
    if (view === 'welcome_tunnel') {
      await jumpToTunnelStep('welcome_tunnel', -1);
    } else if (view === 'employer_welcome_tunnel') {
      await jumpToTunnelStep('employer_welcome_tunnel', 0);
    } else if (view === 'profile_setup') {
      // Clear profile data to show setup
      await updateProfile({ 
        bio: null, 
        location: null, 
        profile_image_url: null 
      });
      await switchRole('employer');
      window.location.reload();
    } else {
      onViewChange(view);
    }
  };

  if (adminLoading || !isAdmin) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size="sm"
          className="border-white/20 text-white hover:bg-white/20 bg-white/5"
        >
          <Code className="mr-2 h-4 w-4" />
          Utvecklarvy
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        className="w-56 glass-panel"
        align="end"
      >
        <DropdownMenuLabel className="text-sm font-medium">
          Utvecklarkontroller
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-white/10" />
        
        {/* Visa jobbsökar-alternativ endast när man inte är employer */}
        {userRole?.role !== 'employer' && (
          <DropdownMenuItem 
            onClick={() => handleViewChange('welcome_tunnel')}
            className="cursor-pointer hover:bg-white/10"
          >
            <UserCheck className="mr-2 h-4 w-4" />
            Välkomsttunnel (Jobbsökare)
          </DropdownMenuItem>
        )}
        
        <DropdownMenuItem 
          onClick={() => handleViewChange('employer_welcome_tunnel')}
          className="cursor-pointer hover:bg-white/10"
        >
          <Building className="mr-2 h-4 w-4" />
          Välkomsttunnel (Arbetsgivare)
        </DropdownMenuItem>
        
        <DropdownMenuItem 
          onClick={() => {
            sessionStorage.removeItem('parium-intro-seen');
            navigate('/auth', { replace: true });
          }}
          className="cursor-pointer hover:bg-white/10"
        >
          <Lightbulb className="mr-2 h-4 w-4" />
          Visa Introfilm
        </DropdownMenuItem>
        
        <DropdownMenuItem 
          onClick={() => handleViewChange('profile_setup')}
          className="cursor-pointer hover:bg-white/10"
        >
          <Building className="mr-2 h-4 w-4" />
          Profilsetup (Arbetsgivare)
        </DropdownMenuItem>
        
        <DropdownMenuSeparator className="bg-white/10" />
        
        <DropdownMenuItem 
          onClick={() => handleViewChange('dashboard')}
          className="cursor-pointer hover:bg-white/10"
        >
          <Users className="mr-2 h-4 w-4" />
          Normal Dashboard
        </DropdownMenuItem>
        
        <DropdownMenuSeparator className="bg-white/10" />
        
        <DropdownMenuItem 
          onClick={() => handleRoleSwitch('job_seeker')}
          disabled={switching || userRole?.role === 'job_seeker'}
          className="cursor-pointer hover:bg-white/10"
        >
          <ArrowRightLeft className="mr-2 h-4 w-4" />
          {switching ? 'Byter...' : 'Byt till Jobbsökare'}
        </DropdownMenuItem>
        
        <DropdownMenuItem 
          onClick={() => handleRoleSwitch('employer')}
          disabled={switching || userRole?.role === 'employer'}
          className="cursor-pointer hover:bg-white/10"
        >
          <ArrowRightLeft className="mr-2 h-4 w-4" />
          {switching ? 'Byter...' : 'Byt till Arbetsgivare'}
        </DropdownMenuItem>
        
        <DropdownMenuSeparator className="bg-white/10" />
        
        <DropdownMenuItem 
          onClick={() => navigate('/profile')}
          className="cursor-pointer hover:bg-white/10"
        >
          <Settings className="mr-2 h-4 w-4" />
          Profilsida
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default DeveloperControls;