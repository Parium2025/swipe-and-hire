import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Eye, Lock, Unlock, User, Phone, MapPin, Calendar, FileText, Video, Info } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { convertToSignedUrl } from '@/utils/storageUtils';

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

    return (
      <div className="space-y-6">
        {/* Header med avatar och grundinfo */}
        <Card className="bg-white/10 backdrop-blur-sm border-white/20">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={avatarUrl} alt="Profilbild" />
                <AvatarFallback className="bg-white/20 text-white text-lg">
                  {data.first_name?.[0]}{data.last_name?.[0]}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-white">
                  {data.first_name} {isConsented ? data.last_name : '***'}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  <MapPin className="h-4 w-4 text-white/70" />
                  <span className="text-white/70">{data.location}</span>
                  {isConsented && data.postal_code && (
                    <Badge variant="secondary" className="ml-2">
                      {data.postal_code}
                    </Badge>
                  )}
                </div>
                {isConsented && data.age && (
                  <div className="flex items-center gap-2 mt-1">
                    <Calendar className="h-4 w-4 text-white/70" />
                    <span className="text-white/70">{data.age} år</span>
                  </div>
                )}
                {isConsented && data.phone && (
                  <div className="flex items-center gap-2 mt-1">
                    <Phone className="h-4 w-4 text-white/70" />
                    <span className="text-white/70">{data.phone}</span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Anställningsstatus */}
        <Card className="bg-white/10 backdrop-blur-sm border-white/20">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <User className="h-5 w-5" />
              Anställningsstatus
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.employment_status && (
              <div>
                <span className="text-white/70 text-sm">Nuvarande status:</span>
                <p className="text-white font-medium">{data.employment_status}</p>
              </div>
            )}
            {data.working_hours && (
              <div>
                <span className="text-white/70 text-sm">Arbetstid:</span>
                <p className="text-white font-medium">{data.working_hours}</p>
              </div>
            )}
            {data.availability && (
              <div>
                <span className="text-white/70 text-sm">Kan börja:</span>
                <p className="text-white font-medium">{data.availability}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bio */}
        {data.bio && (
          <Card className="bg-white/10 backdrop-blur-sm border-white/20">
            <CardHeader>
              <CardTitle className="text-white">Om mig</CardTitle>
              {!isConsented && data.bio.endsWith('...') && (
                <CardDescription className="text-amber-200 flex items-center gap-1">
                  <Info className="h-4 w-4" />
                  Begränsad text utan samtycke
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <p className="text-white leading-relaxed">{data.bio}</p>
            </CardContent>
          </Card>
        )}

        {/* Filer */}
        <Card className="bg-white/10 backdrop-blur-sm border-white/20">
          <CardHeader>
            <CardTitle className="text-white">Filer & Media</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.cv_url && (
              <div className="flex items-center gap-2 p-3 bg-white/5 rounded-lg">
                <FileText className="h-5 w-5 text-white/70" />
                <span className="text-white">CV tillgängligt</span>
                <Badge variant="outline" className="ml-auto">PDF</Badge>
              </div>
            )}
            {data.video_url && (
              <div className="flex items-center gap-2 p-3 bg-white/5 rounded-lg">
                <Video className="h-5 w-5 text-white/70" />
                <span className="text-white">Presentationsvideo</span>
                <Badge variant="outline" className="ml-auto">Video</Badge>
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