import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { MessageCircle, Video, MapPin, Calendar, User } from "lucide-react";
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
    <Card className="overflow-hidden shadow-lg">
      {/* Cover Image Section */}
      <div 
        className="h-32 bg-gradient-to-r from-primary to-primary/80 relative"
        style={{
          backgroundImage: profile.cover_image_url ? `url(${profile.cover_image_url})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      >
        <div className="absolute inset-0 bg-black/20" />
      </div>

      {/* Profile Image */}
      <div className="relative px-6 pb-6">
        <div className="flex justify-center -mt-12 mb-4">
          <Avatar className="w-24 h-24 border-4 border-white shadow-lg">
            <AvatarImage src={profile.profile_image_url || undefined} />
            <AvatarFallback className="text-lg bg-muted">
              <User className="w-8 h-8" />
            </AvatarFallback>
          </Avatar>
        </div>

        <CardContent className="p-0">
          {/* Name and Age */}
          <div className="text-center mb-4">
            <h2 className="text-xl font-bold text-foreground">
              {displayName}
              {age && <span className="text-muted-foreground">, {age}</span>}
            </h2>
            
            {/* Location */}
            {(profile.home_location || profile.location) && (
              <div className="flex items-center justify-center gap-1 text-muted-foreground mt-1">
                <MapPin className="w-4 h-4" />
                <span className="text-sm">{profile.home_location || profile.location}</span>
              </div>
            )}
          </div>

          {/* Job Title/Status */}
          <div className="text-center mb-4">
            <Badge variant="secondary" className="px-3 py-1">
              {jobTitle}
            </Badge>
          </div>

          {/* Video Section */}
          {profile.video_url ? (
            <div className="mb-4">
              <div className="bg-muted rounded-lg p-4 text-center">
                <Video className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Videopresentation tillgänglig</p>
              </div>
            </div>
          ) : (
            <div className="mb-4">
              <div className="bg-muted/50 rounded-lg p-4 text-center border-2 border-dashed border-muted">
                <Video className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground/70">Ingen videopresentation</p>
              </div>
            </div>
          )}

          {/* About Me Section */}
          <div className="mb-6">
            <h3 className="font-semibold text-foreground mb-2">Om mig</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {profile.bio || "Ingen beskrivning tillgänglig. Lägg till en bio i din profil för att visa mer information till rekryterare."}
            </p>
          </div>

          {/* Action Buttons (Mock) */}
          <div className="flex gap-3 mb-6">
            <Button className="flex-1" variant="default">
              <MessageCircle className="w-4 h-4 mr-2" />
              Meddelande
            </Button>
            <Button className="flex-1" variant="outline">
              <Video className="w-4 h-4 mr-2" />
              Videochatt
            </Button>
          </div>

          {/* Job Notifications Toggle (Mock) */}
          <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
            <div>
              <p className="font-medium text-sm">Jobbnotiser</p>
              <p className="text-xs text-muted-foreground">Få meddelanden om nya jobb</p>
            </div>
            <Switch defaultChecked />
          </div>

          {/* Additional Info */}
          {(profile.employment_status || profile.working_hours || profile.availability) && (
            <div className="mt-4 pt-4 border-t border-border">
              <div className="space-y-2">
                {profile.employment_status && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Status:</span>
                    <span className="text-foreground">{profile.employment_status}</span>
                  </div>
                )}
                {profile.working_hours && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Arbetstid:</span>
                    <span className="text-foreground">{profile.working_hours}</span>
                  </div>
                )}
                {profile.availability && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tillgänglighet:</span>
                    <span className="text-foreground">{profile.availability}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </div>
    </Card>
  );
};