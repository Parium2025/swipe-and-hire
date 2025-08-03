import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { User, MapPin, Building, Camera, Mail, Phone } from 'lucide-react';
import FileUpload from '@/components/FileUpload';

const Profile = () => {
  const { profile, userRole, updateProfile, user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  // Form fields
  const [bio, setBio] = useState(profile?.bio || '');
  const [location, setLocation] = useState(profile?.location || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [companyName, setCompanyName] = useState(profile?.company_name || '');
  const [orgNumber, setOrgNumber] = useState(profile?.org_number || '');
  const [profileImageUrl, setProfileImageUrl] = useState(profile?.profile_image_url || '');
  const [cvUrl, setCvUrl] = useState((profile as any)?.cv_url || '');

  const isEmployer = userRole?.role === 'employer';

  const uploadProfileImage = async (file: File) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user?.id}/profile-image.${fileExt}`;

      await supabase.storage
        .from('job-applications')
        .remove([fileName]);

      const { error: uploadError } = await supabase.storage
        .from('job-applications')
        .upload(fileName, file, {
          upsert: true
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('job-applications')
        .getPublicUrl(fileName);

      const imageUrl = `${publicUrl}?t=${Date.now()}`;
      setProfileImageUrl(imageUrl);
      
      toast({
        title: "Profilbild uppladdad!",
        description: "Din profilbild har uppdaterats."
      });
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Fel vid uppladdning",
        description: "Kunde inte ladda upp profilbilden.",
        variant: "destructive"
      });
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type.startsWith('image/')) {
        uploadProfileImage(file);
      } else {
        toast({
          title: "Fel filtyp",
          description: "Vänligen välj en bildfil.",
          variant: "destructive"
        });
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const updates: any = {
        bio: bio.trim() || null,
        location: location.trim() || null,
        phone: phone.trim() || null,
        profile_image_url: profileImageUrl || null,
      };

      if (isEmployer) {
        updates.company_name = companyName.trim() || null;
        updates.org_number = orgNumber.trim() || null;
      }

      if (cvUrl) {
        updates.cv_url = cvUrl;
      }

      const result = await updateProfile(updates);
      
      if (!result.error) {
        toast({
          title: "Profil uppdaterad!",
          description: "Dina ändringar har sparats."
        });
      }
    } catch (error) {
      console.error('Profile update error:', error);
      toast({
        title: "Fel vid uppdatering",
        description: "Kunde inte uppdatera profilen.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Min Profil</h1>
        <p className="text-muted-foreground">
          Hantera din profilinformation och inställningar
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Image Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Profilbild
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center space-y-4">
            <div className="relative">
              <Avatar className="h-32 w-32">
                <AvatarImage src={profileImageUrl} />
                <AvatarFallback className="text-2xl">
                  {profile?.first_name?.[0]}{profile?.last_name?.[0]}
                </AvatarFallback>
              </Avatar>
              <label htmlFor="profile-image" className="absolute bottom-0 right-0 bg-primary text-primary-foreground rounded-full p-2 cursor-pointer hover:bg-primary/90 transition-colors">
                <Camera className="h-4 w-4" />
              </label>
              <input
                id="profile-image"
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
              />
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Klicka på kameraikon för att ändra din profilbild
            </p>
          </CardContent>
        </Card>

        {/* Profile Information */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Profilinformation
            </CardTitle>
            <CardDescription>
              Uppdatera din personliga information
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>E-post</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={user?.email || ''}
                      disabled
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Telefon</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+46 70 123 45 67"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">Presentation</Label>
                <Textarea
                  id="bio"
                  placeholder={isEmployer ? "Berätta om ditt företag..." : "Berätta kort om dig själv..."}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Plats</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="location"
                    placeholder="Stockholm, Sverige"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Employer-specific fields */}
              {isEmployer && (
                <div className="space-y-4 pt-4 border-t">
                  <div className="flex items-center gap-2 mb-2">
                    <Building className="h-4 w-4" />
                    <Label className="text-base font-medium">Företagsinformation</Label>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="companyName">Företagsnamn</Label>
                      <Input
                        id="companyName"
                        placeholder="Mitt Företag AB"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="orgNumber">Organisationsnummer</Label>
                      <Input
                        id="orgNumber"
                        placeholder="556123-4567"
                        value={orgNumber}
                        onChange={(e) => setOrgNumber(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* CV Upload for job seekers */}
              {!isEmployer && (
                <div className="space-y-4 pt-4 border-t">
                  <Label className="text-base font-medium">CV och dokument</Label>
                  <FileUpload
                    onFileUploaded={(url, fileName) => setCvUrl(url)}
                    onFileRemoved={() => setCvUrl('')}
                    currentFile={cvUrl ? { url: cvUrl, name: 'CV.pdf' } : undefined}
                    acceptedFileTypes={['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']}
                    maxFileSize={5 * 1024 * 1024}
                  />
                </div>
              )}

              <Button 
                type="submit" 
                className="w-full" 
                disabled={loading}
              >
                {loading ? 'Sparar...' : 'Spara ändringar'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Profile;