import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const Index = () => {
  const { user, profile, signOut, loading } = useAuth();
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
                Du är registrerad som {profile.role === 'job_seeker' ? 'jobbsökare' : 'arbetsgivare'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p><strong>Namn:</strong> {profile.first_name} {profile.last_name}</p>
                <p><strong>E-post:</strong> {user.email}</p>
                <p><strong>Roll:</strong> {profile.role === 'job_seeker' ? 'Jobbsökare' : 'Arbetsgivare'}</p>
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
                {profile.role === 'job_seeker' ? (
                  <>
                    <p>Som jobbsökare kommer du snart att kunna:</p>
                    <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                      <li>Swipea på jobbannonser</li>
                      <li>Matcha med arbetsgivare</li>
                      <li>Chatta med intresserade företag</li>
                    </ul>
                  </>
                ) : (
                  <>
                    <p>Som arbetsgivare kommer du snart att kunna:</p>
                    <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                      <li>Publicera jobbannonser</li>
                      <li>Se och matcha med kandidater</li>
                      <li>Chatta med intresserade jobbsökare</li>
                    </ul>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Index;
