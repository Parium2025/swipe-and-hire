import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { User, MapPin, Building, Camera, Mail, Phone, Calendar, Briefcase, Clock, Heart, FileText } from 'lucide-react';
import FileUpload from '@/components/FileUpload';

const Profile = () => {
  const { profile, userRole, updateProfile, user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  // Basic form fields
  const [firstName, setFirstName] = useState(profile?.first_name || '');
  const [lastName, setLastName] = useState(profile?.last_name || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [location, setLocation] = useState(profile?.location || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [birthDate, setBirthDate] = useState(profile?.birth_date || '');
  const [profileImageUrl, setProfileImageUrl] = useState(profile?.profile_image_url || '');
  const [cvUrl, setCvUrl] = useState((profile as any)?.cv_url || '');
  
  // Extended profile fields that we'll need to add to database
  const [homeLocation, setHomeLocation] = useState('');
  const [employmentStatus, setEmploymentStatus] = useState('');
  const [workingHours, setWorkingHours] = useState('');
  const [availability, setAvailability] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  
  // Employer-specific fields
  const [companyName, setCompanyName] = useState(profile?.company_name || '');
  const [orgNumber, setOrgNumber] = useState(profile?.org_number || '');

  const isEmployer = userRole?.role === 'employer';

  // Calculate age from birth date
  const calculateAge = (birthDate: string) => {
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

  const age = calculateAge(birthDate);

  // Interest options (same as in WelcomeTunnel)
  const availableInterests = ['Frontend', 'Backend', 'Design', 'Marknadsföring', 'Sälj', 'HR'];

  const toggleInterest = (interest: string) => {
    setInterests(prev => 
      prev.includes(interest) 
        ? prev.filter(i => i !== interest)
        : [...prev, interest]
    );
  };

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
              {/* Personal Information */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <User className="h-4 w-4" />
                  <Label className="text-base font-medium">Personlig information</Label>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">Förnamn</Label>
                    <Input
                      id="firstName"
                      placeholder="Förnamn"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="lastName">Efternamn</Label>
                    <Input
                      id="lastName"
                      placeholder="Efternamn"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="birthDate">Födelsedatum</Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="birthDate"
                        type="date"
                        value={birthDate}
                        onChange={(e) => setBirthDate(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    {age !== null && (
                      <p className="text-sm text-muted-foreground">Ålder: {age} år</p>
                    )}
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
              </div>

              {/* Contact Information */}
              <div className="space-y-4 pt-4 border-t">
                <div className="flex items-center gap-2 mb-2">
                  <Mail className="h-4 w-4" />
                  <Label className="text-base font-medium">Kontaktinformation</Label>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                </div>
              </div>

              {/* Bio */}
              <div className="space-y-2 pt-4 border-t">
                <Label htmlFor="bio">Presentation</Label>
                <Textarea
                  id="bio"
                  placeholder={isEmployer ? "Berätta om ditt företag..." : "Berätta kort om dig själv..."}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={4}
                />
              </div>

              {/* Job Seeker Specific Information */}
              {!isEmployer && (
                <>
                  <div className="space-y-4 pt-4 border-t">
                    <div className="flex items-center gap-2 mb-2">
                      <Briefcase className="h-4 w-4" />
                      <Label className="text-base font-medium">Anställningsinformation</Label>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="employmentStatus">Anställningsstatus</Label>
                        <Select value={employmentStatus} onValueChange={setEmploymentStatus}>
                          <SelectTrigger>
                            <SelectValue placeholder="Välj status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="anställd">Anställd</SelectItem>
                            <SelectItem value="arbetssokande">Arbetssökande</SelectItem>
                            <SelectItem value="student">Student</SelectItem>
                            <SelectItem value="konsult">Konsult</SelectItem>
                            <SelectItem value="egen_foretagare">Egen företagare</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="workingHours">Arbetstid</Label>
                        <Select value={workingHours} onValueChange={setWorkingHours}>
                          <SelectTrigger>
                            <SelectValue placeholder="Välj arbetstid" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="heltid">Heltid</SelectItem>
                            <SelectItem value="deltid">Deltid</SelectItem>
                            <SelectItem value="konsultbasis">Konsultbasis</SelectItem>
                            <SelectItem value="praktik">Praktik</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="availability">Tillgänglighet</Label>
                      <Select value={availability} onValueChange={setAvailability}>
                        <SelectTrigger>
                          <SelectValue placeholder="Välj tillgänglighet" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="omgaende">Omgående</SelectItem>
                          <SelectItem value="inom_2_veckor">Inom 2 veckor</SelectItem>
                          <SelectItem value="inom_1_manad">Inom 1 månad</SelectItem>
                          <SelectItem value="enligt_overenskommelse">Enligt överenskommelse</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t">
                    <div className="flex items-center gap-2 mb-2">
                      <Heart className="h-4 w-4" />
                      <Label className="text-base font-medium">Intressen</Label>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {availableInterests.map(interest => (
                        <Button
                          key={interest}
                          type="button"
                          variant={interests.includes(interest) ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => toggleInterest(interest)}
                          className="justify-start"
                        >
                          {interest}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-4 w-4" />
                      <Label className="text-base font-medium">CV och dokument</Label>
                    </div>
                    <FileUpload
                      onFileUploaded={(url, fileName) => setCvUrl(url)}
                      onFileRemoved={() => setCvUrl('')}
                      currentFile={cvUrl ? { url: cvUrl, name: 'CV.pdf' } : undefined}
                      acceptedFileTypes={['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']}
                      maxFileSize={5 * 1024 * 1024}
                    />
                  </div>
                </>
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