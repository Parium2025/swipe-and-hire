import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Eye, Lock, Unlock, User, Phone, MapPin, Calendar, FileText, Video, Info, Download, Play, ExternalLink } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { convertToSignedUrl } from '@/utils/storageUtils';
import { useToast } from '@/hooks/use-toast';

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

    const [videoUrl, setVideoUrl] = useState<string>('');
    const [cvUrl, setCvUrl] = useState<string>('');

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

    const handlePhoneClick = () => {
      if (isConsented && data.phone) {
        navigator.clipboard.writeText(data.phone);
        toast({
          title: "Telefonnummer kopierat",
          description: "Telefonnumret har kopierats till urklipp",
        });
      }
    };

    const handleVideoClick = () => {
      if (!videoUrl) {
        toast({
          title: "Video ej tillgänglig",
          description: "Videolänken kunde inte laddas",
          variant: "destructive"
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

    return (
      <div className="w-full max-w-sm mx-auto px-4 sm:px-0">
        {/* Modern Profile Card */}
        <Card className="bg-white backdrop-blur-sm border-0 shadow-2xl overflow-hidden rounded-3xl transition-all duration-300 hover:shadow-3xl">
          {/* Profile Image */}
          <div className="relative h-64 sm:h-80 bg-gradient-to-br from-gray-100 to-gray-200 group">
            {avatarUrl ? (
              <img 
                src={avatarUrl} 
                alt="Profilbild"
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/30">
                <User className="h-16 w-16 sm:h-20 sm:w-20 text-primary/60" />
              </div>
            )}
            {/* Three dots menu (decorative) */}
            <div className="absolute top-3 right-3 sm:top-4 sm:right-4 bg-white/20 backdrop-blur-sm rounded-full p-2 opacity-80 hover:opacity-100 transition-opacity">
              <div className="flex gap-1">
                <div className="w-1 h-1 bg-white rounded-full"></div>
                <div className="w-1 h-1 bg-white rounded-full"></div>
                <div className="w-1 h-1 bg-white rounded-full"></div>
              </div>
            </div>
          </div>

          <CardContent className="p-4 sm:p-6 space-y-4 sm:space-y-6">
            {/* Name and Title */}
            <div className="space-y-1 sm:space-y-2 text-center">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight">
                {data.first_name} {isConsented ? data.last_name : '***'}
                {isConsented && data.age && (
                  <span className="block sm:inline text-xl sm:text-2xl font-normal text-gray-600 sm:ml-2 mt-1 sm:mt-0">{data.age}</span>
                )}
              </h1>
              <p className="text-base sm:text-lg text-gray-600 font-medium">
                {data.employment_status || 'Jobbsökande'}
              </p>
            </div>

            {/* Video Presentation Button */}
            {data.video_url && (
              <Dialog>
                <DialogTrigger asChild>
                  <Button 
                    className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-2xl py-3 sm:py-4 text-sm sm:text-base font-medium transition-all duration-200 hover:shadow-lg transform hover:-translate-y-0.5"
                    onClick={handleVideoClick}
                  >
                    <Play className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                    Video Presentation
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl">
                  <DialogHeader>
                    <DialogTitle>Presentationsvideo - {data.first_name}</DialogTitle>
                  </DialogHeader>
                  <div className="w-full aspect-video bg-black rounded-lg overflow-hidden">
                    {videoUrl ? (
                      <video 
                        controls 
                        className="w-full h-full"
                        poster={avatarUrl}
                      >
                        <source src={videoUrl} type="video/mp4" />
                        Din webbläsare stödjer inte videouppspelning.
                      </video>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white">
                        <div className="text-center">
                          <Video className="h-12 w-12 mx-auto mb-2 opacity-50" />
                          <p>Video laddas...</p>
                        </div>
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            )}

            {/* About Me Section */}
            {data.bio && (
              <div className="space-y-2 sm:space-y-3">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900">About Me</h2>
                <div className="bg-gray-50 rounded-2xl p-3 sm:p-4 border border-gray-100">
                  <p className="text-sm sm:text-base text-gray-700 leading-relaxed">
                    {data.bio}
                  </p>
                  {!isConsented && data.bio.endsWith('...') && (
                    <p className="text-amber-600 text-xs sm:text-sm flex items-center gap-1 mt-2 pt-2 border-t border-gray-200">
                      <Info className="h-3 w-3 sm:h-4 sm:w-4" />
                      Begränsad text utan samtycke
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Contact Information (only with consent) */}
            {isConsented && (data.phone || data.location) && (
              <div className="space-y-2 sm:space-y-3 bg-blue-50 rounded-2xl p-3 sm:p-4 border border-blue-100">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Kontaktinformation</h3>
                {data.phone && (
                  <button
                    onClick={handlePhoneClick}
                    className="flex items-center gap-2 sm:gap-3 text-gray-700 hover:text-blue-600 transition-colors w-full text-left group"
                  >
                    <Phone className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0 group-hover:scale-110 transition-transform" />
                    <span className="text-sm sm:text-base underline decoration-dotted">{data.phone}</span>
                  </button>
                )}
                {data.location && (
                  <div className="flex items-center gap-2 sm:gap-3 text-gray-700">
                    <MapPin className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                    <span className="text-sm sm:text-base">{data.location} {data.postal_code && `(${data.postal_code})`}</span>
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2 sm:gap-3 pt-2 sm:pt-4">
              <Button 
                variant="outline" 
                className="flex-1 rounded-2xl py-2.5 sm:py-3 text-sm sm:text-base font-medium border-gray-300 hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 hover:shadow-md"
              >
                <Phone className="h-4 w-4 mr-1 sm:mr-2" />
                Ring
              </Button>
              <Button className="flex-1 bg-blue-600 hover:bg-blue-700 rounded-2xl py-2.5 sm:py-3 text-sm sm:text-base font-medium transition-all duration-200 hover:shadow-lg transform hover:-translate-y-0.5">
                <Video className="h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-2" />
                Video Chat
              </Button>
            </div>

            {/* Job Notifications Toggle */}
            <div className="flex items-center justify-between pt-3 sm:pt-4 border-t border-gray-200">
              <span className="text-base sm:text-lg font-semibold text-gray-900">Jobbnotifieringar</span>
              <button className="w-11 h-6 sm:w-12 sm:h-6 bg-blue-600 rounded-full relative hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
                <div className="w-4 h-4 sm:w-5 sm:h-5 bg-white rounded-full absolute top-1 right-1 shadow-sm transition-transform hover:scale-110"></div>
              </button>
            </div>

            {/* CV and Files */}
            {data.cv_url && (
              <div className="pt-2">
                <button
                  onClick={handleCvClick}
                  className="w-full flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 bg-green-50 hover:bg-green-100 rounded-lg border border-green-200 hover:border-green-300 transition-all duration-200 hover:shadow-md transform hover:-translate-y-0.5 group"
                >
                  <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 flex-shrink-0 group-hover:scale-110 transition-transform" />
                  <span className="text-sm sm:text-base text-green-800 font-medium">Visa CV</span>
                  <ExternalLink className="h-3 w-3 sm:h-4 sm:w-4 text-green-600 ml-auto opacity-60 group-hover:opacity-100 transition-opacity" />
                  <Badge variant="secondary" className="text-xs bg-green-200 text-green-800">PDF</Badge>
                </button>
              </div>
            )}

            {/* Employment Status Details */}
            {(data.working_hours || data.availability) && (
              <div className="pt-2 space-y-2">
                <h3 className="text-sm font-semibold text-gray-900">Tillgänglighet</h3>
                <div className="grid grid-cols-1 gap-2">
                  {data.working_hours && (
                    <div className="bg-purple-50 rounded-lg p-3 border border-purple-100">
                      <span className="text-xs text-purple-700 font-medium">Arbetstid</span>
                      <p className="text-sm text-purple-900">{data.working_hours}</p>
                    </div>
                  )}
                  {data.availability && (
                    <div className="bg-orange-50 rounded-lg p-3 border border-orange-100">
                      <span className="text-xs text-orange-700 font-medium">Kan börja</span>
                      <p className="text-sm text-orange-900">{data.availability}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
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

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-2 text-white">
          <Eye className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Förhandsgranska Profil</h1>
        </div>
        <p className="text-white/80 max-w-2xl mx-auto">
          Se hur din profil visas för arbetsgivare. Skillnaden mellan vyerna beror på om du har gett samtycke för datadelning och om arbetsgivaren har fått tillstånd att se din profil.
        </p>
      </div>

      {/* Info Cards */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="bg-emerald-500/20 backdrop-blur-sm border-emerald-300/30">
          <CardContent className="p-4 flex items-center gap-3">
            <Unlock className="h-8 w-8 text-emerald-300" />
            <div>
              <h3 className="font-semibold text-white">Med Samtycke & Tillstånd</h3>
              <p className="text-emerald-100 text-sm">Arbetsgivare ser full profil efter jobbansökan</p>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-amber-500/20 backdrop-blur-sm border-amber-300/30">
          <CardContent className="p-4 flex items-center gap-3">
            <Lock className="h-8 w-8 text-amber-300" />
            <div>
              <h3 className="font-semibold text-white">Utan Tillstånd</h3>
              <p className="text-amber-100 text-sm">Begränsad vy innan jobbansökan</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs för de olika vyerna */}
      <Tabs defaultValue="consented" className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-white/10 backdrop-blur-sm">
          <TabsTrigger 
            value="consented" 
            className="flex items-center gap-2 data-[state=active]:bg-white/20 data-[state=active]:text-white text-white/70"
          >
            <Unlock className="h-4 w-4" />
            Med Samtycke & Tillstånd
          </TabsTrigger>
          <TabsTrigger 
            value="masked" 
            className="flex items-center gap-2 data-[state=active]:bg-white/20 data-[state=active]:text-white text-white/70"
          >
            <Lock className="h-4 w-4" />
            Utan Tillstånd
          </TabsTrigger>
        </TabsList>

        <TabsContent value="consented" className="mt-6">
          <ProfileView data={consentedData} isConsented={true} />
        </TabsContent>

        <TabsContent value="masked" className="mt-6">
          <ProfileView data={maskedData} isConsented={false} />
        </TabsContent>
      </Tabs>

      {/* Tips */}
      <Card className="bg-blue-500/20 backdrop-blur-sm border-blue-300/30 mt-8">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Info className="h-5 w-5" />
            Tips för bättre profil
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-blue-100">
          <p>• Fyll i en utförlig bio för att sticka ut</p>
          <p>• Ladda upp en presentationsvideo för personlig touch</p>
          <p>• Håll ditt CV uppdaterat med senaste erfarenheter</p>
          <p>• Lägg till en professionell profilbild</p>
        </CardContent>
      </Card>
    </div>
  );
}