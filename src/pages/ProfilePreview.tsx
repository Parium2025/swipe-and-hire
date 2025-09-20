import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Eye, Lock, Unlock, User, Phone, MapPin, Calendar, FileText, Video, Info, Download, Play, ExternalLink, Pause, ArrowRight } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { convertToSignedUrl } from '@/utils/storageUtils';
import { useToast } from '@/hooks/use-toast';
import DeveloperControls from '@/components/DeveloperControls';
import { AppSidebar } from '@/components/AppSidebar';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { useDevice } from '@/hooks/use-device';

interface ProfileViewData {
  id: string;
  user_id: string;
  first_name: string;
  last_name?: string;
  age?: number;
  bio: string;
  location: string;
  phone?: string;
  postal_code?: string;
  employment_status: string;
  working_hours: string;
  availability: string;
  cv_url?: string;
  profile_image_url?: string;
  video_url?: string;
  cover_image_url?: string;
}

export default function ProfilePreview() {
  const { profile, user } = useAuth();
  const [consentedData, setConsentedData] = useState<ProfileViewData | null>(null);
  const [maskedData, setMaskedData] = useState<ProfileViewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState<string>('');
  const [currentView, setCurrentView] = useState('profile');
  const [showDetailedView, setShowDetailedView] = useState(false);

  useEffect(() => {
    const loadPreviewData = async () => {
      if (!user?.id || !profile) return;

      try {
        setLoading(true);
        
        // Simulera vad arbetsgivare ser med samtycke (använd riktiga data från profil)
        const withConsent: ProfileViewData = {
          id: profile.id,
          user_id: profile.user_id,
          first_name: profile.first_name || '',
          last_name: profile.last_name || '',
          age: profile.birth_date ? new Date().getFullYear() - new Date(profile.birth_date).getFullYear() : undefined,
          bio: profile.bio || '',
          location: profile.location || profile.home_location || '',
          phone: profile.phone || '',
          postal_code: (profile as any).postal_code || '',
          employment_status: profile.employment_status || '',
          working_hours: profile.working_hours || '',
          availability: profile.availability || '',
          cv_url: profile.cv_url || '',
          profile_image_url: profile.profile_image_url || '',
          video_url: profile.video_url || '',
          cover_image_url: profile.cover_image_url || ''
        };

        // Simulera vad arbetsgivare ser utan samtycke (maskerad data)
        const withoutConsent: ProfileViewData = {
          id: profile.id,
          user_id: profile.user_id,
          first_name: profile.first_name || '',
          // Ingen last_name
          // Ingen age
          bio: profile.bio && profile.bio.length > 200 ? profile.bio.substring(0, 200) + '...' : profile.bio || '',
          location: profile.location ? profile.location.split(',')[0] : profile.home_location?.split(',')[0] || '', // Bara stad
          // Ingen phone
          // Ingen postal_code
          employment_status: profile.employment_status || '',
          working_hours: profile.working_hours || '',
          availability: profile.availability || '',
          cv_url: profile.cv_url || '',
          profile_image_url: profile.profile_image_url || '',
          video_url: profile.video_url || '',
          cover_image_url: profile.cover_image_url || ''
        };

        setConsentedData(withConsent);
        setMaskedData(withoutConsent);

      } catch (error) {
        console.error('Error loading preview data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPreviewData();
  }, [user?.id, profile]);

  // Ladda avatar URL
  useEffect(() => {
    const loadAvatar = async () => {
      const candidate = profile?.cover_image_url || profile?.profile_image_url || '';
      if (!candidate) {
        setAvatarUrl('');
        return;
      }

      try {
        const refreshed = await convertToSignedUrl(candidate, 'job-applications', 86400);
        setAvatarUrl(refreshed || candidate);
      } catch {
        setAvatarUrl(candidate);
      }
    };

    loadAvatar();
  }, [profile?.cover_image_url, profile?.profile_image_url]);

  const ProfileView = ({ data, isConsented }: { data: ProfileViewData | null; isConsented: boolean }) => {
    if (!data) return <div className="text-white">Ingen data tillgänglig</div>;
    const { toast } = useToast();
    const device = useDevice();
    const isMobile = device === 'mobile';

    const [videoUrl, setVideoUrl] = useState<string>('');
    const [cvUrl, setCvUrl] = useState<string>('');
    const [isPlaying, setIsPlaying] = useState(false);
    const [showVideo, setShowVideo] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);

    // Load signed URLs for media
    useEffect(() => {
      const loadMediaUrls = async () => {
        if (data.video_url) {
          try {
            const signedVideoUrl = await convertToSignedUrl(data.video_url, 'job-applications', 86400);
            setVideoUrl(signedVideoUrl || data.video_url);
          } catch (error) {
            setVideoUrl(data.video_url);
          }
        }

        if (data.cv_url) {
          try {
            const signedCvUrl = await convertToSignedUrl(data.cv_url, 'job-applications', 86400);
            setCvUrl(signedCvUrl || data.cv_url);
          } catch (error) {
            setCvUrl(data.cv_url);
          }
        }
      };

      loadMediaUrls();
    }, [data.video_url, data.cv_url]);

    const handleVideoTap = (e: React.MouseEvent) => {
      e.stopPropagation(); // Förhindra att kort-klicket triggas
      if (videoUrl) {
        if (!isPlaying) {
          setShowVideo(true);
          setIsPlaying(true);
          if (videoRef.current) {
            videoRef.current.currentTime = 0;
            videoRef.current.play();
          }
        } else {
          setShowVideo(false);
          setIsPlaying(false);
          if (videoRef.current) {
            videoRef.current.pause();
            videoRef.current.currentTime = 0;
          }
        }
      }
    };

    const handleVideoEnd = () => {
      setIsPlaying(false);
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
      }
      setShowVideo(false);
    };

    const handlePhoneClick = () => {
      if (isConsented && data.phone) {
        navigator.clipboard.writeText(data.phone);
        toast({
          title: "Telefonnummer kopierat",
          description: "Telefonnumret har kopierats till urklipp",
        });
      }
    };

    const handleCvClick = (e: React.MouseEvent) => {
      e.preventDefault();
      if (cvUrl) {
        window.open(cvUrl, '_blank');
        toast({
          title: "CV öppnat",
          description: "CV:t öppnas i en ny flik",
        });
      } else {
        toast({
          title: "CV ej tillgängligt",
          description: "CV-länken kunde inte laddas",
          variant: "destructive"
        });
      }
    };

    // FÖRSTA VY: Minimal Tinder-stil med swipe
    const TinderCard = () => {
      const [startX, setStartX] = useState(0);
      const [currentX, setCurrentX] = useState(0);
      const [isDragging, setIsDragging] = useState(false);

      const handleTouchStart = (e: React.TouchEvent) => {
        setStartX(e.touches[0].clientX);
        setIsDragging(true);
      };

      const handleTouchMove = (e: React.TouchEvent) => {
        if (!isDragging) return;
        setCurrentX(e.touches[0].clientX - startX);
      };

      const handleTouchEnd = () => {
        if (!isDragging) return;
        setIsDragging(false);
        
        // Swipe threshold
        if (Math.abs(currentX) > 100) {
          if (currentX > 0) {
            // Swipe höger - visa intresse
            toast({
              title: "Swipade höger! 👍",
              description: "Visar intresse för kandidaten",
            });
          } else {
            // Swipe vänster - inte intresserad
            toast({
              title: "Swipade vänster 👎",
              description: "Inte intresserad av kandidaten",
            });
          }
        }
        
        // Reset position
        setCurrentX(0);
      };

      return (
      <div className="w-full max-w-sm mx-auto aspect-[9/16] relative">
        <Card 
          className="bg-white/10 backdrop-blur-sm border-white/20 shadow-2xl overflow-hidden rounded-3xl transition-all duration-300 hover:shadow-3xl cursor-pointer group h-full"
          onClick={() => setShowDetailedView(true)}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{
            transform: `translateX(${currentX}px) rotate(${currentX * 0.1}deg)`,
            transition: isDragging ? 'none' : 'transform 0.3s ease-out'
          }}
        >
          {/* Helskärm profilbild/video */}
          <div className="relative w-full h-full bg-transparent overflow-hidden">
            {/* Cover Image - shown when video is not playing */}
            {(!showVideo || !isPlaying) && (
              <>
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Profilbild"
                    className="absolute inset-0 w-full h-full object-contain object-top"
                    draggable={false}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/30">
                    <User className="h-16 w-16 text-primary/60" />
                  </div>
                )}
              </>
            )}
            
            {/* Video Element - spelas i fullskärm med cirkulär mask */}
            {videoUrl && showVideo && (
              <div className="absolute inset-0 flex items-center justify-center z-20">
                <div className="w-64 h-64 rounded-full overflow-hidden border-4 border-white/40 shadow-2xl">
                  <video 
                    ref={videoRef}
                    src={videoUrl}
                    className="w-full h-full object-cover"
                    loop={false}
                    muted={false}
                    playsInline
                    onEnded={handleVideoEnd}
                    onClick={handleVideoTap}
                    autoPlay
                  />
                </div>
              </div>
            )}

            {/* Video play-knapp om video finns */}
            {videoUrl && !isPlaying && (
              <button
                onClick={handleVideoTap}
                className="absolute bottom-4 right-4 z-30 bg-black/50 hover:bg-black/70 text-white rounded-full p-3 transition-all duration-200 hover:scale-110"
              >
                <Play className="h-6 w-6 ml-0.5" />
              </button>
            )}

            {/* Tinder-stil gradient overlay längst ner med minimal info */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-6">
              <div className="text-white">
                <h1 className="text-3xl font-bold mb-3">
                  {data.first_name}{isConsented && data.age && `, ${data.age}`}
                </h1>
                
                {/* Plats */}
                {data.location && (
                  <div className="flex items-center gap-2 mb-4">
                    <MapPin className="h-4 w-4 text-white/80" />
                    <span className="text-sm text-white/90">Bor i {data.location}</span>
                  </div>
                )}
                
                {/* Swipe-indikator */}
                <div className="flex items-center justify-center mt-6">
                  <div className="bg-white/20 rounded-full px-4 py-2 flex items-center gap-2">
                    <span className="text-sm text-white/80">Tryck för mer info</span>
                    <ArrowRight className="h-4 w-4 text-white/80" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    );
    };

    // ANDRA VY: Fullständig information
    const DetailedView = () => (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
        <div className="w-full max-w-sm mx-auto max-h-[90vh] overflow-y-auto">
          <Card className="bg-white/10 backdrop-blur-sm border-white/20 shadow-2xl overflow-visible rounded-3xl relative">
            {/* Stäng-knapp */}
            <button
              onClick={() => setShowDetailedView(false)}
              className="absolute top-4 right-4 z-10 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-colors"
            >
              ✕
            </button>

            {/* Kompakt profilbild */}
            <div className="relative h-64 w-full bg-transparent overflow-hidden">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Profilbild"
                  className="absolute inset-0 w-full h-full object-cover"
                  draggable={false}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/30">
                  <User className="h-16 w-16 text-primary/60" />
                </div>
              )}
            </div>

            <CardContent className="p-6 space-y-6 text-white">
              {/* Namn och titel */}
              <div className="text-center">
                <h1 className="text-2xl font-bold text-white">
                  {data.first_name} {isConsented ? data.last_name : '***'}
                  {isConsented && data.age && (
                    <span className="text-xl font-normal text-white/80 ml-2">{data.age}</span>
                  )}
                </h1>
                <p className="text-lg text-white/90 font-medium mt-1">
                  {data.employment_status || 'Jobbsökande'}
                </p>
              </div>

              {/* Bio */}
              {data.bio && (
                <div className="space-y-3">
                  <h2 className="text-lg font-bold text-white">Om mig</h2>
                  <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
                    <p className="text-sm text-white/90 leading-relaxed">
                      {data.bio}
                    </p>
                  </div>
                </div>
              )}

              {/* Kontaktinformation (bara med samtycke) */}
              {isConsented && (data.phone || data.location) && (
                <div className="space-y-3 bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
                  <h3 className="font-semibold text-white">Kontakt</h3>
                  {data.phone && (
                    <button
                      onClick={handlePhoneClick}
                      className="flex items-center gap-3 text-white/90 hover:text-white transition-colors w-full text-left group"
                    >
                      <Phone className="h-5 w-5 flex-shrink-0 group-hover:scale-110 transition-transform" />
                      <span className="underline decoration-dotted">{data.phone}</span>
                    </button>
                  )}
                  {data.location && (
                    <div className="flex items-center gap-3 text-white/90">
                      <MapPin className="h-5 w-5 flex-shrink-0" />
                      <span>{data.location} {data.postal_code && `(${data.postal_code})`}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-3 pt-4">
                <Button 
                  variant="outline" 
                  className="flex-1 rounded-2xl py-3 bg-white/10 backdrop-blur-sm border-white/20 text-white hover:bg-white/20"
                >
                  <Phone className="h-4 w-4 mr-2" />
                  Ring
                </Button>
                <Button className="flex-1 bg-white/10 backdrop-blur-sm border-white/20 hover:bg-white/20 rounded-2xl py-3 text-white">
                  <Video className="h-5 w-5 mr-2" />
                  Video Chat
                </Button>
              </div>

              {/* CV */}
              {data.cv_url && (
                <button
                  onClick={handleCvClick}
                  className="w-full flex items-center gap-3 p-3 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20 hover:bg-white/20 transition-all group"
                >
                  <FileText className="h-5 w-5 text-white group-hover:scale-110 transition-transform" />
                  <span className="text-white font-medium">Visa CV</span>
                  <ExternalLink className="h-4 w-4 text-white/80 ml-auto" />
                </button>
              )}

              {/* Tillgänglighet */}
              {(data.working_hours || data.availability) && (
                <div className="space-y-2">
                  <h3 className="font-semibold text-white">Tillgänglighet</h3>
                  <div className="space-y-2">
                    {data.working_hours && (
                      <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 border border-white/20">
                        <span className="text-xs text-white/80 font-medium">Arbetstid</span>
                        <p className="text-sm text-white">{data.working_hours}</p>
                      </div>
                    )}
                    {data.availability && (
                      <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 border border-white/20">
                        <span className="text-xs text-white/80 font-medium">Kan börja</span>
                        <p className="text-sm text-white">{data.availability}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );

    return (
      <>
        <TinderCard />
        {showDetailedView && <DetailedView />}
      </>
    );
  };

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
          Laddar förhandsgranskning...
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <div className="flex-1 flex flex-col">
        {/* Header with developer controls */}
        <div className="flex items-center justify-between p-4 bg-transparent">
          <SidebarTrigger className="text-white" />
          <DeveloperControls 
            onViewChange={setCurrentView}
            currentView={currentView}
          />
        </div>

        <div className="p-6 max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div className="text-center space-y-4 mb-6">
            <div className="flex items-center justify-center gap-2 text-white">
              <Eye className="h-6 w-6" />
              <h1 className="text-2xl font-bold">Förhandsgranska Profil</h1>
            </div>
            <p className="text-white max-w-2xl mx-auto">
              Se hur din profil visas för arbetsgivare i Tinder-stil.
            </p>
          </div>

          {/* Profile View */}
          <ProfileView data={consentedData} isConsented={true} />

          {/* Tips */}
          <Card className="bg-blue-500/20 backdrop-blur-sm border-blue-300/30 mt-8">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Info className="h-5 w-5" />
                Tips för bättre profil
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-blue-100">
              <p>• Första intrycket: Lägg till en bra profilbild eller video</p>
              <p>• Fyll i en utförlig bio för att sticka ut</p>
              <p>• Håll ditt CV uppdaterat med senaste erfarenheter</p>
              <p>• Använd en professionell profilbild</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </SidebarProvider>
  );
}