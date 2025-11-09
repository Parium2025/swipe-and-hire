import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Eye, Lock, Unlock, User, Phone, MapPin, Calendar, FileText, Video, Info, Download, Play, ExternalLink, Pause, ArrowRight, Monitor, Smartphone, X, Mail, Briefcase, Clock } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { convertToSignedUrl } from '@/utils/storageUtils';
import { useToast } from '@/hooks/use-toast';
import { useDevice } from '@/hooks/use-device';
import ProfileVideo from '@/components/ProfileVideo';
import { TruncatedText } from '@/components/TruncatedText';

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
  const [showDetailedView, setShowDetailedView] = useState(false);
  const [viewMode, setViewMode] = useState<'mobile' | 'desktop'>('mobile');

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

  // Ladda avatar URL med caching
  useEffect(() => {
    const loadAvatar = async () => {
      const candidate = profile?.cover_image_url || profile?.profile_image_url || '';
      if (!candidate) {
        setAvatarUrl('');
        return;
      }

      // Check if URL is already fresh (has timestamp within last 5 minutes)
      try {
        const urlObj = new URL(candidate, window.location.origin);
        const timestamp = urlObj.searchParams.get('t');
        if (timestamp) {
          const age = Date.now() - parseInt(timestamp);
          if (age < 5 * 60 * 1000) { // Less than 5 minutes old
            setAvatarUrl(candidate);
            return;
          }
        }
      } catch {
        // Invalid URL, proceed with refresh
      }

      try {
        const refreshed = await convertToSignedUrl(candidate, 'job-applications', 86400);
        const finalUrl = refreshed || candidate;
        setAvatarUrl(finalUrl);
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

    // Load public URLs for media
    useEffect(() => {
      const loadMediaUrls = async () => {
        if (data.video_url) {
          try {
            // Use public URL from profile-media bucket
            if (data.video_url.startsWith('http')) {
              setVideoUrl(data.video_url);
            } else {
              const { data: urlData } = supabase.storage
                .from('profile-media')
                .getPublicUrl(data.video_url);
              setVideoUrl(urlData?.publicUrl || data.video_url);
            }
          } catch (error) {
            setVideoUrl(data.video_url);
          }
        }

        if (data.cv_url) {
          try {
            // CV is private, needs signed URL
            const signedCvUrl = await convertToSignedUrl(data.cv_url, 'job-applications', 86400);
            setCvUrl(signedCvUrl || data.cv_url);
          } catch (error) {
            setCvUrl(data.cv_url);
          }
        }
      };

      loadMediaUrls();
    }, [data.video_url, data.cv_url]);

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

    // FÖRSTA VY: Minimal Tinder-stil med swipe - anpassat för mobil-mockup
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
      <div className="w-full h-full relative">
        <Card 
          className="bg-white/10 backdrop-blur-sm border-white/20 shadow-2xl overflow-hidden rounded-2xl transition-all duration-300 hover:shadow-3xl cursor-pointer group h-full"
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
            {/* Avatar-område för både bild och video - centrerat längst upp */}
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 w-32 h-32 rounded-full overflow-hidden border-2 border-white/40 shadow-2xl bg-gradient-to-br from-primary/20 to-primary/30">
              
              {/* Använd ProfileVideo komponenten om video finns */}
              {videoUrl ? (
                <ProfileVideo
                  videoUrl={videoUrl}
                  coverImageUrl={avatarUrl || undefined}
                  userInitials={`${data.first_name?.[0] || ''}${data.last_name?.[0] || ''}`}
                  alt="Profilbild"
                  className="w-full h-full rounded-full"
                  showCountdown={false}
                />
              ) : (
                /* Om ingen video, visa bara bilden */
                avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Profilbild"
                    className="w-full h-full object-cover"
                    draggable={false}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <User className="h-8 w-8 text-primary/60" />
                  </div>
                )
              )}
            </div>

            {/* Text direkt under profilbilden - bara om video finns */}
            {videoUrl && (
              <div className="absolute top-40 left-1/2 transform -translate-x-1/2 text-center">
                <p className="text-xs font-medium" style={{ color: '#FFFFFF' }}>Video tillgängligt</p>
              </div>
            )}

            {/* Tinder-stil gradient overlay längst ner med minimal info */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-3">
              <div className="text-white">
                <TruncatedText
                  text={`${data.first_name} ${data.last_name}`}
                  className="text-lg font-bold mb-0.5 break-words leading-tight max-w-full two-line-ellipsis block cursor-pointer pointer-events-auto"
                  alwaysShowTooltip={true}
                >
                  <h1 className="text-lg font-bold mb-0.5 break-words leading-tight max-w-full two-line-ellipsis" style={{ color: '#FFFFFF' }}>
                    {data.first_name} {data.last_name}
                  </h1>
                </TruncatedText>
                
                {/* Ålder under namnet */}
                {isConsented && data.age && (
                  <p className="text-sm mb-2" style={{ color: '#FFFFFF' }}>{data.age} år</p>
                )}
                
                {/* Plats */}
                {data.location && (
                  <div className="flex items-center gap-1 mb-2">
                    <MapPin className="h-3 w-3" style={{ color: '#FFFFFF' }} />
                    <span className="text-xs" style={{ color: '#FFFFFF' }}>Bor i {data.location}</span>
                  </div>
                )}
                
                {/* Swipe-indikator */}
                <div className="flex items-center justify-center mt-3">
                  <div className="bg-white/20 rounded-md px-2 py-1 flex items-center gap-1">
                    <span className="text-xs" style={{ color: '#FFFFFF' }}>Tryck för mer info</span>
                    <ArrowRight className="h-3 w-3" style={{ color: '#FFFFFF' }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    );
    };

    // ANDRA VY: Fullständig information - matchar arbetsgivarsidans stil
    const DetailedView = () => (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
        <div className="w-full max-w-[200px] max-h-[400px] overflow-y-auto custom-scrollbar">
          <Card className="bg-background/95 backdrop-blur-xl border-white/10 shadow-2xl overflow-visible rounded-xl relative">
            {/* Stäng-knapp */}
            <button
              onClick={() => setShowDetailedView(false)}
              className="absolute top-2 right-2 z-10 bg-black/50 hover:bg-black/70 text-white rounded-full p-1 transition-colors"
            >
              <X className="h-3 w-3" />
            </button>

            <CardContent className="p-3 space-y-4">
              {/* Namn och titel */}
              <div>
                <h1 className="text-sm font-bold text-foreground">
                  {data.first_name} {isConsented ? data.last_name : '***'}
                </h1>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {data.employment_status || 'Jobbsökande'}
                </p>
              </div>

              {/* Kontaktinformation */}
              {isConsented && (data.phone || data.location) && (
                <div className="space-y-2">
                  <h3 className="text-[10px] font-semibold text-foreground uppercase tracking-wide">Kontaktinformation</h3>
                  <div className="space-y-1.5">
                    {data.phone && (
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        <a 
                          href={`tel:${data.phone}`} 
                          className="text-[10px] hover:text-foreground transition-colors"
                        >
                          {data.phone}
                        </a>
                      </div>
                    )}
                    {data.location && (
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        <span className="text-[10px]">{data.location}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Personlig information */}
              <div className="space-y-2">
                <h3 className="text-[10px] font-semibold text-foreground uppercase tracking-wide">Personlig information</h3>
                <div className="space-y-1.5">
                  {isConsented && data.age && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      <span className="text-[10px]">{data.age} år</span>
                    </div>
                  )}
                  {data.working_hours && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span className="text-[10px]">{data.working_hours}</span>
                    </div>
                  )}
                  {data.availability && (
                    <p className="text-[10px] text-muted-foreground">
                      <span className="font-medium text-foreground">Tillgänglighet:</span> {data.availability}
                    </p>
                  )}
                </div>
              </div>

              {/* Bio */}
              {data.bio && (
                <div className="space-y-2">
                  <h3 className="text-[10px] font-semibold text-foreground uppercase tracking-wide">Om kandidaten</h3>
                  <p className="text-[10px] text-muted-foreground whitespace-pre-wrap line-clamp-4">
                    {data.bio}
                  </p>
                </div>
              )}

              {/* CV & Dokument */}
              {data.cv_url && (
                <div className="space-y-2">
                  <h3 className="text-[10px] font-semibold text-foreground uppercase tracking-wide">Dokument</h3>
                  <button
                    onClick={handleCvClick}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors text-foreground text-[10px]"
                  >
                    <FileText className="h-3 w-3" />
                    Visa CV
                  </button>
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

  // Desktop TeamTailor-style list view
  const DesktopListView = () => {
    const [selectedCandidate, setSelectedCandidate] = useState<boolean>(false);
    
    return (
      <div className="flex h-[600px] max-w-5xl mx-auto bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden">
        {/* Kandidatlista */}
        <div className="w-80 border-r border-white/10 overflow-y-auto bg-white/5">
          <div className="p-4 border-b border-white/10">
            <h3 className="text-white font-semibold">Kandidater</h3>
          </div>
          
          {/* Kandidatkort i lista - klickbar */}
          <div 
            onClick={() => setSelectedCandidate(true)}
            className={`p-4 border-b border-white/10 cursor-pointer transition-colors ${
              selectedCandidate ? 'bg-primary/20' : 'hover:bg-white/5'
            }`}
          >
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarImage src={avatarUrl} />
                <AvatarFallback className="bg-primary/20 text-white">
                  {consentedData?.first_name?.[0]}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium truncate">
                  {consentedData?.first_name} {consentedData?.last_name}
                </p>
                <p className="text-white/60 text-sm truncate">
                  {consentedData?.location}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Detaljvy */}
        {selectedCandidate ? (
          <div className="flex-1 overflow-y-auto">
            <div className="p-6 space-y-6">
              {/* Header */}
              <div className="flex items-start gap-4">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={avatarUrl} />
                  <AvatarFallback className="bg-primary/20 text-white text-2xl">
                    {consentedData?.first_name?.[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-white">
                    {consentedData?.first_name} {consentedData?.last_name}
                  </h2>
                  {consentedData?.age && (
                    <p className="text-white/60">{consentedData.age} år</p>
                  )}
                </div>
                <button
                  onClick={() => setSelectedCandidate(false)}
                  className="text-white/60 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Kontaktinformation */}
              <div className="bg-white/5 rounded-lg p-4 space-y-3">
                <h3 className="text-white font-semibold flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Kontaktinformation
                </h3>
                {consentedData?.phone && (
                  <div className="flex items-center gap-2 text-white/80">
                    <Phone className="h-4 w-4" />
                    <span>{consentedData.phone}</span>
                  </div>
                )}
                {consentedData?.location && (
                  <div className="flex items-center gap-2 text-white/80">
                    <MapPin className="h-4 w-4" />
                    <span>{consentedData.location}</span>
                  </div>
                )}
              </div>

              {/* Bio */}
              {consentedData?.bio && (
                <div className="bg-white/5 rounded-lg p-4">
                  <h3 className="text-white font-semibold mb-3">Om mig</h3>
                  <p className="text-white/80 leading-relaxed whitespace-pre-wrap">
                    {consentedData.bio}
                  </p>
                </div>
              )}

              {/* Tillgänglighet */}
              <div className="bg-white/5 rounded-lg p-4 space-y-3">
                <h3 className="text-white font-semibold flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Tillgänglighet
                </h3>
                {consentedData?.working_hours && (
                  <div className="text-white/80">
                    <span className="text-white/60 text-sm">Arbetstid:</span>{' '}
                    {consentedData.working_hours}
                  </div>
                )}
                {consentedData?.availability && (
                  <div className="text-white/80">
                    <span className="text-white/60 text-sm">Kan börja:</span>{' '}
                    {consentedData.availability}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-white/60">
            Välj en kandidat för att se detaljer
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen w-full">
      <div className="p-6 max-w-6xl mx-auto space-y-6 animate-in fade-in duration-200">
        {/* Header */}
        <div className="text-center space-y-4 mb-6">
          <div className="flex items-center justify-center gap-2 text-white">
            <Eye className="h-6 w-6" />
            <h1 className="text-2xl font-bold">Förhandsgranska Profil</h1>
          </div>
          <p className="text-white max-w-2xl mx-auto">
            Se hur din profil visas för arbetsgivare på mobil och dator.
          </p>
        </div>

        {/* View Mode Toggle */}
        <div className="flex justify-center">
          <div className="inline-flex bg-white/10 backdrop-blur-sm rounded-lg p-1 border border-white/20">
            <button
              onClick={() => setViewMode('mobile')}
              className={`flex items-center gap-2 px-6 py-2 rounded-md transition-all ${
                viewMode === 'mobile'
                  ? 'bg-primary text-white'
                  : 'text-white/70 hover:text-white'
              }`}
            >
              <Smartphone className="h-4 w-4" />
              Mobil vy
            </button>
            <button
              onClick={() => setViewMode('desktop')}
              className={`flex items-center gap-2 px-6 py-2 rounded-md transition-all ${
                viewMode === 'desktop'
                  ? 'bg-primary text-white'
                  : 'text-white/70 hover:text-white'
              }`}
            >
              <Monitor className="h-4 w-4" />
              Datorvy
            </button>
          </div>
        </div>

        {/* Profile View */}
        {viewMode === 'mobile' ? (
          <div className="flex flex-col items-center space-y-4">
            <p className="text-white/80 text-sm">Tinder-stil på mobil (tryck på kortet för mer info)</p>
            
            {/* iPhone-stil telefonram - något större */}
            <div className="relative w-[200px] h-[400px] rounded-[2.4rem] bg-black p-1.5 shadow-2xl scale-90 sm:scale-100">
              {/* Skärm */}
              <div className="relative w-full h-full rounded-[2rem] overflow-hidden bg-black">
                {/* iPhone notch */}
                <div className="absolute top-1.5 left-1/2 -translate-x-1/2 z-20 h-1.5 w-10 rounded-full bg-black border border-gray-800"></div>

                {/* Innehåll med Parium bakgrund */}
                <div 
                  className="absolute inset-0 rounded-[2rem] overflow-y-auto custom-scrollbar"
                  style={{ background: 'linear-gradient(135deg, hsl(215 100% 8%) 0%, hsl(215 90% 15%) 25%, hsl(200 70% 25%) 75%, hsl(200 100% 60%) 100%)' }}
                >
                  <div className="h-full p-3 pt-4">
                    <ProfileView data={consentedData} isConsented={true} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center space-y-4">
            <p className="text-white/80 text-sm">TeamTailor-stil på dator (klicka på kandidaten för att se detaljer)</p>
            <DesktopListView />
          </div>
        )}

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
  );
}