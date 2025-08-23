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
import { User, MapPin, Building, Camera, Mail, Phone, Calendar, Briefcase, Clock, FileText, Video, Play, Check, Trash2 } from 'lucide-react';
import FileUpload from '@/components/FileUpload';
import ProfileVideo from '@/components/ProfileVideo';
import ImageEditor from '@/components/ImageEditor';
import PostalCodeSelector from '@/components/PostalCodeSelector';

const Profile = () => {
  const { profile, userRole, updateProfile, user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  
  // Image editor states
  const [imageEditorOpen, setImageEditorOpen] = useState(false);
  const [coverEditorOpen, setCoverEditorOpen] = useState(false);
  const [pendingImageSrc, setPendingImageSrc] = useState<string>('');
  const [pendingCoverSrc, setPendingCoverSrc] = useState<string>('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  
  // Basic form fields
  const [firstName, setFirstName] = useState(profile?.first_name || '');
  const [lastName, setLastName] = useState(profile?.last_name || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [location, setLocation] = useState(profile?.location || '');
  const [postalCode, setPostalCode] = useState('');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [birthDate, setBirthDate] = useState(profile?.birth_date || '');
  const [profileImageUrl, setProfileImageUrl] = useState(profile?.profile_image_url || '');
  const [cvUrl, setCvUrl] = useState((profile as any)?.cv_url || '');
  
  // Extended profile fields that we'll need to add to database
  const [employmentStatus, setEmploymentStatus] = useState('');
  const [workingHours, setWorkingHours] = useState('');
  const [availability, setAvailability] = useState('');
  
  
  // Employer-specific fields
  const [companyName, setCompanyName] = useState(profile?.company_name || '');
  const [orgNumber, setOrgNumber] = useState(profile?.org_number || '');

  // Load profile data when profile changes
  useEffect(() => {
    if (profile) {
      setFirstName(profile.first_name || '');
      setLastName(profile.last_name || '');
      setBio(profile.bio || '');
      setLocation(profile.location || '');
      setPostalCode((profile as any)?.postal_code || '');
      setPhone(profile.phone || '');
      setBirthDate(profile.birth_date || '');
      setProfileImageUrl(profile.profile_image_url || '');
      setCvUrl((profile as any)?.cv_url || '');
      setCompanyName(profile.company_name || '');
      setOrgNumber(profile.org_number || '');
      
      // Load extended fields if they exist
      setEmploymentStatus((profile as any)?.employment_status || '');
      setWorkingHours((profile as any)?.working_hours || '');
      setAvailability((profile as any)?.availability || '');
    }
  }, [profile]);

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


  const uploadProfileMedia = async (file: File) => {
    const isVideo = file.type.startsWith('video/');
    if (isVideo) setIsUploadingVideo(true);
    
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user?.id}/profile-media.${fileExt}`;
      
      await supabase.storage.from('job-applications').remove([fileName]);
      
      const { error: uploadError } = await supabase.storage
        .from('job-applications')
        .upload(fileName, file, { upsert: true });
      
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage
        .from('job-applications')
        .getPublicUrl(fileName);
      
      const mediaUrl = `${publicUrl}?t=${Date.now()}`;
      
      // Update the profile with the correct fields based on file type
      const updates: any = {};
      if (isVideo) {
        updates.video_url = mediaUrl;
        // Keep existing profile_image_url if it exists (as cover image)
        if (!profile?.profile_image_url || profile.profile_image_url.includes('.MP4') || profile.profile_image_url.includes('.mp4')) {
          updates.profile_image_url = null;
        }
      } else {
        updates.profile_image_url = mediaUrl;
        updates.video_url = null; // Clear video when uploading image
      }

      await updateProfile(updates);
      
      toast({
        title: `Profil${isVideo ? 'video' : 'bild'} uppladdad!`,
        description: `Din profil${isVideo ? 'video' : 'bild'} har uppdaterats.`
      });
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Fel vid uppladdning",
        description: "Kunde inte ladda upp filen.",
        variant: "destructive"
      });
    } finally {
      if (isVideo) setIsUploadingVideo(false);
    }
  };

  const uploadCoverImage = async (file: File) => {
    setIsUploadingCover(true);
    
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user?.id}/cover-image.${fileExt}`;
      
      await supabase.storage.from('job-applications').remove([fileName]);
      
      const { error: uploadError } = await supabase.storage
        .from('job-applications')
        .upload(fileName, file, { upsert: true });
      
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage
        .from('job-applications')
        .getPublicUrl(fileName);
      
      const coverUrl = `${publicUrl}?t=${Date.now()}`;
      
      setCoverImageUrl(coverUrl);
      
      // Update profile with cover image - use the profile_image_url for video covers
      if (profile?.video_url) {
        await updateProfile({ profile_image_url: coverUrl });
      }
      
      toast({
        title: "Cover-bild uppladdad!",
        description: "Din cover-bild har uppdaterats."
      });
    } catch (error) {
      console.error('Cover upload error:', error);
      toast({
        title: "Fel vid uppladdning",
        description: "Kunde inte ladda upp cover-bilden.",
        variant: "destructive"
      });
    } finally {
      setIsUploadingCover(false);
    }
  };

  const handleMediaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith('video/')) {
      // Handle video upload with duration check
      const video = document.createElement('video');
      video.preload = 'metadata';
      
      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(video.src);
        if (video.duration <= 30) { // Max 30 seconds
          uploadProfileMedia(file);
        } else {
          toast({
            title: "Video för lång",
            description: "Videon får vara max 30 sekunder lång.",
            variant: "destructive"
          });
        }
      };
      
      video.src = URL.createObjectURL(file);
    } else if (file.type.startsWith('image/')) {
      // Handle image - open editor
      const imageUrl = URL.createObjectURL(file);
      setPendingImageSrc(imageUrl);
      setImageEditorOpen(true);
    }
  };

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith('image/')) {
      const imageUrl = URL.createObjectURL(file);
      setPendingCoverSrc(imageUrl);
      setCoverEditorOpen(true);
    }
  };

  const handleProfileImageSave = async (editedBlob: Blob) => {
    try {
      setIsUploadingVideo(true);
      
      const user = await supabase.auth.getUser();
      if (!user.data.user) throw new Error('User not authenticated');

      const fileName = `${user.data.user.id}/profile-image.jpg`;
      
      await supabase.storage.from('job-applications').remove([fileName]);
      
      const { error: uploadError } = await supabase.storage
        .from('job-applications')
        .upload(fileName, editedBlob, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('job-applications')
        .getPublicUrl(fileName);

      const imageUrl = `${publicUrl}?t=${Date.now()}`;
      
      await updateProfile({ 
        profile_image_url: imageUrl,
        video_url: null // Clear video when uploading image
      });
      
      setImageEditorOpen(false);
      setPendingImageSrc('');
      
      toast({
        title: "Profilbild uppladdad!",
        description: "Din profilbild har uppdaterats."
      });
    } catch (error) {
      console.error('Profile image upload error:', error);
      toast({
        title: "Fel vid uppladdning",
        description: "Kunde inte ladda upp profilbilden.",
        variant: "destructive"
      });
    } finally {
      setIsUploadingVideo(false);
    }
  };

  const handleCoverImageSave = async (editedBlob: Blob) => {
    try {
      setIsUploadingCover(true);
      
      const user = await supabase.auth.getUser();
      if (!user.data.user) throw new Error('User not authenticated');

      const fileName = `${user.data.user.id}/cover-image.jpg`;
      
      await supabase.storage.from('job-applications').remove([fileName]);
      
      const { error: uploadError } = await supabase.storage
        .from('job-applications')
        .upload(fileName, editedBlob, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('job-applications')
        .getPublicUrl(fileName);

      const coverUrl = `${publicUrl}?t=${Date.now()}`;
      
      setCoverImageUrl(coverUrl);
      
      // Update profile with cover image - use the profile_image_url for video covers
      if (profile?.video_url) {
        await updateProfile({ profile_image_url: coverUrl });
      }
      
      setCoverEditorOpen(false);
      setPendingCoverSrc('');
      
      toast({
        title: "Cover-bild uppladdad!",
        description: "Din cover-bild har uppdaterats."
      });
    } catch (error) {
      console.error('Cover upload error:', error);
      toast({
        title: "Fel vid uppladdning",
        description: "Kunde inte ladda upp cover-bilden.",
        variant: "destructive"
      });
    } finally {
      setIsUploadingCover(false);
    }
  };

  const deleteProfileMedia = () => {
    setProfileImageUrl('');
    
    // Reset the file input to allow new uploads
    const fileInput = document.getElementById('profile-image') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
    
    // Update profile to clear both image and video
    updateProfile({
      profile_image_url: null,
      video_url: null
    });
    
    toast({
      title: "Media borttagen",
      description: "Din profilbild/video har tagits bort."
    });
  };

  const deleteCoverImage = () => {
    setCoverImageUrl('');
    
    // If there's a video, clear the profile_image_url (cover image)
    if (profile?.video_url) {
      updateProfile({ profile_image_url: null });
    }
    
    toast({
      title: "Cover-bild borttagen", 
      description: "Din cover-bild har tagits bort."
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const updates: any = {
        first_name: firstName.trim() || null,
        last_name: lastName.trim() || null,
        bio: bio.trim() || null,
        location: location.trim() || null,
        postal_code: postalCode.trim() || null,
        phone: phone.trim() || null,
        birth_date: birthDate || null,
        profile_image_url: profileImageUrl || null,
        cv_url: cvUrl || null,
        employment_status: employmentStatus || null,
        working_hours: workingHours || null,
        availability: availability || null,
      };

      if (isEmployer) {
        updates.company_name = companyName.trim() || null;
        updates.org_number = orgNumber.trim() || null;
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
        <h1 className="text-3xl font-bold text-white">Min Profil</h1>
        <p className="text-white/70">
          Hantera din profilinformation och inställningar
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Image/Video Card */}
        <Card className="bg-white/10 backdrop-blur-sm border-white/20">
          <CardHeader>
            <CardTitle className="text-white text-center">
              Profilbild/Profilvideo
            </CardTitle>
            <CardDescription className="text-white/70 text-center">
              Ladda upp en kort profilvideo eller en bild och gör ditt första intryck minnesvärt.
            </CardDescription>
            
            {/* Video and Camera Icons */}
            <div className="flex items-center justify-center space-x-4">
              {/* Video option */}
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-white/20 p-2 bg-gradient-to-b from-white/10 to-white/5 backdrop-blur-sm">
                  <div className="relative w-full h-full rounded-full bg-gradient-to-b from-primary/30 to-primary/50 overflow-hidden flex items-center justify-center">
                    <Video className="h-5 w-5 text-white" />
                  </div>
                </div>
                <div className="absolute -top-1 -right-1 bg-white rounded-full p-1 shadow-lg">
                  <Play className="h-2 w-2 text-primary animate-pulse" />
                </div>
              </div>

              {/* "eller" text */}
              <div className="text-white/80 text-sm font-medium flex-shrink-0">
                eller
              </div>

              {/* Image option */}
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-white/20 p-2 bg-gradient-to-b from-white/10 to-white/5 backdrop-blur-sm">
                  <div className="relative w-full h-full rounded-full bg-gradient-to-b from-primary/30 to-primary/50 overflow-hidden flex items-center justify-center">
                    <Camera className="h-5 w-5 text-white" />
                  </div>
                </div>
                <div className="absolute -top-1 -right-1 bg-white rounded-full p-1 shadow-lg">
                  <Camera className="h-2 w-2 text-primary" />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col items-center space-y-4">
            <div 
              className="relative cursor-pointer" 
              onClick={() => document.getElementById('profile-image')?.click()}
            >
              {profile?.video_url ? (
                <ProfileVideo
                  videoUrl={profile.video_url}
                  coverImageUrl={profile.profile_image_url || undefined}
                  alt="Profile video"
                  className="w-32 h-32 border-4 border-white/20 hover:border-white/40 transition-all rounded-full overflow-hidden"
                />
              ) : (
                <Avatar className="h-32 w-32 border-4 border-white/20 hover:border-white/40 transition-all">
                  <AvatarImage src={profileImageUrl} />
                  <AvatarFallback className="text-2xl bg-white/20 text-white">
                    {profile?.first_name?.[0]}{profile?.last_name?.[0]}
                  </AvatarFallback>
                </Avatar>
              )}

              {/* Delete icon for profile media */}
              {(profile?.video_url || profileImageUrl) && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteProfileMedia();
                  }}
                  className="absolute -top-2 -right-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white rounded-full p-2 shadow-lg transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}

              <input
                id="profile-image"
                type="file"
                accept="image/*,video/*"
                onChange={handleMediaChange}
                className="hidden"
                disabled={isUploadingVideo}
              />
            </div>

            <div className="space-y-2 text-center">
              <Label 
                htmlFor="profile-image" 
                className="text-white/70 cursor-pointer hover:text-white transition-colors text-center text-sm"
              >
                Klicka för att välja en bild eller video (max 30 sek)
              </Label>
              
              {isUploadingVideo && (
                <Badge variant="secondary" className="bg-blue-500/20 text-blue-100 animate-pulse">
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-100 mr-2"></div>
                  Laddar upp video...
                </Badge>
              )}
              
              {(profile?.video_url || profileImageUrl) && !isUploadingVideo && (
                <Badge variant="secondary" className="bg-white/20 text-white">
                  <Check className="h-3 w-3 mr-1" />
                  {profile?.video_url ? 'Video' : 'Bild'} uppladdad!
                </Badge>
              )}
            </div>

            {/* Cover image upload for videos */}
            {profile?.video_url && (
              <div className="flex flex-col items-center space-y-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => document.getElementById('cover-image')?.click()}
                  disabled={isUploadingCover}
                  className="bg-white/20 border-white/30 text-white hover:bg-white/30 disabled:opacity-50"
                >
                  {profile?.profile_image_url ? 'Ändra cover-bild' : 'Lägg till cover-bild'}
                </Button>
                <Input 
                  type="file" 
                  id="cover-image" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={handleCoverChange} 
                  disabled={isUploadingCover} 
                />
                
                {isUploadingCover && (
                  <Badge variant="secondary" className="bg-blue-500/20 text-blue-100 text-xs animate-pulse">
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-100 mr-1"></div>
                    Laddar upp cover-bild...
                  </Badge>
                )}
                
                {profile?.profile_image_url && !isUploadingCover && (
                  <div className="flex items-center justify-center gap-2">
                    <Badge variant="secondary" className="bg-white/20 text-white text-xs">
                      <Check className="h-3 w-3 mr-1" />
                      Cover-bild uppladdad!
                    </Badge>
                    <button
                      onClick={deleteCoverImage}
                      className="bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white rounded-full p-1.5 shadow-lg transition-colors"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Profile Information */}
        <Card className="lg:col-span-2 bg-white/10 backdrop-blur-sm border-white/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <User className="h-5 w-5" />
              Profilinformation
            </CardTitle>
            <CardDescription className="text-white/70">
              Uppdatera din personliga information
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Personal Information */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <User className="h-4 w-4 text-white" />
                  <Label className="text-base font-medium text-white">Personlig information</Label>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName" className="text-white">Förnamn</Label>
                    <Input
                      id="firstName"
                      placeholder="Förnamn"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="lastName" className="text-white">Efternamn</Label>
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
                    <Label htmlFor="birthDate" className="text-white">Födelsedatum</Label>
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
                      <p className="text-sm text-white/70">Ålder: {age} år</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-white">Telefon</Label>
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
              <div className="space-y-4 pt-4 border-t border-white/20">
                <div className="flex items-center gap-2 mb-2">
                  <Mail className="h-4 w-4 text-white" />
                  <Label className="text-base font-medium text-white">Kontaktinformation</Label>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-white">E-post</Label>
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
                    <PostalCodeSelector
                      postalCodeValue={postalCode}
                      onPostalCodeChange={setPostalCode}
                      onLocationChange={setLocation}
                    />
                  </div>
                </div>
              </div>

              {/* Bio */}
              <div className="space-y-2 pt-4 border-t border-white/20">
                <Label htmlFor="bio" className="text-white">Presentation</Label>
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
                  <div className="space-y-4 pt-4 border-t border-white/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Briefcase className="h-4 w-4 text-white" />
                      <Label className="text-base font-medium text-white">Anställningsinformation</Label>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="employmentStatus" className="text-white">Anställningsstatus</Label>
                        <Select value={employmentStatus} onValueChange={setEmploymentStatus}>
                          <SelectTrigger>
                            <SelectValue placeholder="Välj din nuvarande situation" />
                          </SelectTrigger>
                          <SelectContent className="bg-white z-50">
                            <SelectItem value="tillsvidareanställning">Fast anställning</SelectItem>
                            <SelectItem value="visstidsanställning">Visstidsanställning</SelectItem>
                            <SelectItem value="provanställning">Provanställning</SelectItem>
                            <SelectItem value="interim">Interim anställning</SelectItem>
                            <SelectItem value="bemanningsanställning">Bemanningsanställning</SelectItem>
                            <SelectItem value="egenforetagare">Egenföretagare / Frilans</SelectItem>
                            <SelectItem value="arbetssokande">Arbetssökande</SelectItem>
                            <SelectItem value="annat">Annat</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Visa arbetstid endast om användaren har valt något OCH det inte är arbetssökande */}
                      {employmentStatus && employmentStatus !== 'arbetssokande' && (
                        <div className="space-y-2">
                          <Label htmlFor="workingHours" className="text-white">Hur mycket jobbar du idag?</Label>
                          <Select value={workingHours} onValueChange={setWorkingHours}>
                            <SelectTrigger>
                              <SelectValue placeholder="Välj arbetstid/omfattning" />
                            </SelectTrigger>
                            <SelectContent className="bg-white z-50">
                              <SelectItem value="heltid">Heltid</SelectItem>
                              <SelectItem value="deltid">Deltid</SelectItem>
                              <SelectItem value="varierande">Varierande / Flexibelt</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>

                    {/* Visa tillgänglighet endast om användaren har valt något i anställningsstatus */}
                    {employmentStatus && (
                      <div className="space-y-2">
                        <Label htmlFor="availability" className="text-white">När kan du börja nytt jobb?</Label>
                        <Select value={availability} onValueChange={setAvailability}>
                          <SelectTrigger>
                            <SelectValue placeholder="Välj din tillgänglighet" />
                          </SelectTrigger>
                          <SelectContent className="bg-white z-50">
                            <SelectItem value="omgaende">Omgående</SelectItem>
                            <SelectItem value="inom-1-manad">Inom 1 månad</SelectItem>
                            <SelectItem value="inom-3-manader">Inom 3 månader</SelectItem>
                            <SelectItem value="osaker">Osäker</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4 pt-4 border-t border-white/20">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-4 w-4 text-white" />
                      <Label className="text-base font-medium text-white">CV och dokument</Label>
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

              {/* Employer-specific fields */}
              {isEmployer && (
                <div className="space-y-4 pt-4 border-t border-white/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Building className="h-4 w-4 text-white" />
                    <Label className="text-base font-medium text-white">Företagsinformation</Label>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="companyName" className="text-white">Företagsnamn</Label>
                      <Input
                        id="companyName"
                        placeholder="Mitt Företag AB"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="orgNumber" className="text-white">Organisationsnummer</Label>
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

      {/* Image Editors */}
      <ImageEditor
        isOpen={imageEditorOpen}
        onClose={() => {
          setImageEditorOpen(false);
          setPendingImageSrc('');
        }}
        imageSrc={pendingImageSrc}
        onSave={handleProfileImageSave}
      />

      <ImageEditor
        isOpen={coverEditorOpen}
        onClose={() => {
          setCoverEditorOpen(false);
          setPendingCoverSrc('');
        }}
        imageSrc={pendingCoverSrc}
        onSave={handleCoverImageSave}
      />
    </div>
  );
};

export default Profile;