import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { ProfilePreview } from "@/components/ProfilePreview";

const Settings = () => {
  const { user, profile, userRole, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-parium">
        <div className="text-center">
          <div className="animate-pulse text-white">Laddar...</div>
        </div>
      </div>
    );
  }

  // Only job seekers can access settings
  if (!user || profile?.role !== 'job_seeker') {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-gradient-parium relative">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 left-10 w-4 h-4 bg-secondary/30 rounded-full animate-bounce" style={{ animationDuration: '2s' }}></div>
        <div className="absolute top-32 right-16 w-2 h-2 bg-primary-glow/40 rounded-full animate-bounce" style={{ animationDuration: '2.5s' }}></div>
        <div className="absolute bottom-40 left-20 w-5 h-5 bg-secondary/30 rounded-full animate-bounce" style={{ animationDuration: '2.2s' }}></div>
      </div>

      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header */}
        <div className="text-center py-8 px-4">
          <h1 className="text-3xl font-bold text-white mb-2">Profilförhandsvisning</h1>
          <p className="text-white/80 text-sm max-w-sm mx-auto">
            Så här ser din profil ut för rekryterare när de tittar på dina jobbansökningar
          </p>
        </div>
        
        {/* Profile Preview */}
        <div className="flex-1 px-4 pb-8">
          <ProfilePreview profile={profile} />
        </div>
      </div>
    </div>
  );
};

export default Settings;