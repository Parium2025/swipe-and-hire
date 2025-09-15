import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { MessageCircle, Video, MapPin, User, Phone, Calendar, Briefcase } from "lucide-react";
import { Profile } from "@/hooks/useAuth";

interface ProfilePreviewProps {
  profile: Profile | null;
}

export const ProfilePreview = ({ profile }: ProfilePreviewProps) => {
  if (!profile) return null;

  // Calculate age from birth_date
  const calculateAge = (birthDate: string | null): number | null => {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const age = calculateAge(profile.birth_date);
  const fullName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
  const displayName = fullName || 'Användare';

  // Get primary interest or employment status for job title
  const jobTitle = profile.employment_status || 
    (Array.isArray(profile.interests) && profile.interests.length > 0 
      ? profile.interests[0] 
      : 'Jobbsökande');

  return (
    <div className="max-w-sm mx-auto">
      <Card className="overflow-hidden shadow-2xl border-0 bg-white/95 backdrop-blur-sm">
        {/* Cover Section with gradient overlay */}
        <div className="relative h-40 bg-gradient-to-br from-primary via-primary-glow to-secondary">
          {profile.cover_image_url && (
            <img 
              src={profile.cover_image_url} 
              alt="Cover" 
              className="w-full h-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          
          {/* Profile Image - positioned to overlap */}
          <div className="absolute -bottom-12 left-1/2 transform -translate-x-1/2">
            <div className="relative">
              <Avatar className="w-24 h-24 border-4 border-white shadow-xl">
                <AvatarImage src={profile.profile_image_url || undefined} />
                <AvatarFallback className="text-lg bg-gradient-to-br from-primary to-secondary text-white">
                  {profile.first_name?.[0]}{profile.last_name?.[0]}
                </AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 border-2 border-white rounded-full"></div>
            </div>
          </div>
        </div>

        <CardContent className="pt-16 pb-6 px-6">
          {/* Name and Basic Info */}
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-1">
              {displayName}
              {age && <span className="text-gray-600 font-normal">, {age}</span>}
            </h2>
            
            {/* Location */}
            {(profile.home_location || profile.location) && (
              <div className="flex items-center justify-center gap-1 text-gray-600 mb-2">
                <MapPin className="w-4 h-4" />
                <span className="text-sm">{profile.home_location || profile.location}</span>
              </div>
            )}

            {/* Job Title Badge */}
            <Badge className="bg-gradient-to-r from-primary to-secondary text-white border-0 px-4 py-1">
              {jobTitle}
            </Badge>
          </div>

          {/* Bio Section */}
          <div className="mb-6">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
              <User className="w-4 h-4 mr-2 text-primary" />
              Om mig
            </h3>
            <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 p-4 rounded-lg">
              {profile.bio || "Ingen beskrivning tillgänglig än. Lägg till en personlig beskrivning i din profil för att visa rekryterare vem du är!"}
            </p>
          </div>

          {/* Video Section */}
          <div className="mb-6">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
              <Video className="w-4 h-4 mr-2 text-primary" />
              Videopresentation
            </h3>
            {profile.video_url ? (
              <div className="bg-gradient-to-r from-green-50 to-green-100 border border-green-200 rounded-lg p-4 text-center">
                <Video className="w-8 h-8 mx-auto mb-2 text-green-600" />
                <p className="text-sm text-green-700 font-medium">Videopresentation tillgänglig</p>
                <p className="text-xs text-green-600 mt-1">Rekryterare kan se din videointroduktion</p>
              </div>
            ) : (
              <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                <Video className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                <p className="text-sm text-gray-600">Ingen videopresentation än</p>
                <p className="text-xs text-gray-500 mt-1">Lägg till en video för att sticka ut</p>
              </div>
            )}
          </div>

          {/* Contact Actions */}
          <div className="flex gap-3 mb-6">
            <Button className="flex-1 bg-gradient-to-r from-primary to-primary-glow hover:shadow-lg transition-all duration-200">
              <MessageCircle className="w-4 h-4 mr-2" />
              Meddelande
            </Button>
            <Button variant="outline" className="flex-1 border-primary text-primary hover:bg-primary hover:text-white">
              <Video className="w-4 h-4 mr-2" />
              Videochatt
            </Button>
          </div>

          {/* Additional Details */}
          {(profile.employment_status || profile.working_hours || profile.availability || profile.phone) && (
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <h3 className="font-semibold text-gray-900 flex items-center">
                <Briefcase className="w-4 h-4 mr-2 text-primary" />
                Detaljer
              </h3>
              <div className="space-y-2">
                {profile.employment_status && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Status:</span>
                    <Badge variant="outline" className="text-xs">{profile.employment_status}</Badge>
                  </div>
                )}
                {profile.working_hours && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Arbetstid:</span>
                    <span className="text-sm text-gray-900">{profile.working_hours}</span>
                  </div>
                )}
                {profile.availability && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Tillgänglighet:</span>
                    <span className="text-sm text-gray-900">{profile.availability}</span>
                  </div>
                )}
                {profile.phone && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Telefon:</span>
                    <span className="text-sm text-gray-900">{profile.phone}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Job Notifications Toggle */}
          <div className="mt-6 flex items-center justify-between p-4 bg-gradient-to-r from-secondary/10 to-primary/10 rounded-lg border border-primary/20">
            <div>
              <p className="font-medium text-sm text-gray-900">Jobbnotiser</p>
              <p className="text-xs text-gray-600">Få meddelanden om nya jobb</p>
            </div>
            <Switch defaultChecked className="data-[state=checked]:bg-primary" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};