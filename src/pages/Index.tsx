import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import EmployerDashboard from '@/components/EmployerDashboard';
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
            <Button onClick={signOut} variant="outline">
              Logga ut
            </Button>
          </div>
        </header>
        
        <main className="max-w-7xl mx-auto px-4 py-8">
          <EmployerDashboard />
        </main>
      </div>
    );
  }

  // Show job seeker view for job seekers
  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Parium</h1>
            <p className="text-muted-foreground">
              Välkommen, {profile.first_name}!
            </p>
          </div>
          <Button onClick={signOut} variant="outline">
            Logga ut
          </Button>
        </header>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Din profil</CardTitle>
              <CardDescription>
                Du är registrerad som jobbsökare
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <p><strong>Namn:</strong> {profile.first_name} {profile.last_name}</p>
                  <p><strong>E-post:</strong> {user.email}</p>
                  <p><strong>Roll:</strong> Jobbsökare</p>
                </div>
                
                <div className="pt-4 border-t">
                  <Button 
                    onClick={async () => {
                      setSwitching(true);
                      await switchRole('employer');
                      setSwitching(false);
                    }}
                    disabled={switching}
                    className="w-full"
                    variant="outline"
                  >
                    <ArrowRightLeft className="mr-2 h-4 w-4" />
                    {switching ? 'Byter roll...' : 'Byt till arbetsgivare'}
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    Byt till arbetsgivare för att publicera jobbannonser
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Nästa steg</CardTitle>
              <CardDescription>
                Utvecklingen fortsätter...
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p>Som jobbsökare kommer du snart att kunna:</p>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  <li>Swipea på jobbannonser</li>
                  <li>Matcha med arbetsgivare</li>
                  <li>Chatta med intresserade företag</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Index;
