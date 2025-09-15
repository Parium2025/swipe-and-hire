import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { MapPin, Play, MessageCircle, Video, User } from "lucide-react";
import { Profile } from "@/hooks/useAuth";

interface ProfilePreviewProps {
  profile: Profile | null;
}

export const ProfilePreview = ({ profile }: ProfilePreviewProps) => {
  if (!profile) return null;

  // Calculate age from birth_date
  const calculateAge = (birthDate?: string | null): number | null => {
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

  // Primary role/interest as subtitle
  const jobTitle = profile.employment_status || (
    Array.isArray(profile.interests) && profile.interests.length > 0
      ? String(profile.interests[0])
      : undefined
  );

  return (
    <div className="max-w-sm mx-auto animate-fade-in">
      <Card className="overflow-hidden rounded-3xl border-0 bg-card shadow-xl">
        {/* Hero image (profile image acts as hero like your mock) */}
        <div className="relative h-64">
          {profile.profile_image_url ? (
            <img
              src={profile.profile_image_url}
              alt={`Profilbild för ${displayName}`}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-primary to-secondary" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" />
        </div>

        {/* Overlapping white panel */}
        <CardContent className="-mt-6 rounded-t-3xl bg-card p-6">
          {/* Name + Age */}
          <div className="mb-2">
            <h2 className="text-3xl font-extrabold tracking-tight text-foreground">
              {displayName}
              {age !== null && <span className="ml-2 align-middle text-xl font-semibold text-muted-foreground">{age}</span>}
            </h2>
            {jobTitle && (
              <p className="mt-1 text-base font-medium text-primary">{jobTitle}</p>
            )}
          </div>

          {/* Video presentation pill */}
          <div className="mt-4">
            <div className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${profile.video_url ? 'bg-muted text-foreground' : 'bg-muted/60 text-muted-foreground'}`}>
              <Play className={`h-4 w-4 ${profile.video_url ? 'text-foreground' : 'text-muted-foreground'}`} />
              <span>Videopresentation</span>
            </div>
          </div>

          {/* About me card */}
          <section className="mt-5 rounded-2xl border border-border bg-muted/40 p-4">
            <h3 className="mb-2 text-base font-semibold text-foreground">Om mig</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {profile.bio || 'Ingen beskrivning tillgänglig. Lägg till en bio i din profil för att visa mer information till rekryterare.'}
            </p>
          </section>

          {/* Location (optional) */}
          {(profile.home_location || profile.location) && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>{profile.home_location || profile.location}</span>
            </div>
          )}

          {/* Actions */}
          <div className="mt-5 grid grid-cols-2 gap-3">
            <Button variant="outline" size="lg" className="h-11">
              <MessageCircle className="mr-2 h-4 w-4" />
              Meddelande
            </Button>
            <Button size="lg" className="h-11 hover-scale">
              <Video className="mr-2 h-4 w-4" />
              Videochatt
            </Button>
          </div>

          {/* Divider */}
          <div className="my-5 h-px bg-border" />

          {/* Job notifications row */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-base font-semibold text-foreground">Jobbnotiser</p>
            </div>
            <Switch defaultChecked aria-label="Aktivera jobbnotiser" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
