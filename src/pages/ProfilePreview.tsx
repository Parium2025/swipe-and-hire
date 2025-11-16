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
import { getMediaUrl } from '@/lib/mediaManager';
import { useToast } from '@/hooks/use-toast';
import { useDevice } from '@/hooks/use-device';
import { openCvFile } from '@/utils/cvUtils';
import ProfileVideo from '@/components/ProfileVideo';
import { TruncatedText } from '@/components/TruncatedText';
import NameAutoFit from '@/components/NameAutoFit';
import { useMediaUrl } from '@/hooks/useMediaUrl';
import { CvViewer } from '@/components/CvViewer';
import { motion, AnimatePresence } from 'framer-motion';

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
  const [showDetailedView, setShowDetailedView] = useState(false);
  const [viewMode, setViewMode] = useState<'mobile' | 'desktop'>('mobile');
  const [cvOpen, setCvOpen] = useState(false);
  
  // Use hooks to generate signed URLs automatically
  const profileImageUrl = useMediaUrl(profile?.profile_image_url, 'profile-image');
  const signedVideoUrl = useMediaUrl(profile?.video_url, 'profile-video');
  const signedCoverUrl = useMediaUrl(profile?.cover_image_url, 'cover-image');
  const signedCvUrl = useMediaUrl(profile?.cv_url, 'cv');

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


  const ProfileView = ({ data, isConsented }: { data: ProfileViewData | null; isConsented: boolean }) => {
    if (!data) return <div className="text-white">Ingen data tillgänglig</div>;
    const { toast } = useToast();
    const device = useDevice();
    const isMobile = device === 'mobile';

    // Ordräknare för bio
    const countWords = (text: string) => {
      return text.trim().split(/\s+/).filter(word => word.length > 0).length;
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

    const handleEmailClick = () => {
      if (user?.email) {
        navigator.clipboard.writeText(user.email);
        toast({
          title: "E-post kopierad",
          description: "E-postadressen har kopierats till urklipp",
        });
      }
    };

    const handleCvClick = async (e: React.MouseEvent) => {
      e.preventDefault();
      if (!data.cv_url) {
        toast({ title: 'CV ej tillgängligt', description: 'Inget CV har laddats upp', variant: 'destructive' });
        return;
      }
      setCvOpen(true);
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
          className="bg-transparent border-none shadow-none overflow-hidden rounded-none transition-all duration-300 h-full"
          onClick={() => setShowDetailedView(true)}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{
            transform: `translateX(${currentX}px) rotate(${currentX * 0.1}deg)`,
            transition: isDragging ? 'none' : 'transform 0.3s ease-out',
            cursor: 'pointer'
          }}
        >
          {/* Helskärm profilbild/video */}
          <div className="relative w-full h-full bg-transparent overflow-hidden" style={{ cursor: 'pointer' }}>
            {/* Avatar-område för både bild och video - centrerat längst upp */}
            <div 
              className="absolute top-4 left-1/2 transform -translate-x-1/2 w-[165px] h-[165px]"
              style={{ cursor: 'pointer' }}
              onClick={(e) => {
                // Stoppa event propagation så att klick på video/bild inte öppnar detaljvyn
                if (data.video_url) {
                  e.stopPropagation();
                }
              }}
            >
              {/* Använd ProfileVideo komponenten om video finns */}
              {data.video_url && signedVideoUrl ? (
                <ProfileVideo
                  videoUrl={signedVideoUrl}
                  coverImageUrl={signedCoverUrl || profileImageUrl || undefined}
                  userInitials={`${data.first_name?.[0] || ''}${data.last_name?.[0] || ''}`}
                  alt="Profilbild"
                  className="w-full h-full rounded-full"
                  showCountdown={true}
                />
              ) : (
                /* Om ingen video, visa Avatar med fallback till initialer */
                <Avatar className="w-[165px] h-[165px] border-2 border-white/40 shadow-2xl">
                  <AvatarImage 
                    src={profileImageUrl || signedCoverUrl || undefined} 
                    alt="Profilbild"
                    className="object-cover"
                  />
                  <AvatarFallback className="bg-primary/20 text-white text-3xl font-bold">
                    {`${data.first_name?.[0] || ''}${data.last_name?.[0] || ''}`.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              )}
            </div>

            {/* Text direkt under profilbilden - beroende på media */}
            {(data.video_url || data.profile_image_url) && (
              <div className="absolute top-[210px] left-1/2 transform -translate-x-1/2 text-center">
                <p className="text-sm font-medium" style={{ color: '#FFFFFF' }}>
                  {data.video_url ? 'Video tillgängligt' : 'Enbart profilbild vald'}
                </p>
              </div>
            )}

            {/* Tinder-stil gradient overlay längst ner med minimal info */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-2 py-3" style={{ cursor: 'pointer' }}>
              <div className="text-white w-full">
                <TruncatedText
                  text={`${data.first_name} ${data.last_name}`}
                  className="two-line-ellipsis two-line-ellipsis-nopad block w-full"
                >
                  <NameAutoFit
                    text={`${data.first_name} ${data.last_name}`}
                    className="text-lg font-bold mb-0.5 break-words w-full text-white"
                    minFontPx={isMobile ? 13 : 14}
                  />
                </TruncatedText>
                
                {/* Info på separata rader */}
                <div className="space-y-0.5 text-xs text-white">
                  {isConsented && data.age && (
                    <p>{data.age} år</p>
                  )}
                  {data.location && (
                    <p>Bor i {data.location}, Stockholms län</p>
                  )}
                </div>
                
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

    // ANDRA VY: Fullständig information - matchar exakt struktur från Min Profil
    const DetailedView = () => {
      // Helper för att översätta anställningsstatus
      const getEmploymentStatusLabel = (status: string) => {
        const labels: Record<string, string> = {
          'tillsvidareanställning': 'Fast anställning',
          'visstidsanställning': 'Visstidsanställning',
          'provanställning': 'Provanställning',
          'interim': 'Interim anställning',
          'bemanningsanställning': 'Bemanningsanställning',
          'egenforetagare': 'Egenföretagare / Frilans',
          'arbetssokande': 'Arbetssökande',
          'annat': 'Annat'
        };
        return labels[status] || status;
      };

      // Helper för arbetstid
      const getWorkingHoursLabel = (hours: string) => {
        const labels: Record<string, string> = {
          'heltid': 'Heltid',
          'deltid': 'Deltid',
          'varierande': 'Varierande / Flexibelt'
        };
        return labels[hours] || hours;
      };

      // Helper för tillgänglighet
      const getAvailabilityLabel = (availability: string) => {
        const labels: Record<string, string> = {
          'omgaende': 'Omgående',
          'inom-1-manad': 'Inom 1 månad',
          'inom-3-manader': 'Inom 3 månader',
          'inom-6-manader': 'Inom 6 månader',
          'ej-aktuellt': 'Inte aktuellt just nu',
          'osaker': 'Osäker'
        };
        return labels[availability] || availability;
      };

      return (
        <div className="w-full h-full flex flex-col bg-transparent relative">
          {/* Header med stäng-knapp */}
          <div className="relative px-3 pt-2 pb-2 flex items-center justify-center bg-black/20 border-b border-white/20 flex-shrink-0">
            <button
              onClick={() => setShowDetailedView(false)}
              className="absolute right-3 top-2 text-white hover:text-white text-base"
              aria-label="Stäng"
            >
              ✕
            </button>
            <div className="text-center px-8 w-full">
              <TruncatedText
                text={`${data.first_name} ${isConsented ? data.last_name || '' : '***'}`}
                className="two-line-ellipsis block w-full"
              >
                <NameAutoFit
                  text={`${data.first_name} ${isConsented ? data.last_name || '' : '***'}`}
                  className="text-sm font-bold text-white break-words w-full"
                  minFontPx={isMobile ? 13 : 14}
                />
              </TruncatedText>
            </div>
          </div>

          {/* Scrollbart innehåll - exakt samma struktur som Min Profil */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
            
            {/* PERSONLIG INFORMATION */}
            {isConsented && (
              <div className="space-y-1">
                <h3 className="text-[9px] font-semibold text-white uppercase tracking-wide px-1">Personlig Information</h3>
                <div className="bg-white/5 p-2 rounded-lg border border-white/10 space-y-1.5">
                  {/* Ålder */}
                  {data.age && (
                    <div>
                      <p className="text-[11px]" style={{ color: '#FFFFFF' }}>Ålder:</p>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" style={{ color: '#FFFFFF' }} />
                        <p className="text-[11px]" style={{ color: '#FFFFFF' }}>{data.age} år</p>
                      </div>
                    </div>
                  )}
                  
                  {/* Telefon */}
                  {data.phone && (
                    <div>
                      <p className="text-[11px]" style={{ color: '#FFFFFF' }}>Telefon:</p>
                      <button
                        onClick={handlePhoneClick}
                        className="flex items-center gap-1 transition-colors"
                        style={{ color: '#FFFFFF' }}
                      >
                        <Phone className="h-3 w-3" style={{ color: '#FFFFFF' }} />
                        <span className="text-[11px]" style={{ color: '#FFFFFF' }}>{data.phone}</span>
                      </button>
                    </div>
                  )}

                  {/* E-post */}
                  {data.user_id && user?.email && (
                    <div>
                      <p className="text-xs" style={{ color: '#FFFFFF' }}>E-post:</p>
                      <TooltipProvider delayDuration={0}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={handleEmailClick}
                              className="flex items-center gap-1 min-w-0 w-full transition-colors"
                              style={{ color: '#FFFFFF' }}
                            >
                              <Mail className="h-3 w-3 flex-shrink-0" style={{ color: '#FFFFFF' }} />
                              <span className="text-xs truncate block flex-1 min-w-0" style={{ color: '#FFFFFF' }}>{user.email}</span>
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{user.email}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  )}

                  {/* Postnummer */}
                  {data.postal_code && (
                    <div>
                      <p className="text-xs" style={{ color: '#FFFFFF' }}>Postnummer:</p>
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" style={{ color: '#FFFFFF' }} />
                        <p className="text-[11px]" style={{ color: '#FFFFFF' }}>{data.postal_code}</p>
                      </div>
                    </div>
                  )}
                  
                  {/* Ort */}
                  {data.location && (
                    <div>
                      <p className="text-xs" style={{ color: '#FFFFFF' }}>Ort:</p>
                      <p className="text-[11px]" style={{ color: '#FFFFFF' }}>{data.location}</p>
                      <p className="text-[11px]" style={{ color: '#FFFFFF' }}>Stockholms län</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* PRESENTATION / OM MIG */}
            {data.bio && (
              <div className="space-y-1">
                <div className="flex justify-between items-center px-1">
                  <h3 className="text-[9px] font-semibold text-white uppercase tracking-wide">Presentation / Om mig</h3>
                  <span className="text-[9px] text-white">{countWords(data.bio)}/150 ord</span>
                </div>
                <div className="bg-white/5 p-2 rounded-lg border border-white/10">
                  <p className="text-xs text-white whitespace-pre-wrap leading-relaxed">
                    {data.bio}
                  </p>
                </div>
              </div>
            )}

            {/* ANSTÄLLNINGSINFORMATION */}
            {data.employment_status && (
              <div className="space-y-1">
                <h3 className="text-[9px] font-semibold text-white uppercase tracking-wide px-1 flex items-center gap-1">
                  <Briefcase className="h-3 w-3 text-white" />
                  Anställningsinformation
                </h3>
                <div className="bg-white/5 p-3 rounded-lg border border-white/10 space-y-3">
                  {/* Anställningsstatus */}
                  <div className="space-y-0.5">
                    <p className="text-xs text-white font-medium tracking-wide leading-relaxed">Anställningsstatus?</p>
                    <p className="text-[11px] text-white leading-relaxed">Svar: {getEmploymentStatusLabel(data.employment_status)}</p>
                  </div>

                  {/* Arbetstid - visa bara om inte arbetssökande */}
                  {data.employment_status !== 'arbetssokande' && data.working_hours && (
                    <div className="space-y-0.5">
                      <p className="text-xs text-white font-medium tracking-wide leading-relaxed">Hur mycket jobbar du idag?</p>
                      <p className="text-[11px] text-white leading-relaxed">Svar: {getWorkingHoursLabel(data.working_hours)}</p>
                    </div>
                  )}

                  {/* Tillgänglighet */}
                  {data.availability && (
                    <div className="space-y-0.5">
                      <p className="text-xs text-white font-medium tracking-wide leading-relaxed">När kan du börja nytt jobb?</p>
                      <p className="text-[11px] text-white leading-relaxed">Svar: {getAvailabilityLabel(data.availability)}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* CV */}
            {isConsented && data.cv_url && (
              <div className="space-y-1">
                <h3 className="text-[9px] font-semibold text-white uppercase tracking-wide px-1 flex items-center gap-1">
                  <FileText className="h-3 w-3 text-white" />
                  CV
                </h3>
                <div className="bg-white/5 p-2 rounded-lg border border-white/10">
                  <button
                    onClick={handleCvClick}
                    className="flex items-center gap-1.5 text-white hover:text-white transition-colors w-full"
                  >
                    <FileText className="h-3 w-3 text-white flex-shrink-0" />
                    <span className="text-xs">Visa CV</span>
                    <ExternalLink className="h-3 w-3 text-white ml-auto flex-shrink-0" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    };


    return (
      <div className="w-full h-full relative overflow-hidden">
        <AnimatePresence mode="wait">
          {!showDetailedView ? (
            <motion.div
              key="tinder-card"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="w-full h-full absolute inset-0"
            >
              <TinderCard />
            </motion.div>
          ) : (
            <motion.div
              key="detailed-view"
              initial={{ y: '100%' }}
              animate={{ 
                y: 0,
                transition: { 
                  type: 'spring',
                  damping: 30,
                  stiffness: 350,
                  mass: 0.8
                }
              }}
              exit={{ 
                y: '100%',
                transition: { 
                  type: 'spring',
                  damping: 30,
                  stiffness: 350,
                  mass: 0.8
                }
              }}
              className="w-full h-full absolute inset-0"
            >
              <DetailedView />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
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

  // Desktop view - stor profil som mobilvyn men desktop-layout
  const DesktopListView = () => {
    const { toast } = useToast();
    
    // Ordräknare för bio
    const countWords = (text: string) => {
      return text.trim().split(/\s+/).filter(word => word.length > 0).length;
    };
    
    // Format employment status för visning - använder samma mappings som mobilvy
    const getEmploymentStatusLabel = (status: string) => {
      const statusLabels: Record<string, string> = {
        'tillsvidareanställning': 'Fast anställning',
        'visstidsanställning': 'Visstidsanställning',
        'provanställning': 'Provanställning',
        'interim': 'Interim anställning',
        'bemanningsanställning': 'Bemanningsanställning',
        'egenforetagare': 'Egenföretagare / Frilans',
        'arbetssokande': 'Arbetssökande',
        'annat': 'Annat',
      };
      return statusLabels[status] || status;
    };

    const getWorkingHoursLabel = (hours: string) => {
      const hoursLabels: Record<string, string> = {
        'heltid': 'Heltid',
        'deltid': 'Deltid',
        'varierande': 'Varierande / Flexibelt',
        'timmar': 'Timmar',
        'flexibla_tider': 'Flexibla tider'
      };
      return hoursLabels[hours] || hours;
    };

    const getAvailabilityLabel = (avail: string) => {
      const availLabels: Record<string, string> = {
        'omgaende': 'Omgående',
        'omedelbart': 'Omedelbart',
        'inom-1-manad': 'Inom 1 månad',
        'inom-3-manader': 'Inom 3 månader',
        'inom-6-manader': 'Inom 6 månader',
        'ej-aktuellt': 'Inte aktuellt just nu',
        'osaker': 'Osäker',
        '2_veckor': 'Inom 2 veckor',
        '1_manad': 'Inom 1 månad',
        '2_manader': 'Inom 2 månader',
        '3_manader': 'Inom 3 månader',
        'overenskommelse': 'Enligt överenskommelse'
      };
      return availLabels[avail] || avail;
    };

    const handlePhoneClick = () => {
      if (consentedData?.phone) {
        navigator.clipboard.writeText(consentedData.phone);
        toast({
          title: "Telefonnummer kopierat",
          description: "Telefonnumret har kopierats till urklipp",
        });
      }
    };

    const handleEmailClick = () => {
      if (user?.email) {
        navigator.clipboard.writeText(user.email);
        toast({
          title: "E-post kopierad",
          description: "E-postadressen har kopierats till urklipp",
        });
      }
    };
    
    return (
      <div className="max-w-4xl mx-auto">
        {/* Stor rund profilbild/video med namn - direkt på bakgrunden */}
        <div className="mb-6">
          <div className="relative p-8">
            {/* Stor rund profilbild eller video */}
            <div className="flex flex-col items-center gap-4">
              {/* Använd ProfileVideo om video finns, annars Avatar */}
              {signedVideoUrl ? (
                <div className="relative h-[280px] w-[280px]">
                  <ProfileVideo
                    videoUrl={signedVideoUrl}
                    coverImageUrl={signedCoverUrl || profileImageUrl || undefined}
                    userInitials={`${consentedData?.first_name?.[0] || ''}${consentedData?.last_name?.[0] || ''}`}
                    alt="Profilbild"
                    className="w-full h-full rounded-full ring-4 ring-white/20 shadow-2xl"
                    showCountdown={true}
                  />
                </div>
              ) : (
                <Avatar className="h-[280px] w-[280px] ring-4 ring-white/20 shadow-2xl">
                  <AvatarImage src={profileImageUrl || signedCoverUrl || undefined} className="object-cover" />
                  <AvatarFallback className="bg-primary text-white text-7xl">
                    {consentedData?.first_name?.[0]}
                  </AvatarFallback>
                </Avatar>
              )}
              
              {/* Status text under bild/video */}
              {(signedVideoUrl || profileImageUrl) && (
                <p className="text-sm font-medium text-white">
                  {signedVideoUrl ? 'Video tillgängligt' : 'Enbart profilbild vald'}
                </p>
              )}
              
              {/* Namn och ålder */}
              <div className="text-center">
                <h2 className="text-3xl font-bold text-white drop-shadow-lg">
                  {consentedData?.first_name} {consentedData?.last_name}
                </h2>
                {consentedData?.age && (
                  <p className="text-white/90 text-lg mt-1 drop-shadow">{consentedData.age} år</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Innehållssektioner i grid */}
        <div className="grid grid-cols-2 gap-6">
          {/* Personlig information */}
          <Card className="bg-white/5 backdrop-blur-md border-white/10 shadow-xl">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <User className="h-5 w-5" />
                Personlig information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {consentedData?.phone && (
                <div className="flex items-start gap-3">
                  <Phone className="h-5 w-5 text-white mt-0.5" />
                  <div>
                    <p className="text-xs text-white/60 mb-1">Telefon</p>
                    <p 
                      className="text-white cursor-pointer transition-opacity hover:opacity-80"
                      onClick={handlePhoneClick}
                    >
                      {consentedData.phone}
                    </p>
                  </div>
                </div>
              )}
              {consentedData?.location && (
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-white mt-0.5" />
                  <div>
                    <p className="text-xs text-white/60 mb-1">Plats</p>
                    <p className="text-white">{consentedData.location}</p>
                  </div>
                </div>
              )}
              {user?.email && (
                <div className="flex items-start gap-3">
                  <Mail className="h-5 w-5 text-white mt-0.5" />
                  <div>
                    <p className="text-xs text-white/60 mb-1">E-post</p>
                    <p 
                      className="text-white cursor-pointer transition-opacity hover:opacity-80"
                      onClick={handleEmailClick}
                    >
                      {user.email}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Anställningsinformation */}
          {(consentedData?.employment_status || consentedData?.working_hours || consentedData?.availability) && (
            <Card className="bg-white/5 backdrop-blur-md border-white/10 shadow-xl">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Briefcase className="h-5 w-5" />
                  Anställningsinformation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {consentedData?.employment_status && (
                  <div>
                    <p className="text-xs text-white/60 mb-1">Anställningsstatus</p>
                    <p className="text-white font-medium">
                      {getEmploymentStatusLabel(consentedData.employment_status)}
                    </p>
                  </div>
                )}
                {consentedData?.working_hours && (
                  <div>
                    <p className="text-xs text-white/60 mb-1">Arbetstid</p>
                    <p className="text-white">{getWorkingHoursLabel(consentedData.working_hours)}</p>
                  </div>
                )}
                {consentedData?.availability && (
                  <div>
                    <p className="text-xs text-white/60 mb-1">Tillgänglighet</p>
                    <p className="text-white">{getAvailabilityLabel(consentedData.availability)}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Presentation - tar upp full bredd */}
          {consentedData?.bio && (
            <Card className="col-span-2 bg-white/5 backdrop-blur-md border-white/10 shadow-xl">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="text-white">
                    Presentation om mig
                  </CardTitle>
                  <span className="text-sm text-white/60">{countWords(consentedData.bio)}/150 ord</span>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-white/90 whitespace-pre-wrap leading-relaxed">
                  {consentedData.bio}
                </p>
              </CardContent>
            </Card>
          )}

          {/* CV - tar upp full bredd */}
          {consentedData?.cv_url && signedCvUrl && (
            <Card className="col-span-2 bg-white/5 backdrop-blur-md border-white/10 shadow-xl">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  CV
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CvViewer 
                  src={signedCvUrl} 
                  fileName="CV" 
                  height="600px"
                />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen w-full">
      <div className="p-6 max-w-6xl mx-auto space-y-6 animate-in fade-in duration-200">
        {/* Header */}
        <div className="text-center space-y-4 mb-6">
          <h1 className="text-2xl font-semibold text-white">Förhandsgranska Profil</h1>
          <p className="text-white max-w-2xl mx-auto">
            Se hur din profil visas för arbetsgivare på mobil och dator.
          </p>
        </div>

        {/* View Mode Toggle - iOS Style */}
        <div className="flex justify-center">
          <div className="relative inline-flex bg-white/10 backdrop-blur-sm rounded-lg p-1 border border-white/20">
            {/* Sliding background */}
            <motion.div
              className="absolute top-1 bottom-1 bg-primary rounded-md"
              initial={false}
              animate={{
                left: viewMode === 'mobile' ? '4px' : '50%',
                width: viewMode === 'mobile' ? 'calc(50% - 4px)' : 'calc(50% - 4px)',
              }}
              transition={{
                type: "spring",
                stiffness: 500,
                damping: 30,
              }}
            />
            
            {/* Buttons */}
            <button
              onClick={() => setViewMode('mobile')}
              className="relative z-10 flex items-center gap-1.5 px-4 py-1.5 rounded-md transition-colors text-sm text-white"
            >
              <Smartphone className="h-3.5 w-3.5" />
              Mobil vy
            </button>
            <button
              onClick={() => setViewMode('desktop')}
              className="relative z-10 flex items-center gap-1.5 px-4 py-1.5 rounded-md transition-colors text-sm text-white"
            >
              <Monitor className="h-3.5 w-3.5" />
              Datorvy
            </button>
          </div>
        </div>

        {/* Profile View */}
        {viewMode === 'mobile' ? (
          <div className="flex flex-col items-center space-y-4">
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
                  <div className="h-full p-0">
                    <ProfileView data={consentedData} isConsented={true} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center space-y-4">
            <DesktopListView />
          </div>
        )}
      </div>

      {/* CV Dialog */}
      <Dialog open={cvOpen} onOpenChange={setCvOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden bg-transparent border-none shadow-none p-8">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-white text-2xl">CV</DialogTitle>
          </DialogHeader>
          {consentedData?.cv_url && (
            <CvViewer src={consentedData.cv_url} fileName="cv.pdf" height="70vh" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}