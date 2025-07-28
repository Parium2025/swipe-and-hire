import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import EmployerDashboard from '@/components/EmployerDashboard';
import JobSwipe from '@/components/JobSwipe';
import { ArrowRightLeft } from 'lucide-react';

const Index = () => {
  const { user, profile, signOut, loading, switchRole } = useAuth();
  const [switching, setSwitching] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h2 className="text-xl">Laddar...</h2>
        </div>
      </div>
    );
  }

  if (!user || !profile) {
    return null;
  }

  // Show employer dashboard for employers
  if (profile.role === 'employer') {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-background">
          <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold">Parium</h1>
              <p className="text-sm text-muted-foreground">
                Arbetsgivare: {profile.first_name} {profile.last_name}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button 
                onClick={async () => {
                  setSwitching(true);
                  await switchRole('job_seeker');
                  setSwitching(false);
                }}
                disabled={switching}
                variant="outline"
                size="sm"
              >
                <ArrowRightLeft className="mr-2 h-4 w-4" />
                {switching ? 'Byter...' : 'Byt till jobbsökare'}
              </Button>
              <Button onClick={signOut} variant="outline">
                Logga ut
              </Button>
            </div>
          </div>
        </header>
        
        <main className="max-w-7xl mx-auto px-4 py-8">
          <EmployerDashboard />
        </main>
      </div>
    );
  }

  // Show job seeker swipe view for job seekers
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Parium</h1>
            <p className="text-sm text-muted-foreground">
              Jobbsökare: {profile.first_name} {profile.last_name}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              onClick={async () => {
                setSwitching(true);
                await switchRole('employer');
                setSwitching(false);
              }}
              disabled={switching}
              variant="outline"
              size="sm"
            >
              <ArrowRightLeft className="mr-2 h-4 w-4" />
              {switching ? 'Byter...' : 'Byt till arbetsgivare'}
            </Button>
            <Button onClick={signOut} variant="outline">
              Logga ut
            </Button>
          </div>
        </div>
      </header>
      
      <main className="py-8">
        <JobSwipe />
      </main>
    </div>
  );
};

export default Index;
