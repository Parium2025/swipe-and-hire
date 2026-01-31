import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ResolvedAvatar } from '@/components/ui/resolved-avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { User, MapPin, Building, FileText, Camera, Globe, Users } from 'lucide-react';
import FileUpload from './FileUpload';
import { createSignedUrl } from '@/utils/storageUtils';
import { SWEDISH_INDUSTRIES, EMPLOYEE_COUNT_OPTIONS } from '@/lib/industries';

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
  
  // New employer fields  
  const [industry, setIndustry] = useState((profile as any)?.industry || '');
  const [address, setAddress] = useState((profile as any)?.address || '');
  const [website, setWebsite] = useState((profile as any)?.website || '');
  const [companyLogoUrl, setCompanyLogoUrl] = useState((profile as any)?.company_logo_url || '');
  const [companyDescription, setCompanyDescription] = useState((profile as any)?.company_description || '');
  const [employeeCount, setEmployeeCount] = useState((profile as any)?.employee_count || '');

  const isEmployer = userRole?.role === 'employer';

  const uploadProfileImage = async (file: File) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user?.id}/${Date.now()}-profile-image.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('profile-media')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Use public URL for profile media (no expiration)
      const { data: { publicUrl } } = supabase.storage
        .from('profile-media')
        .getPublicUrl(fileName);

      const imageUrl = `${publicUrl}?t=${Date.now()}`;
      
      // Förladdda bilden direkt i Service Worker
      const { preloadSingleFile } = await import('@/lib/serviceWorkerManager');
      await preloadSingleFile(imageUrl);
      
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
        updates.industry = industry.trim() || null;
        updates.address = address.trim() || null;
        updates.website = website.trim() || null;
        updates.company_logo_url = companyLogoUrl || null;
        updates.company_description = companyDescription.trim() || null;
        updates.employee_count = employeeCount || null;
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
    <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-accent/20 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl bg-card/90 backdrop-blur-sm border-white/10 shadow-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-foreground">Skapa din profil</CardTitle>
          <CardDescription className="text-muted-foreground">
            Fyll i din profilinformation för att komma igång
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Profile Image Section */}
            <div className="flex flex-col items-center space-y-4">
              <div className="relative">
                <ResolvedAvatar
                  src={profileImageUrl}
                  mediaType="profile-image"
                  fallback={<span className="text-lg">{profile?.first_name?.[0]}{profile?.last_name?.[0]}</span>}
                  className="h-24 w-24 ring-2 ring-primary/20"
                  fallbackClassName="bg-primary/10 text-foreground"
                />
                <label htmlFor="profile-image" className="absolute bottom-0 right-0 bg-primary text-primary-foreground rounded-full p-2 cursor-pointer hover:bg-primary/90 transition-colors shadow-lg">
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
                <User className="h-4 w-4 text-primary" />
                <Label className="text-base font-medium text-foreground">Personlig information</Label>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="bio" className="text-foreground">Kort presentation</Label>
                  <Textarea
                    id="bio"
                    placeholder={isEmployer ? "Berätta om ditt företag..." : "Berätta kort om dig själv..."}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    rows={3}
                    className="bg-background/50 border-white/10 hover:border-white/50 focus:border-primary/50"
                  />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="location" className="text-foreground">Plats</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="location"
                      placeholder="Stockholm, Sverige"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      className="pl-10 bg-background/50 border-white/10 hover:border-white/50 focus:border-primary/50"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-foreground">Telefon</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+46 70 123 45 67"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="bg-background/50 border-white/10 hover:border-white/50 focus:border-primary/50"
                    />
                </div>
              </div>
            </div>

            {/* Employer-specific fields */}
            {isEmployer && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <Building className="h-4 w-4 text-primary" />
                  <Label className="text-base font-medium text-foreground">Företagsinformation</Label>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="companyName" className="text-foreground">Företagsnamn *</Label>
                    <Input
                      id="companyName"
                      placeholder="Mitt Företag AB"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      required
                      className="bg-background/50 border-white/10 hover:border-white/50 focus:border-primary/50"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="orgNumber" className="text-foreground">Organisationsnummer</Label>
                    <Input
                      id="orgNumber"
                      placeholder="556123-4567"
                      value={orgNumber}
                      onChange={(e) => setOrgNumber(e.target.value)}
                      className="bg-background/50 border-white/10 hover:border-white/50 focus:border-primary/50"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="industry" className="text-foreground">Bransch *</Label>
                    <Select value={industry} onValueChange={setIndustry}>
                      <SelectTrigger className="bg-background/50 border-white/10 focus:border-primary/50">
                        <SelectValue placeholder="Välj bransch" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900/85 backdrop-blur-xl border border-white/20">
                        {SWEDISH_INDUSTRIES.map((ind) => (
                          <SelectItem key={ind} value={ind} className="hover:bg-primary/10">
                            {ind}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="employeeCount" className="text-foreground">Antal anställda</Label>
                    <Select value={employeeCount} onValueChange={setEmployeeCount}>
                      <SelectTrigger className="bg-background/50 border-white/10 focus:border-primary/50">
                        <SelectValue placeholder="Välj antal anställda" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900/85 backdrop-blur-xl border border-white/20">
                        {EMPLOYEE_COUNT_OPTIONS.map((count) => (
                          <SelectItem key={count} value={count} className="hover:bg-primary/10">
                            {count}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address" className="text-foreground">Adress *</Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="address"
                        placeholder="Storgatan 1, 123 45 Stockholm"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        className="pl-10 bg-background/50 border-white/10 focus:border-primary/50"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="website" className="text-foreground">Webbplats</Label>
                    <div className="relative">
                      <Globe className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="website"
                        placeholder="https://exempel.se"
                        value={website}
                        onChange={(e) => setWebsite(e.target.value)}
                        className="pl-10 bg-background/50 border-white/10 focus:border-primary/50"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="companyDescription" className="text-foreground">Kort beskrivning av företaget</Label>
                  <Textarea
                    id="companyDescription"
                    placeholder="Beskriv vad ert företag gör och er kultur i några meningar..."
                    value={companyDescription}
                    onChange={(e) => setCompanyDescription(e.target.value)}
                    rows={3}
                    className="bg-background/50 border-white/10 focus:border-primary/50"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-foreground">Företagslogotyp</Label>
                  <FileUpload
                    mediaType="company-logo"
                    onFileUploaded={(url) => setCompanyLogoUrl(url)}
                    onFileRemoved={() => setCompanyLogoUrl('')}
                    currentFile={companyLogoUrl ? { url: companyLogoUrl, name: "Företagslogotyp" } : undefined}
                    acceptedFileTypes={['image/*']}
                    maxFileSize={2 * 1024 * 1024}
                  />
                </div>
              </div>
            )}

            {/* CV Upload for job seekers */}
            {!isEmployer && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <Label className="text-base font-medium text-foreground">CV och dokument</Label>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-foreground">Ladda upp ditt CV (valfritt)</Label>
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
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-3" 
                disabled={loading}
              >
                {loading ? 'Sparar profil...' : 'Skapa profil'}
              </Button>
              
              <p className="text-sm text-muted-foreground text-center">
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