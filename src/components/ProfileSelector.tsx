import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Building2, User, Plus, Settings } from 'lucide-react';

interface ProfileSelectorProps {
  onProfileSelected: () => void;
}

const ProfileSelector = ({ onProfileSelected }: ProfileSelectorProps) => {
  const { profile, userRole, user, switchRole } = useAuth();
  const [switching, setSwitching] = useState(false);

  const handleRoleSwitch = async (newRole: 'job_seeker' | 'employer') => {
    setSwitching(true);
    await switchRole(newRole);
    setSwitching(false);
    onProfileSelected();
  };

  const currentRole = userRole?.role || 'job_seeker';
  
  // Mock profiles for demonstration - in real app, these would come from database
  const profiles = [
    {
      id: 'job_seeker',
      role: 'job_seeker' as const,
      name: `${profile?.first_name || 'Jobbsökare'} ${profile?.last_name || ''}`.trim(),
      description: 'Sök efter nya karriärmöjligheter',
      icon: User,
      isActive: currentRole === 'job_seeker',
      color: 'bg-blue-500'
    },
    {
      id: 'employer',
      role: 'employer' as const,
      name: profile?.company_name || 'Företag',
      description: 'Hantera rekrytering och företagsprofil',
      icon: Building2,
      isActive: currentRole === 'employer',
      color: 'bg-green-500'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-parium relative overflow-hidden">
      <div className="absolute inset-0 bg-primary/95"></div>
      
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4">
        <div className="max-w-4xl mx-auto text-center">
          {/* Header */}
          <div className="mb-12">
            <img 
              src="/lovable-uploads/3e52da4e-167e-4ebf-acfb-6a70a68cfaef.png" 
              alt="Parium" 
              className="h-16 w-auto mx-auto mb-8"
            />
            <h1 className="text-4xl md:text-5xl font-bold text-primary-foreground mb-4">
              Välj din profil
            </h1>
            <p className="text-xl text-primary-foreground/80 mb-2">
              Hej {profile?.first_name || user?.email}!
            </p>
            <p className="text-primary-foreground/70">
              Vilken profil vill du använda idag?
            </p>
          </div>

          {/* Profile Cards */}
          <div className="grid md:grid-cols-2 gap-6 mb-8 max-w-2xl mx-auto">
            {profiles.map((prof) => {
              const IconComponent = prof.icon;
              return (
                <Card 
                  key={prof.id}
                  className={`relative cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-2xl border-2 ${
                    prof.isActive 
                      ? 'border-secondary bg-background/95 shadow-2xl' 
                      : 'border-primary-foreground/20 bg-background/80 hover:border-secondary/50'
                  }`}
                  onClick={() => handleRoleSwitch(prof.role)}
                >
                  {prof.isActive && (
                    <Badge className="absolute -top-2 -right-2 bg-secondary text-secondary-foreground">
                      Aktiv
                    </Badge>
                  )}
                  
                  <CardHeader className="text-center pb-4">
                    <div className="mx-auto mb-4">
                      <div className={`${prof.color} p-4 rounded-full w-fit mx-auto`}>
                        <IconComponent className="h-8 w-8 text-white" />
                      </div>
                    </div>
                    <CardTitle className="text-xl font-bold text-primary">
                      {prof.name}
                    </CardTitle>
                    <CardDescription className="text-muted-foreground">
                      {prof.description}
                    </CardDescription>
                  </CardHeader>
                  
                  <CardContent className="text-center">
                    <Button 
                      variant={prof.isActive ? "default" : "outline"}
                      disabled={switching}
                      className={`w-full ${prof.isActive ? 'bg-secondary hover:bg-secondary/90' : ''}`}
                    >
                      {switching ? 'Växlar...' : prof.isActive ? 'Fortsätt' : 'Växla till'}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Continue with current profile */}
          <div className="mb-8">
            <Button 
              onClick={onProfileSelected}
              size="lg"
              className="bg-secondary hover:bg-secondary/90 text-secondary-foreground px-8 py-3 rounded-full"
            >
              Fortsätt som {currentRole === 'job_seeker' ? 'Jobbsökare' : 'Arbetsgivare'}
            </Button>
          </div>

          {/* Additional options */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center text-primary-foreground/60 text-sm">
            <button className="flex items-center gap-2 hover:text-primary-foreground/80 transition-colors">
              <Settings className="h-4 w-4" />
              Hantera profiler
            </button>
            <button className="flex items-center gap-2 hover:text-primary-foreground/80 transition-colors">
              Lägg till profil
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileSelector;