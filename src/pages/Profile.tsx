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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { User, MapPin, Building, Camera, Mail, Phone, Calendar as CalendarIcon, Briefcase, Clock, FileText, Video, Play, Check, Trash2, ChevronDown } from 'lucide-react';
import FileUpload from '@/components/FileUpload';
import ProfileVideo from '@/components/ProfileVideo';
import ImageEditor from '@/components/ImageEditor';
import PostalCodeSelector from '@/components/PostalCodeSelector';
import { BirthDatePicker } from '@/components/BirthDatePicker';
import { useNavigate, useLocation } from 'react-router-dom';
import { createSignedUrl } from '@/utils/storageUtils';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';
import { cn } from '@/lib/utils';

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
  const [coverFileName, setCoverFileName] = useState(''); // Track filename for deletion
  const [profileFileName, setProfileFileName] = useState(''); // Track profile media filename
  const [isProfileVideo, setIsProfileVideo] = useState(false);
  
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

  // Validation errors
  const [errors, setErrors] = useState<{
    firstName?: string;
    lastName?: string;
    userLocation?: string;
    phone?: string;
    birthDate?: string;
    employmentStatus?: string;
  }>({});

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
        coverImageUrl: (profile as any)?.cover_image_url || '',
        isProfileVideo: false, // Will be updated below if video exists
        profileFileName: '', // Will be extracted from URL
        coverFileName: '', // Will be extracted from URL
      };

      setFirstName(values.firstName);
      setLastName(values.lastName);
      setBio(values.bio);
      setUserLocation(values.userLocation);
      setPostalCode(values.postalCode);
      setPhone(values.phone);
      setBirthDate(values.birthDate);
      
      // Handle video/image loading from database
      if ((profile as any)?.video_url) {
        setProfileImageUrl((profile as any).video_url);
        setIsProfileVideo(true);
        // Set original values to match current for video
        values.profileImageUrl = (profile as any).video_url;
        values.isProfileVideo = true;
        
        // Extract filename from video URL for cleanup
        try {
          const url = new URL((profile as any).video_url);
          const fileName = url.pathname.split('/').pop()?.split('?')[0] || '';
          if (fileName) {
            setProfileFileName(fileName);
            values.profileFileName = fileName;
          }
        } catch (error) {
          console.log('Could not extract video filename from URL');
        }
      } else {
        setProfileImageUrl(values.profileImageUrl);
        setIsProfileVideo(false);
        values.isProfileVideo = false;
        
        // Extract filename from image URL if it exists
        if (values.profileImageUrl) {
          try {
            const url = new URL(values.profileImageUrl);
            const fileName = url.pathname.split('/').pop()?.split('?')[0] || '';
            if (fileName) {
              setProfileFileName(fileName);
              values.profileFileName = fileName;
            }
          } catch (error) {
            console.log('Could not extract image filename from URL');
          }
        }
      }
      
      // Always load current cover image from DB - use dedicated field if available
      const dbCoverImage = (profile as any)?.cover_image_url || '';
      setCoverImageUrl(dbCoverImage);
      values.coverImageUrl = dbCoverImage;
      
      // Extract cover image filename for cleanup
      if (dbCoverImage) {
        try {
          const url = new URL(dbCoverImage);
          const fileName = url.pathname.split('/').pop()?.split('?')[0] || '';
          if (fileName) {
            setCoverFileName(fileName);
            values.coverFileName = fileName;
          }
        } catch (error) {
          console.log('Could not extract cover filename from URL');
        }
      }
      
      setCvUrl(values.cvUrl);
      // Only extract from URL if no filename in DB (for old records)
      if ((profile as any)?.cv_filename) {
        setCvFileName((profile as any).cv_filename);
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
      coverImageUrl,
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
      profileImageUrl, cvUrl, companyName, orgNumber, employmentStatus, workingHours, availability, coverImageUrl]);

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

  // Reset form to original values when user confirms leaving without saving on same route
  useEffect(() => {
    const onUnsavedConfirm = () => {
      if (!originalValues) return;
      setFirstName(originalValues.firstName || '');
      setLastName(originalValues.lastName || '');
      setBio(originalValues.bio || '');
      setUserLocation(originalValues.userLocation || '');
      setPostalCode(originalValues.postalCode || '');
      setPhone(originalValues.phone || '');
      setBirthDate(originalValues.birthDate || '');
      setProfileImageUrl(originalValues.profileImageUrl || '');
      setCoverImageUrl(originalValues.coverImageUrl || '');
      setCoverFileName(originalValues.coverFileName || '');
      setProfileFileName(originalValues.profileFileName || '');
      setCvUrl(originalValues.cvUrl || '');
      setCompanyName(originalValues.companyName || '');
      setOrgNumber(originalValues.orgNumber || '');
      setEmploymentStatus(originalValues.employmentStatus || '');
      setWorkingHours(originalValues.workingHours || '');
      setAvailability(originalValues.availability || '');
      setIsProfileVideo(originalValues.isProfileVideo || false);
      setHasUnsavedChanges(false);
    };
    window.addEventListener('unsaved-confirm', onUnsavedConfirm as EventListener);
    return () => window.removeEventListener('unsaved-confirm', onUnsavedConfirm as EventListener);
  }, [originalValues, setHasUnsavedChanges]);

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

  // Required field validation
  const isValidSwedishPhone = (value: string) => {
    const digits = value.replace(/\s+/g, '');
    return /^(\+46|0)[1-9][0-9]{7,9}$/.test(digits);
  };

  const validateRequiredFields = () => {
    const newErrors: typeof errors = {};
    if (!firstName.trim()) newErrors.firstName = 'Förnamn är obligatoriskt.';
    if (!lastName.trim()) newErrors.lastName = 'Efternamn är obligatoriskt.';
    if (!userLocation.trim()) newErrors.userLocation = 'Var bor du? är obligatoriskt.';
    if (!phone.trim()) newErrors.phone = 'Telefonnummer är obligatoriskt.';
    else if (!isValidSwedishPhone(phone)) newErrors.phone = 'Ange ett giltigt svenskt nummer (+46 eller 0).';
    if (!birthDate) newErrors.birthDate = 'Födelsedatum är obligatoriskt.';
    else {
      const a = calculateAge(birthDate);
      if (a !== null && a < 16) newErrors.birthDate = 'Du måste vara minst 16 år.';
    }
    if (!isEmployer && !employmentStatus) newErrors.employmentStatus = 'Anställningsstatus är obligatorisk.';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };


  const uploadProfileMedia = async (file: File) => {
    const isVideo = file.type.startsWith('video/');
    if (isVideo) setIsUploadingVideo(true);
    
    try {
      // Delete old profile media file if exists
      if (profileFileName) {
        try {
          await supabase.storage
            .from('job-applications')
            .remove([profileFileName]);
          console.log('Deleted old profile media:', profileFileName);
        } catch (error) {
          console.error('Error deleting old profile media:', error);
        }
      }
      
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
      
      const mediaUrl = `${signedUrl}&t=${Date.now()}&v=${Math.random()}`;
      
      // Update local state and track filename
      if (isVideo) {
        setProfileImageUrl(mediaUrl); // Store video URL in profileImageUrl for now
        setIsProfileVideo(true); // Mark as video
        // Keep existing cover image when uploading video - don't clear it
      } else {
        setProfileImageUrl(mediaUrl);
        setIsProfileVideo(false); // Mark as image
        setCoverImageUrl(''); // Clear cover when uploading profile image
        setCoverFileName(''); // Clear cover filename too
      }
      
      setProfileFileName(fileName); // Track the new filename
      
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
      // Delete old cover image file if exists
      if (coverFileName) {
        try {
          await supabase.storage
            .from('job-applications')
            .remove([coverFileName]);
          console.log('Deleted old cover image:', coverFileName);
        } catch (error) {
          console.error('Error deleting old cover image:', error);
        }
      }
      
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
      
      // Add stronger cache-busting
      const coverUrl = `${signedUrl}&t=${Date.now()}&v=${Math.random()}`;
      
      // Update local state and track filename  
      setCoverImageUrl(coverUrl);
      setCoverFileName(fileName); // Store for deletion
      
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
            "Videon är för lång",
            `Videon är ${Math.round(video.duration)} sekunder. Max 30 sekunder tillåtet`
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
      setIsProfileVideo(false); // Mark as image, not video
      // Keep cover image when uploading profile image
      
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

  const deleteProfileMedia = async () => {
    try {
      // Delete the actual file from storage if we have a filename
      if (profileFileName) {
        const { error: deleteError } = await supabase.storage
          .from('job-applications')
          .remove([profileFileName]);
          
        if (deleteError) {
          console.error('Error deleting profile media file:', deleteError);
        }
      }
      
      // Clear local state
      setProfileImageUrl('');
      setIsProfileVideo(false); // Reset video flag
      setProfileFileName(''); // Clear filename
      
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
    } catch (error) {
      console.error('Error in deleteProfileMedia:', error);
      // Clear local state anyway
      setProfileImageUrl('');
      setIsProfileVideo(false);
      setProfileFileName('');
      setHasUnsavedChanges(true);
      
      toast({
        title: "Profilbild/video borttagen!",
        description: "Tryck på \"Spara ändringar\" för att spara ändringen."
      });
    }
  };

  const deleteCoverImage = async () => {
    try {
      // Delete the actual file from storage if we have a filename
      if (coverFileName) {
        const { error: deleteError } = await supabase.storage
          .from('job-applications')
          .remove([coverFileName]);
          
        if (deleteError) {
          console.error('Error deleting cover file:', deleteError);
          // Continue anyway - clear the local state
        }
      }
      
      // Clear local state
      setCoverImageUrl('');
      setCoverFileName('');
      
      // Mark as having unsaved changes
      setHasUnsavedChanges(true);
      
      toast({
        title: "Cover-bild borttagen!", 
        description: "Tryck på \"Spara ändringar\" för att spara ändringen."
      });
    } catch (error) {
      console.error('Error in deleteCoverImage:', error);
      // Clear local state anyway
      setCoverImageUrl('');
      setCoverFileName('');
      setHasUnsavedChanges(true);
      
      toast({
        title: "Cover-bild borttagen!", 
        description: "Tryck på \"Spara ändringar\" för att spara ändringen."
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields before saving
    const valid = validateRequiredFields();
    if (!valid) {
      toast({
        title: "Komplettera uppgifter",
        description: "Fyll i alla obligatoriska fält markerade med rött.",
        variant: "destructive",
      });
      return;
    }

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
      if (isProfileVideo && profileImageUrl) {
        // It's a video
        updates.video_url = profileImageUrl;
        updates.profile_image_url = null; // Clear profile image when using video
      } else {
        // It's an image or no media
        updates.profile_image_url = profileImageUrl || null;
        updates.video_url = null;
      }
      
      // Always save cover image separately if available
      updates.cover_image_url = coverImageUrl || null;

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
          userLocation: userLocation,
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
          coverImageUrl: coverImageUrl,
          coverFileName: coverFileName,
          profileFileName: profileFileName,
          isProfileVideo: isProfileVideo,
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
              Ladda upp en kort profilvideo eller en bild och gör ditt första intryck minnesvärt
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
              <div className="text-white text-sm font-medium flex-shrink-0">
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
              {(isProfileVideo && !!profileImageUrl) ? (
                <ProfileVideo
                  videoUrl={profileImageUrl}
                  coverImageUrl={coverImageUrl || profile?.profile_image_url || undefined}
                  userInitials={`${firstName.charAt(0)}${lastName.charAt(0)}`}
                  alt="Profile video"
                  className="w-32 h-32 border-4 border-white/20 hover:border-white/40 transition-all rounded-full overflow-hidden"
                />
              ) : (
                <div 
                  className="cursor-pointer" 
                  onClick={() => document.getElementById('profile-image')?.click()}
                >
                  <Avatar className="h-32 w-32 border-4 border-white/20 hover:border-white/40 transition-all">
                    <AvatarImage src={profileImageUrl || (profile as any)?.cover_image_url} />
                    <AvatarFallback className="text-2xl bg-white/20 text-white">
                      {profile?.first_name?.[0]}{profile?.last_name?.[0]}
                    </AvatarFallback>
                  </Avatar>
                </div>
              )}

              {/* Delete icon for profile media */}
              {!!profileImageUrl && (
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
              
              {(isProfileVideo && !!profileImageUrl) && !isUploadingVideo && (
                <Badge variant="secondary" className="bg-white/20 text-white">
                  {profile?.video_url ? 'Video' : 'Bild'} uppladdad!
                </Badge>
              )}
            </div>

            {/* Cover image upload for videos */}
            {(isProfileVideo && !!profileImageUrl) && (
              <div className="flex flex-col items-center space-y-3 mt-4 p-4 rounded-lg bg-white/5 w-full">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => document.getElementById('cover-image')?.click()}
                  disabled={isUploadingCover}
                  className="bg-white/20 border-white/30 text-white hover:bg-white/30 disabled:opacity-50 transition-all duration-200"
                >
                  {(profile?.profile_image_url || coverImageUrl) ? 'Ändra cover-bild' : 'Lägg till cover-bild'}
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
                
                {coverImageUrl && !isUploadingCover && (
                  <div className="flex flex-col items-center space-y-2 w-full">
                     <div className="flex items-center gap-2">
                       <Badge variant="secondary" className="bg-white/20 text-white text-xs font-normal ml-6 whitespace-nowrap">
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName" className="text-white">
                      Förnamn <span className="text-red-400">*</span>
                    </Label>
                    <Input
                      id="firstName"
                      placeholder="Förnamn"
                      value={firstName}
                      onChange={(e) => {
                        setFirstName(e.target.value);
                        if (e.target.value.trim()) {
                          setErrors(prev => ({ ...prev, firstName: undefined }));
                        }
                      }}
                      onBlur={() => setErrors(prev => ({ ...prev, firstName: firstName.trim() ? undefined : 'Förnamn är obligatoriskt.' }))}
                      aria-invalid={!!errors.firstName}
                      className={`bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10 placeholder:text-white/60 ${errors.firstName ? 'border-red-400' : ''}`}
                    />
                    {errors.firstName && <p className="text-xs text-red-300">{errors.firstName}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="lastName" className="text-white">
                      Efternamn <span className="text-red-400">*</span>
                    </Label>
                    <Input
                      id="lastName"
                      placeholder="Efternamn"
                      value={lastName}
                      onChange={(e) => {
                        setLastName(e.target.value);
                        if (e.target.value.trim()) {
                          setErrors(prev => ({ ...prev, lastName: undefined }));
                        }
                      }}
                      onBlur={() => setErrors(prev => ({ ...prev, lastName: lastName.trim() ? undefined : 'Efternamn är obligatoriskt.' }))}
                      aria-invalid={!!errors.lastName}
                      className={`bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10 placeholder:text-white/60 ${errors.lastName ? 'border-red-400' : ''}`}
                    />
                    {errors.lastName && <p className="text-xs text-red-300">{errors.lastName}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="birthDate" className="text-white">
                      Födelsedatum <span className="text-red-400">*</span>
                    </Label>
                    <BirthDatePicker
                      value={birthDate}
                      onChange={(v) => {
                        setBirthDate(v);
                        setErrors(prev => ({ ...prev, birthDate: v ? undefined : 'Födelsedatum är obligatoriskt.' }));
                      }}
                      placeholder="Välj födelsedatum"
                    />
                    {age !== null && (
                      <p className="text-sm text-white">Ålder: {age} år</p>
                    )}
                    {errors.birthDate && <p className="text-xs text-red-300">{errors.birthDate}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-white">
                      Telefon <span className="text-red-400">*</span>
                    </Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-3 h-4 w-4 text-white z-10" />
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="+46 70 123 45 67"
                        value={phone}
                        onChange={(e) => {
                          setPhone(e.target.value);
                          if (e.target.value.trim()) {
                            setErrors(prev => ({ ...prev, phone: undefined }));
                          }
                        }}
                        onBlur={() => setErrors(prev => ({ ...prev, phone: phone.trim() ? (isValidSwedishPhone(phone) ? undefined : 'Ange ett giltigt svenskt nummer (+46 eller 0).') : 'Telefonnummer är obligatoriskt.' }))}
                        aria-invalid={!!errors.phone}
                        className={`pl-10 bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10 placeholder:text-white/60 ${errors.phone ? 'border-red-400' : ''}`}
                      />
                    </div>
                    {errors.phone && <p className="text-xs text-red-300">{errors.phone}</p>}
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
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-white z-10" />
                      <div className="flex h-10 w-full rounded-md border bg-white/5 backdrop-blur-sm border-white/20 text-white pl-10 pr-3 py-2 text-sm min-w-0">
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
                    {errors.userLocation && <p className="text-xs text-red-300">{errors.userLocation}</p>}
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
                  className="bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10 placeholder:text-white/60"
                />
                <div className="flex justify-end">
                  <span className="text-xs text-white">
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
                        <Label htmlFor="employmentStatus" className="text-white">
                          Anställningsstatus <span className="text-red-400">*</span>
                        </Label>
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              className="w-full h-12 bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10 transition-colors justify-between"
                            >
                              <span className="truncate">
                                {employmentStatus ? (
                                  ({
                                    tillsvidareanställning: 'Fast anställning',
                                    visstidsanställning: 'Visstidsanställning',
                                    provanställning: 'Provanställning',
                                    interim: 'Interim anställning',
                                    bemanningsanställning: 'Bemanningsanställning',
                                    egenforetagare: 'Egenföretagare / Frilans',
                                    arbetssokande: 'Arbetssökande',
                                    annat: 'Annat',
                                  } as Record<string, string>)[employmentStatus]
                                ) : 'Välj din nuvarande situation'}
                              </span>
                              <ChevronDown className="h-4 w-4 flex-shrink-0" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent 
                            className="w-72 max-h-80 overflow-y-auto bg-slate-700/95 backdrop-blur-md border-slate-500/30 shadow-xl z-50 rounded-lg text-white"
                            side="bottom"
                            align="center"
                            alignOffset={0}
                            sideOffset={6}
                            avoidCollisions={true}
                          >
                            <DropdownMenuItem onClick={() => setEmploymentStatus('tillsvidareanställning')} className="cursor-pointer hover:bg-slate-700/70 focus:bg-slate-700/70 py-3 text-white">
                              Fast anställning
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setEmploymentStatus('visstidsanställning')} className="cursor-pointer hover:bg-slate-700/70 focus:bg-slate-700/70 py-3 text-white">
                              Visstidsanställning
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setEmploymentStatus('provanställning')} className="cursor-pointer hover:bg-slate-700/70 focus:bg-slate-700/70 py-3 text-white">
                              Provanställning
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setEmploymentStatus('interim')} className="cursor-pointer hover:bg-slate-700/70 focus:bg-slate-700/70 py-3 text-white">
                              Interim anställning
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setEmploymentStatus('bemanningsanställning')} className="cursor-pointer hover:bg-slate-700/70 focus:bg-slate-700/70 py-3 text-white">
                              Bemanningsanställning
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setEmploymentStatus('egenforetagare')} className="cursor-pointer hover:bg-slate-700/70 focus:bg-slate-700/70 py-3 text-white">
                              Egenföretagare / Frilans
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setEmploymentStatus('arbetssokande')} className="cursor-pointer hover:bg-slate-700/70 focus:bg-slate-700/70 py-3 text-white">
                              Arbetssökande
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setEmploymentStatus('annat')} className="cursor-pointer hover:bg-slate-700/70 focus:bg-slate-700/70 py-3 text-white">
                              Annat
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        {errors.employmentStatus && <p className="text-xs text-red-300">{errors.employmentStatus}</p>}
                      </div>

                      {/* Visa arbetstid endast om användaren har valt något OCH det inte är arbetssökande */}
                      {employmentStatus && employmentStatus !== 'arbetssokande' && (
                        <div className="space-y-2">
                          <Label htmlFor="workingHours" className="text-white">Hur mycket jobbar du idag?</Label>
                          <DropdownMenu modal={false}>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="outline"
                                className="w-full h-12 bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10 transition-colors justify-between"
                              >
                                <span className="truncate">
                                  {workingHours ? (
                                    ({
                                      heltid: 'Heltid',
                                      deltid: 'Deltid',
                                      varierande: 'Varierande / Flexibelt',
                                    } as Record<string, string>)[workingHours]
                                  ) : 'Välj arbetstid/omfattning'}
                                </span>
                                <ChevronDown className="h-4 w-4 flex-shrink-0" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent 
                              className="w-72 max-h-80 overflow-y-auto bg-slate-700/95 backdrop-blur-md border-slate-500/30 shadow-xl z-50 rounded-lg text-white"
                              side="bottom"
                              align="center"
                              alignOffset={0}
                              sideOffset={6}
                              avoidCollisions={true}
                            >
                              <DropdownMenuItem onClick={() => setWorkingHours('heltid')} className="cursor-pointer hover:bg-slate-700/70 focus:bg-slate-700/70 py-3 text-white">
                                Heltid
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setWorkingHours('deltid')} className="cursor-pointer hover:bg-slate-700/70 focus:bg-slate-700/70 py-3 text-white">
                                Deltid
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setWorkingHours('varierande')} className="cursor-pointer hover:bg-slate-700/70 focus:bg-slate-700/70 py-3 text-white">
                                Varierande / Flexibelt
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      )}
                    </div>

                    {/* Visa tillgänglighet endast om användaren har valt något i anställningsstatus */}
                    {employmentStatus && (
                      <div className="space-y-2">
                        <Label htmlFor="availability" className="text-white">När kan du börja nytt jobb?</Label>
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              className="w-full h-12 bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10 transition-colors justify-between"
                            >
                              <span className="truncate">
                                {availability ? (
                                  ({
                                    omgaende: 'Omgående',
                                    'inom-1-manad': 'Inom 1 månad',  
                                    'inom-3-manader': 'Inom 3 månader',
                                    'inom-6-manader': 'Inom 6 månader',
                                    'ej-aktuellt': 'Inte aktuellt just nu',
                                    osaker: 'Osäker',
                                  } as Record<string, string>)[availability]
                                ) : 'Välj din tillgänglighet'}
                              </span>
                              <ChevronDown className="h-4 w-4 flex-shrink-0" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent 
                            className="w-72 max-h-80 overflow-y-auto bg-slate-700/95 backdrop-blur-md border-slate-500/30 shadow-xl z-50 rounded-lg text-white"
                            side="bottom"
                            align="center"
                            alignOffset={0}
                            sideOffset={6}
                            avoidCollisions={true}
                          >
                            <DropdownMenuItem onClick={() => setAvailability('omgaende')} className="cursor-pointer hover:bg-slate-700/70 focus:bg-slate-700/70 py-3 text-white">
                              Omgående
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setAvailability('inom-1-manad')} className="cursor-pointer hover:bg-slate-700/70 focus:bg-slate-700/70 py-3 text-white">
                              Inom 1 månad
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setAvailability('inom-3-manader')} className="cursor-pointer hover:bg-slate-700/70 focus:bg-slate-700/70 py-3 text-white">
                              Inom 3 månader
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setAvailability('inom-6-manader')} className="cursor-pointer hover:bg-slate-700/70 focus:bg-slate-700/70 py-3 text-white">
                              Inom 6 månader
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setAvailability('ej-aktuellt')} className="cursor-pointer hover:bg-slate-700/70 focus:bg-slate-700/70 py-3 text-white">
                              Inte aktuellt just nu
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setAvailability('osaker')} className="cursor-pointer hover:bg-slate-700/70 focus:bg-slate-700/70 py-3 text-white">
                              Osäker
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4 pt-4 border-t border-white/20">
                    <div className="flex items-center gap-2 mb-4">
                      <FileText className="h-4 w-4 text-white" />
                      <Label className="text-base font-medium text-white">CV</Label>
                    </div>
                    
                    <div className="bg-white/5 rounded-lg p-4">
                      <FileUpload
                        onFileUploaded={(url, fileName) => {
                          console.log('CV uploaded, received:', { url, fileName });
                          setCvUrl(url);
                          setCvFileName(fileName); // Save original filename to DB
                          setHasUnsavedChanges(true); // Mark as changed
                        }}
                        onFileRemoved={() => {
                          setCvUrl('');
                          setCvFileName('');
                        }}
                        currentFile={cvUrl ? { url: cvUrl, name: "Din valda fil" } : undefined}
                        acceptedFileTypes={['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']}
                        maxFileSize={5 * 1024 * 1024}
                      />
                    </div>
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
                        className="bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10 placeholder:text-white/60"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="orgNumber" className="text-white">Organisationsnummer</Label>
                      <Input
                        id="orgNumber"
                        placeholder="556123-4567"
                        value={orgNumber}
                        onChange={(e) => setOrgNumber(e.target.value)}
                        className="bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10 placeholder:text-white/60"
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