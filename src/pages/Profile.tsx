import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
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
import { useNavigate, useLocation } from 'react-router-dom';
import { createSignedUrl } from '@/utils/storageUtils';

const Profile = () => {
  const { profile, userRole, updateProfile, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const { hasUnsavedChanges, setHasUnsavedChanges } = useUnsavedChanges();
  const [loading, setLoading] = useState(false);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [originalValues, setOriginalValues] = useState<any>({});
  
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
  const [userLocation, setUserLocation] = useState(profile?.location || '');
  const [postalCode, setPostalCode] = useState('');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [birthDate, setBirthDate] = useState(profile?.birth_date || '');
  const [profileImageUrl, setProfileImageUrl] = useState(profile?.profile_image_url || '');
  const [cvUrl, setCvUrl] = useState((profile as any)?.cv_url || '');
  const [cvFileName, setCvFileName] = useState((profile as any)?.cv_filename || '');
  
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
      const values = {
        firstName: profile.first_name || '',
        lastName: profile.last_name || '',
        bio: profile.bio || '',
        userLocation: profile.location || '',
        postalCode: (profile as any)?.postal_code || '',
        phone: profile.phone || '',
        birthDate: profile.birth_date || '',
        profileImageUrl: profile.profile_image_url || '',
        cvUrl: (profile as any)?.cv_url || '',
        companyName: profile.company_name || '',
        orgNumber: profile.org_number || '',
        employmentStatus: (profile as any)?.employment_status || '',
        workingHours: (profile as any)?.working_hours || '',
        availability: (profile as any)?.availability || '',
      };

      setFirstName(values.firstName);
      setLastName(values.lastName);
      setBio(values.bio);
      setUserLocation(values.userLocation);
      setPostalCode(values.postalCode);
      setPhone(values.phone);
      setBirthDate(values.birthDate);
      setProfileImageUrl(values.profileImageUrl);
      setCvUrl(values.cvUrl);
      // Set filename from database or extract from URL for existing files
      if ((profile as any)?.cv_filename) {
        setCvFileName((profile as any).cv_filename);
      } else if (values.cvUrl) {
        // Extract filename from URL for legacy files
        // First try to get it from the storage path (not the signed URL)
        let extractedName = '';
        
        // Look for the storage path pattern: /storage/v1/object/sign/job-applications/user-id/timestamp-filename
        const storageMatch = values.cvUrl.match(/\/job-applications\/[^\/]+\/\d+-(.*?)(?:\?|$)/);
        if (storageMatch) {
          extractedName = storageMatch[1];
        } else {
          // Fallback: try to extract from the end of URL
          const urlParts = values.cvUrl.split('/');
          const lastPart = urlParts[urlParts.length - 1];
          const match = lastPart.match(/^\d+-(.+?)(?:\?|$)/);
          extractedName = match ? match[1] : lastPart.split('?')[0];
        }
        
        setCvFileName(extractedName || 'CV.pdf');
      } else {
        setCvFileName('');
      }
      setCompanyName(values.companyName);
      setOrgNumber(values.orgNumber);
      setEmploymentStatus(values.employmentStatus);
      setWorkingHours(values.workingHours);
      setAvailability(values.availability);

      // Store original values for comparison
      setOriginalValues(values);
      setHasUnsavedChanges(false);
    }
  }, [profile]);

  const checkForChanges = useCallback(() => {
    if (!originalValues.firstName) return false; // Not loaded yet
    
    const currentValues = {
      firstName,
      lastName,
      bio,
      userLocation,
      postalCode,
      phone,
      birthDate,
      profileImageUrl,
      cvUrl,
      companyName,
      orgNumber,
      employmentStatus,
      workingHours,
      availability,
    };

    const hasChanges = Object.keys(currentValues).some(
      key => currentValues[key] !== originalValues[key]
    );

    console.log('Checking for changes:', { 
      currentValues, 
      originalValues, 
      hasChanges,
      userLocation,
      originalLocation: originalValues.userLocation
    });
    setHasUnsavedChanges(hasChanges);
    return hasChanges;
  }, [originalValues, firstName, lastName, bio, userLocation, postalCode, phone, birthDate, 
      profileImageUrl, cvUrl, companyName, orgNumber, employmentStatus, workingHours, availability]);

  // Check for changes whenever form values change
  useEffect(() => {
    checkForChanges();
  }, [checkForChanges]);

  // Prevent leaving page with unsaved changes (browser/tab close)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = 'Du har osparade ändringar. Är du säker på att du vill lämna sidan?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  const isEmployer = userRole?.role === 'employer';

  // Hjälpfunktioner
  const countWords = (text: string) => {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  };

  const handleBioChange = (value: string) => {
    const wordCount = countWords(value);
    if (wordCount <= 100) {
      setBio(value);
      setHasUnsavedChanges(true);
    }
  };

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
      const fileName = `${user?.id}/${Date.now()}-profile-media.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('job-applications')
        .upload(fileName, file);
      
      if (uploadError) throw uploadError;
      
      // Use signed URL for secure access
      const signedUrl = await createSignedUrl('job-applications', fileName, 86400); // 24 hours
      if (!signedUrl) {
        throw new Error('Could not create secure access URL');
      }
      
      const mediaUrl = `${signedUrl}&t=${Date.now()}`;
      
      // Update local state instead of saving immediately
      if (isVideo) {
        setProfileImageUrl(mediaUrl); // Store video URL in profileImageUrl for now
        // Clear cover image if it was a video file
        if (!profile?.profile_image_url || profile.profile_image_url.includes('.MP4') || profile.profile_image_url.includes('.mp4')) {
          setCoverImageUrl('');
        }
      } else {
        setProfileImageUrl(mediaUrl);
        setCoverImageUrl(''); // Clear cover when uploading profile image
      }
      
      // Mark as having unsaved changes
      setHasUnsavedChanges(true);
      
      toast({
        title: `${isVideo ? 'Video' : 'Bild'} uppladdad!`,
        description: `Tryck på "Spara ändringar" för att spara din profil${isVideo ? 'video' : 'bild'}.`
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
      const fileName = `${user?.id}/${Date.now()}-cover-image.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('job-applications')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Use signed URL for secure access  
      const signedUrl = await createSignedUrl('job-applications', fileName, 86400); // 24 hours
      if (!signedUrl) {
        throw new Error('Could not create secure access URL');
      }
      
      const coverUrl = `${signedUrl}&t=${Date.now()}`;
      
      // Update local state instead of saving immediately
      setCoverImageUrl(coverUrl);
      
      // Mark as having unsaved changes
      setHasUnsavedChanges(true);
      
      toast({
        title: "Cover-bild uppladdad!",
        description: "Tryck på \"Spara ändringar\" för att spara din cover-bild."
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
      // Förbättrad video-validering med specifika felmeddelanden (samma som WelcomeTunnel)
      let proceeded = false;
      let metadataAttempted = false;
      
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.crossOrigin = 'anonymous';

      const revoke = () => {
        try { URL.revokeObjectURL(video.src); } catch {}
      };

      const showError = (title: string, description: string) => {
        toast({ title, description, variant: "destructive" });
      };

      video.onloadedmetadata = () => {
        revoke();
        if (proceeded) return;
        proceeded = true;
        metadataAttempted = true;
        
        console.log('Video duration:', video.duration, 'seconds');
        
        if (!Number.isFinite(video.duration) || video.duration <= 0) {
          showError(
            "Ogiltig videofil",
            "Videon har ingen giltig längdning. Välj en annan fil."
          );
        } else if (video.duration > 30) {
          showError(
            "Video för lång",
            `Videon är ${Math.round(video.duration)} sekunder. Max 30 sekunder tillåtet.`
          );
        } else {
          uploadProfileMedia(file);
        }
      };

      video.onerror = (e) => {
        revoke();
        if (proceeded) return;
        proceeded = true;
        
        console.error('Video error:', e);
        showError(
          "Ogiltig videofil", 
          "Filen är skadad eller har ett format som inte stöds."
        );
      };

      setTimeout(() => {
        if (!proceeded) {
          revoke();
          proceeded = true;
          
          if (!metadataAttempted) {
            showError(
              "Timeout vid videoladdning",
              "Filen är för stor eller saknas. Prova med en mindre videofil."
            );
          }
        }
      }, 8000);

      video.onloadstart = () => {
        console.log('Started loading video metadata...');
      };

      video.onprogress = () => {
        console.log('Loading video metadata...');
      };

      try {
        video.src = URL.createObjectURL(file);
      } catch (error) {
        showError(
          "Fel vid filhantering",
          "Kunde inte läsa videofilen. Kontrollera att det är en giltig videofil."
        );
      }
    } else if (file.type.startsWith('image/')) {
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

      const fileName = `${user.data.user.id}/${Date.now()}-profile-image.jpg`;
      
      const { error: uploadError } = await supabase.storage
        .from('job-applications')
        .upload(fileName, editedBlob);

      if (uploadError) throw uploadError;

      // Use signed URL for secure access
      const signedUrl = await createSignedUrl('job-applications', fileName, 86400); // 24 hours
      if (!signedUrl) {
        throw new Error('Could not create secure access URL');
      }

      const imageUrl = `${signedUrl}&t=${Date.now()}`;
      
      // Update local state instead of saving immediately
      setProfileImageUrl(imageUrl);
      setCoverImageUrl(''); // Clear cover when uploading profile image
      
      setImageEditorOpen(false);
      setPendingImageSrc('');
      
      // Mark as having unsaved changes
      setHasUnsavedChanges(true);
      
      toast({
        title: "Profilbild uppladdad!",
        description: "Tryck på \"Spara ändringar\" för att spara din profilbild."
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

      const fileName = `${user.data.user.id}/${Date.now()}-cover-image.jpg`;
      
      const { error: uploadError } = await supabase.storage
        .from('job-applications')
        .upload(fileName, editedBlob);

      if (uploadError) throw uploadError;

      // Use signed URL for secure access
      const signedUrl = await createSignedUrl('job-applications', fileName, 86400); // 24 hours
      if (!signedUrl) {
        throw new Error('Could not create secure access URL');
      }

      const coverUrl = `${signedUrl}&t=${Date.now()}`;
      
      // Update local state instead of saving immediately
      setCoverImageUrl(coverUrl);
      
      setCoverEditorOpen(false);
      setPendingCoverSrc('');
      
      // Mark as having unsaved changes
      setHasUnsavedChanges(true);
      
      toast({
        title: "Cover-bild uppladdad!",
        description: "Tryck på \"Spara ändringar\" för att spara din cover-bild."
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
    
    // Mark as having unsaved changes
    setHasUnsavedChanges(true);
    
    toast({
      title: "Profilbild/video borttagen!",
      description: "Tryck på \"Spara ändringar\" för att spara ändringen."
    });
  };

  const deleteCoverImage = () => {
    setCoverImageUrl('');
    
    // Mark as having unsaved changes
    setHasUnsavedChanges(true);
    
    toast({
      title: "Cover-bild borttagen!", 
      description: "Tryck på \"Spara ändringar\" för att spara ändringen."
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
        location: userLocation.trim() || null,
        postal_code: postalCode.trim() || null,
        phone: phone.trim() || null,
        birth_date: birthDate || null,
        cv_url: cvUrl || null,
        cv_filename: cvFileName || null,
        employment_status: employmentStatus || null,
        working_hours: workingHours || null,
        availability: availability || null,
      };

      // Handle profile image/video updates
      if (profileImageUrl && (profileImageUrl.includes('.MP4') || profileImageUrl.includes('.mp4'))) {
        // It's a video
        updates.video_url = profileImageUrl;
        // Use cover image if available, or clear profile_image_url
        updates.profile_image_url = coverImageUrl || null;
      } else {
        // It's an image or no media
        updates.profile_image_url = profileImageUrl || null;
        updates.video_url = null;
      }

      if (isEmployer) {
        updates.company_name = companyName.trim() || null;
        updates.org_number = orgNumber.trim() || null;
      }

      const result = await updateProfile(updates);
      
      if (!result.error) {
        // Update original values after successful save
        const newOriginalValues = {
          firstName: firstName,
          lastName: lastName,
          bio: bio,
          location: userLocation,
          postalCode: postalCode,
          phone: phone,
          birthDate: birthDate,
          profileImageUrl: profileImageUrl,
          cvUrl: cvUrl,
          companyName: companyName,
          orgNumber: orgNumber,
          employmentStatus: employmentStatus,
          workingHours: workingHours,
          availability: availability,
        };
        setOriginalValues(newOriginalValues);
        setHasUnsavedChanges(false);
        
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
      <div className="text-center">
        <h1 className="text-3xl font-bold text-white">Min Profil</h1>
        <p className="text-white">
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
            <CardDescription className="text-white text-center">
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
            <div className="relative">
              {profile?.video_url ? (
                <ProfileVideo
                  videoUrl={profile.video_url}
                  coverImageUrl={profile.profile_image_url || undefined}
                  alt="Profile video"
                  className="w-32 h-32 border-4 border-white/20 hover:border-white/40 transition-all rounded-full overflow-hidden"
                />
              ) : (
                <div 
                  className="cursor-pointer" 
                  onClick={() => document.getElementById('profile-image')?.click()}
                >
                  <Avatar className="h-32 w-32 border-4 border-white/20 hover:border-white/40 transition-all">
                    <AvatarImage src={profileImageUrl} />
                    <AvatarFallback className="text-2xl bg-white/20 text-white">
                      {profile?.first_name?.[0]}{profile?.last_name?.[0]}
                    </AvatarFallback>
                  </Avatar>
                </div>
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
              <div className="flex flex-col items-center space-y-3 mt-4 p-4 rounded-lg bg-white/5 w-full">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => document.getElementById('cover-image')?.click()}
                  disabled={isUploadingCover}
                  className="bg-white/20 border-white/30 text-white hover:bg-white/30 disabled:opacity-50 transition-all duration-200"
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
                  <div className="flex flex-col items-center w-full">
                    <Badge variant="secondary" className="bg-blue-500/20 text-blue-100 text-xs animate-pulse">
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-100 mr-1"></div>
                      Laddar upp cover-bild...
                    </Badge>
                  </div>
                )}
                
                {profile?.profile_image_url && !isUploadingCover && (
                  <div className="flex flex-col items-center space-y-2 w-full">
                     <div className="flex items-center gap-2">
                       <Badge variant="secondary" className="bg-white/20 text-white text-xs font-normal ml-6 whitespace-nowrap">
                         <Check className="h-3 w-3 mr-1" />
                         Cover-bild uppladdad!
                       </Badge>
                      <button
                        onClick={deleteCoverImage}
                        className="bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white rounded-full p-1.5 shadow-lg transition-colors"
                        title="Ta bort cover-bild"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
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
            <CardDescription className="text-white">
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
                    <Input
                      id="birthDate"
                      type="date"
                      value={birthDate}
                      onChange={(e) => setBirthDate(e.target.value)}
                    />
                    {age !== null && (
                      <p className="text-sm text-white">Ålder: {age} år</p>
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
                    <div className="relative group">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground z-10" />
                      <div className="flex h-10 w-full rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm text-foreground min-w-0">
                        <span 
                          className="truncate hover:overflow-visible hover:whitespace-normal hover:break-all transition-all duration-200" 
                          title={user?.email || ''}
                        >
                          {user?.email || ''}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <PostalCodeSelector
                      postalCodeValue={postalCode}
                      onPostalCodeChange={setPostalCode}
                      onLocationChange={setUserLocation}
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
                  onChange={(e) => handleBioChange(e.target.value)}
                  rows={4}
                />
                <div className="flex justify-end">
                  <span className="text-xs text-white/70">
                    {countWords(bio)}/100 ord
                  </span>
                </div>
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
                      <Label className="text-base font-medium text-white">CV</Label>
                    </div>
                    <FileUpload
                      onFileUploaded={(url, fileName) => {
                        setCvUrl(url);
                        setCvFileName(fileName);
                      }}
                      onFileRemoved={() => {
                        setCvUrl('');
                        setCvFileName('');
                      }}
                      currentFile={cvUrl ? { url: cvUrl, name: cvFileName || 'CV.pdf' } : undefined}
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