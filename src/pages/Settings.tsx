import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { ProfilePreview } from "@/components/ProfilePreview";

const Settings = () => {
  const { user, profile, userRole, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/20 via-background to-secondary/20">
        <div className="text-center">
          <div className="animate-pulse text-muted-foreground">Laddar...</div>
        </div>
      </div>
    );
  }

  // Only job seekers can access settings
  if (!user || profile?.role !== 'job_seeker') {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/20 via-background to-secondary/20 p-4">
      <div className="max-w-md mx-auto">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">Inställningar</h1>
          <p className="text-muted-foreground text-sm">
            Så här ser din profil ut för rekryterare
          </p>
        </div>
        
        <ProfilePreview profile={profile} />
      </div>
    </div>
  );
};

export default Settings;