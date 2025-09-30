import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Settings, UserCheck, Building, Users, ArrowRightLeft, Code, Lightbulb } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';

interface DeveloperControlsProps {
  onViewChange: (view: string) => void;
  currentView: string;
}

const DeveloperControls: React.FC<DeveloperControlsProps> = ({ onViewChange, currentView }) => {
  const { user, userRole, switchRole, updateProfile } = useAuth();
  const [switching, setSwitching] = useState(false);
  const navigate = useNavigate();

  const handleRoleSwitch = async (newRole: 'job_seeker' | 'employer') => {
    setSwitching(true);
    await switchRole(newRole);
    setSwitching(false);
    onViewChange('dashboard');
  };

  const handleViewChange = async (view: string) => {
    if (view === 'welcome_tunnel') {
      // Reset onboarding to show welcome tunnel
      await updateProfile({ onboarding_completed: false });
      window.location.reload();
    } else if (view === 'employer_welcome_tunnel') {
      // Reset onboarding for employer welcome tunnel
      await switchRole('employer');
      await updateProfile({ onboarding_completed: false });
      window.location.reload();
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

  if (user?.email !== 'fredrikandits@hotmail.com' && user?.email !== 'pariumab2025@hotmail.com') {
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
        className="w-56 bg-background/95 backdrop-blur-sm border-white/20"
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
            navigate('/auth');
            window.location.reload();
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