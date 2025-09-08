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
import { User, MapPin, Building, FileText, Camera } from 'lucide-react';
import FileUpload from './FileUpload';
import { createSignedUrl } from '@/utils/storageUtils';

const ProfileSetup = () => {
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
  const [cvUrl, setCvUrl] = useState('');
  const [cvFileName, setCvFileName] = useState('');

  const isEmployer = userRole?.role === 'employer';

  const uploadProfileImage = async (file: File) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user?.id}/profile-image.${fileExt}`;

      // Remove old image first
      await supabase.storage
        .from('job-applications')
        .remove([fileName]);

      const { error: uploadError } = await supabase.storage
        .from('job-applications')
        .upload(fileName, file, {
          upsert: true
        });

      if (uploadError) throw uploadError;

      // Use signed URL for secure access
      const signedUrl = await createSignedUrl('job-applications', fileName, 86400); // 24 hours
      if (!signedUrl) {
        throw new Error('Could not create secure access URL');
      }

      // Add cache busting parameter
      const imageUrl = `${signedUrl}&t=${Date.now()}`;
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

      // Add CV URL if uploaded
      if (cvUrl) {
        updates.cv_url = cvUrl;
        updates.cv_filename = cvFileName || null;
      }

      const result = await updateProfile(updates);
      
      if (!result.error) {
        toast({
          title: "Profil skapad!",
          description: "Din profil har skapats framgångsrikt."
        });
      }
    } catch (error) {
      console.error('Profile update error:', error);
      toast({
        title: "Fel vid profilskapande",
        description: "Kunde inte skapa profilen.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Skapa din profil</CardTitle>
          <CardDescription>
            Fyll i din profilinformation för att komma igång
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Profile Image Section */}
            <div className="flex flex-col items-center space-y-4">
              <div className="relative">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={profileImageUrl} />
                  <AvatarFallback className="text-lg">
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
                Klicka på kameraikon för att ladda upp en profilbild
              </p>
            </div>

            {/* Personal Information */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <User className="h-4 w-4" />
                <Label className="text-base font-medium">Personlig information</Label>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="bio">Kort presentation</Label>
                <Textarea
                  id="bio"
                  placeholder={isEmployer ? "Berätta om ditt företag..." : "Berätta kort om dig själv..."}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                <div className="space-y-2">
                  <Label htmlFor="phone">Telefon</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+46 70 123 45 67"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Employer-specific fields */}
            {isEmployer && (
              <div className="space-y-4">
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
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-4 w-4" />
                  <Label className="text-base font-medium">CV och dokument</Label>
                </div>
                
                <div className="space-y-2">
                  <Label>Ladda upp ditt CV (valfritt)</Label>
                  <FileUpload
                    onFileUploaded={(url, fileName) => {
                      setCvUrl(url);
                      setCvFileName(fileName);
                    }}
                    onFileRemoved={() => {
                      setCvUrl('');
                      setCvFileName('');
                    }}
                    currentFile={cvUrl ? { url: cvUrl, name: "Din valda fil" } : undefined}
                    acceptedFileTypes={['application/pdf', '.doc', '.docx']}
                    maxFileSize={5 * 1024 * 1024}
                  />
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3">
              <Button 
                type="submit" 
                className="w-full" 
                disabled={loading}
              >
                {loading ? 'Sparar profil...' : 'Skapa profil'}
              </Button>
              
              <p className="text-xs text-muted-foreground text-center">
                Du kan alltid uppdatera din profil senare
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfileSetup;