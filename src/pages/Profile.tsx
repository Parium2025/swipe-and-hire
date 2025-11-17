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
import { User, MapPin, Building, Camera, Mail, Phone, Calendar as CalendarIcon, Briefcase, Clock, FileText, Video, Play, Check, Trash2, ChevronDown, RotateCcw, ExternalLink } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CvViewer } from '@/components/CvViewer';
import FileUpload from '@/components/FileUpload';
import ProfileVideo from '@/components/ProfileVideo';
import ImageEditor from '@/components/ImageEditor';
import WorkplacePostalCodeSelector from '@/components/WorkplacePostalCodeSelector';
import { BirthDatePicker } from '@/components/BirthDatePicker';
import { useNavigate, useLocation } from 'react-router-dom';
import { uploadMedia, getMediaUrl, deleteMedia } from '@/lib/mediaManager';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { isValidSwedishPhone } from '@/lib/phoneValidation';
import { useMediaUrl } from '@/hooks/useMediaUrl';
import { useCachedImage } from '@/hooks/useCachedImage';

const Profile = () => {
  const { profile, userRole, updateProfile, refreshProfile, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const { hasUnsavedChanges, setHasUnsavedChanges } = useUnsavedChanges();
  const [loading, setLoading] = useState(false);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [uploadingMediaType, setUploadingMediaType] = useState<'image' | 'video' | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
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
  const [cvOpen, setCvOpen] = useState(false);
  
  // Undo state - store deleted media for restore
  const [deletedProfileMedia, setDeletedProfileMedia] = useState<{
    profileImageUrl: string;
    coverImageUrl: string;
    profileFileName: string;
    coverFileName: string;
    isProfileVideo: boolean;
  } | null>(null);
  
  // Separate undo state for cover image only
  const [deletedCoverImage, setDeletedCoverImage] = useState<{
    coverImageUrl: string;
    coverFileName: string;
  } | null>(null);
  
  // Basic form fields
  const [firstName, setFirstName] = useState(profile?.first_name || '');
  const [lastName, setLastName] = useState(profile?.last_name || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [userLocation, setUserLocation] = useState(profile?.location || '');
  const [postalCode, setPostalCode] = useState('');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [birthDate, setBirthDate] = useState(profile?.birth_date || '');
  const [profileImageUrl, setProfileImageUrl] = useState(profile?.profile_image_url || '');
  const [videoUrl, setVideoUrl] = useState(profile?.video_url || '');
  const [cvUrl, setCvUrl] = useState((profile as any)?.cv_url || '');
  const [cvFileName, setCvFileName] = useState((profile as any)?.cv_filename || '');
  const signedProfileImageUrl = useMediaUrl(profileImageUrl || (profile as any)?.profile_image_url, 'profile-image');
  
  // Signed URLs for displaying private media
  const signedVideoUrl = useMediaUrl(videoUrl || (profile as any)?.video_url, 'profile-video');
  const signedCoverUrl = useMediaUrl(coverImageUrl || (profile as any)?.cover_image_url, 'cover-image');
  const signedCvUrl = useMediaUrl(cvUrl || (profile as any)?.cv_url, 'cv');
  
  // Cache images to prevent blinking during re-renders
  const { cachedUrl: cachedProfileImageUrl } = useCachedImage(signedProfileImageUrl);
  const { cachedUrl: cachedCoverUrl } = useCachedImage(signedCoverUrl);
  
  // Extended profile fields that we'll need to add to database
  const [employmentStatus, setEmploymentStatus] = useState('');
  const [workingHours, setWorkingHours] = useState('');
  const [availability, setAvailability] = useState('');
  const [hasValidLocation, setHasValidLocation] = useState(false);

  
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
        videoUrl: profile.video_url || '',
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
        setVideoUrl((profile as any).video_url);
        setProfileImageUrl(''); // Clear regular profile image when video exists
        setIsProfileVideo(true);
        values.videoUrl = (profile as any).video_url;
        values.profileImageUrl = '';
        values.isProfileVideo = true;
        
          // Signed URL handled by useMediaUrl hook
      } else {
        setVideoUrl('');
        setProfileImageUrl(values.profileImageUrl);
        setIsProfileVideo(false);
        values.videoUrl = '';
        values.isProfileVideo = false;
      }
      
      // Always load current cover image from DB - use dedicated field if available
      const dbCoverImage = (profile as any)?.cover_image_url || '';
      setCoverImageUrl(dbCoverImage);
      values.coverImageUrl = dbCoverImage;
      
      // Signed URL handled by useMediaUrl hook
      
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

  // Clear location error when a valid location is detected
  useEffect(() => {
    if (hasValidLocation && errors.userLocation) {
      setErrors(prev => ({ ...prev, userLocation: undefined }));
    }
  }, [hasValidLocation, errors.userLocation]);

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
    if (wordCount <= 150) {
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

  // Required field validation - uses centralized phone validation

  const validateRequiredFields = () => {
    const newErrors: typeof errors = {};
    if (!firstName.trim()) newErrors.firstName = 'Förnamn är obligatoriskt.';
    if (!lastName.trim()) newErrors.lastName = 'Efternamn är obligatoriskt.';
    if (!postalCode.trim()) newErrors.userLocation = 'Postnummer är obligatoriskt.';
    else if (!hasValidLocation) newErrors.userLocation = 'Ange ett giltigt postnummer som finns i Sverige';
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
    setIsUploadingMedia(true);
    setUploadingMediaType(isVideo ? 'video' : 'image');
    setUploadProgress(0);
    
    try {
      if (!user?.id) throw new Error('User not found');
      
      // Simulate progress for videos
      let progressInterval: number | null = null;
      if (isVideo) {
        progressInterval = window.setInterval(() => {
          setUploadProgress(prev => {
            if (prev >= 90) return prev;
            return prev + 10;
          });
        }, 200);
      }
      
      // Använd mediaManager för konsistent bucket-hantering
      const { storagePath, error: uploadError } = await uploadMedia(
        file,
        isVideo ? 'profile-video' : 'profile-image',
        user.id
      );
      
      if (progressInterval) clearInterval(progressInterval);
      setUploadProgress(100);
      
      if (uploadError) throw uploadError;
      
      // Update local state
        if (isVideo) {
          // Preserve current profile image as cover if none set yet
          const previousImage = profileImageUrl || (originalValues?.profileImageUrl || '');
          if (!coverImageUrl && previousImage) {
            setCoverImageUrl(previousImage);
            setCoverFileName(previousImage);
          }
          setVideoUrl(storagePath);
          setProfileImageUrl(''); // Clear regular image when video is uploaded
          setIsProfileVideo(true);
          // Signed URL handled by useMediaUrl hook
        } else {
          setProfileImageUrl(storagePath);
          setVideoUrl('');
          setIsProfileVideo(false);
        }
      
      setProfileFileName(storagePath);
      setDeletedProfileMedia(null);
      setHasUnsavedChanges(true);
      
      toast({
        title: `${isVideo ? 'Video' : 'Bild'} uppladdad!`,
        description: `Tryck på "Spara ändringar" för att spara din profil${isVideo ? 'video' : 'bild'}.`
      });
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Fel vid uppladdning",
        description: error instanceof Error ? error.message : "Kunde inte ladda upp filen.",
        variant: "destructive"
      });
    } finally {
      setIsUploadingMedia(false);
      setUploadingMediaType(null);
      setUploadProgress(0);
    }
  };

  const uploadCoverImage = async (file: File) => {
    setIsUploadingCover(true);
    
    try {
      if (!user?.id) throw new Error('User not found');
      
      // Använd mediaManager för cover-bild
      const { storagePath, error: uploadError } = await uploadMedia(
        file,
        'cover-image',
        user.id
      );

      if (uploadError) throw uploadError;
      
      // Update local state and track filename  
      setCoverImageUrl(storagePath);
      setCoverFileName(storagePath); // Store path for deletion
      
      // Signed URL handled by useMediaUrl hook
      
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
        } else if (video.duration > 60) {
          showError(
            "Videon är för lång",
            `Videon är ${Math.round(video.duration)} sekunder. Max 60 sekunder tillåtet`
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
      setIsUploadingMedia(true);
      setUploadingMediaType('image');
      
      const user = await supabase.auth.getUser();
      if (!user.data.user) throw new Error('User not authenticated');

      // DO NOT delete old files automatically - only when user clicks delete button
      // Old files remain in storage for permanent access

      // Skapa File från Blob så vi kan använda mediaManager
      const editedFile = new File([editedBlob], 'profile-image.jpg', { type: 'image/jpeg' });

      // Ladda upp till privata bucketen via mediaManager (sparar endast storage path)
      const { storagePath, error: uploadError } = await uploadMedia(
        editedFile,
        'profile-image',
        user.data.user.id
      );

      if (uploadError || !storagePath) throw uploadError || new Error('Upload failed');

      // Förladda den signerade URL:en i bakgrunden (utan att blockera UI)
      import('@/lib/serviceWorkerManager').then(async ({ preloadSingleFile }) => {
        const signed = await getMediaUrl(storagePath, 'profile-image', 86400);
        if (signed) {
          preloadSingleFile(signed).catch(err => console.log('Preload error:', err));
        }
      });
      
      // Update local state instead of saving immediately
      setProfileImageUrl(storagePath);
      setIsProfileVideo(false); // Mark as image, not video
      setProfileFileName(storagePath); // Track the new filename (storage path) for deletion
      // Keep cover image when uploading profile image
      
      // Clear undo state since we have a new profile image
      setDeletedProfileMedia(null);
      
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
      setIsUploadingMedia(false);
      setUploadingMediaType(null);
    }
  };

  const handleCoverImageSave = async (editedBlob: Blob) => {
    try {
      setIsUploadingCover(true);
      
      const user = await supabase.auth.getUser();
      if (!user.data.user) throw new Error('User not authenticated');

      // DO NOT delete old files automatically - only when user clicks delete button
      // Old files remain in storage for permanent access

      // Skapa File från Blob så vi kan använda mediaManager
      const editedFile = new File([editedBlob], 'cover-image.jpg', { type: 'image/jpeg' });

      // Ladda upp till privata bucketen via mediaManager (sparar endast storage path)
      const { storagePath, error: uploadError } = await uploadMedia(
        editedFile,
        'cover-image',
        user.data.user.id
      );

      if (uploadError || !storagePath) throw uploadError || new Error('Upload failed');

      // Förladdda den signerade URL:en i bakgrunden (utan att blockera UI)
      import('@/lib/serviceWorkerManager').then(async ({ preloadSingleFile }) => {
        const signed = await getMediaUrl(storagePath, 'cover-image', 86400);
        if (signed) {
          preloadSingleFile(signed).catch(err => console.log('Preload error:', err));
        }
      });
      
      // Update local state instead of saving immediately
      setCoverImageUrl(storagePath);
      setCoverFileName(storagePath); // Track the new filename (storage path) for deletion
      
      // Clear undo state since we have a new cover image
      setDeletedCoverImage(null);
      
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
      // Save current values for undo (only profile media, not cover)
      setDeletedProfileMedia({
        profileImageUrl,
        coverImageUrl, // Save for restore, but don't delete
        profileFileName,
        coverFileName, // Save for restore, but don't delete
        isProfileVideo
      });
      
      // Delete the actual profile media file from storage if we have a filename
      if (profileFileName) {
        const { error: deleteError } = await supabase.storage
          .from('job-applications')
          .remove([profileFileName]);
          
        if (deleteError) {
          console.error('Error deleting profile media file:', deleteError);
        }
      }

      // DO NOT delete cover image file - keep it
      // Cover image should only be deleted via deleteCoverImage function
      
      // Clear ONLY profile media from local state, keep cover image
      setProfileImageUrl('');
      setIsProfileVideo(false); // Reset video flag
      setProfileFileName(''); // Clear profile filename
      // Keep coverImageUrl and coverFileName - don't clear them
      
      // Reset the file input to allow new uploads
      const fileInput = document.getElementById('profile-image') as HTMLInputElement;
      if (fileInput) {
        fileInput.value = '';
      }
      
      // Mark as having unsaved changes
      setHasUnsavedChanges(true);
      
      toast({
        title: "Profilbild/video borttagen",
        description: "Tryck på \"Spara ändringar\" för att spara ändringen"
      });
    } catch (error) {
      console.error('Error in deleteProfileMedia:', error);
      // Clear local state anyway (but keep cover)
      setProfileImageUrl('');
      setIsProfileVideo(false);
      setProfileFileName('');
      // Keep cover image even on error
      setHasUnsavedChanges(true);
      
      toast({
        title: "Profilbild/video borttagen",
        description: "Tryck på \"Spara ändringar\" för att spara ändringen"
      });
    }
  };

  const restoreProfileMedia = () => {
    if (!deletedProfileMedia) return;
    
    // Restore all values
    setProfileImageUrl(deletedProfileMedia.profileImageUrl);
    setCoverImageUrl(deletedProfileMedia.coverImageUrl);
    setProfileFileName(deletedProfileMedia.profileFileName);
    setCoverFileName(deletedProfileMedia.coverFileName);
    setIsProfileVideo(deletedProfileMedia.isProfileVideo);
    
    // Clear undo data
    setDeletedProfileMedia(null);
    
    // Mark as having unsaved changes
    setHasUnsavedChanges(true);
    
    toast({
      title: "Återställd!",
      description: "Din profilbild/video har återställts"
    });
  };

  const deleteCoverImage = async () => {
    try {
      // Save current cover image for undo
      setDeletedCoverImage({
        coverImageUrl,
        coverFileName
      });
      
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
        title: "Cover-bild borttagen", 
        description: "Tryck på \"Spara ändringar\" för att spara ändringen"
      });
    } catch (error) {
      console.error('Error in deleteCoverImage:', error);
      // Clear local state anyway
      setCoverImageUrl('');
      setCoverFileName('');
      setHasUnsavedChanges(true);
      
      toast({
        title: "Cover-bild borttagen", 
        description: "Tryck på \"Spara ändringar\" för att spara ändringen"
      });
    }
  };
  
  const restoreCoverImage = () => {
    if (!deletedCoverImage) return;
    
    // Restore cover image values
    setCoverImageUrl(deletedCoverImage.coverImageUrl);
    setCoverFileName(deletedCoverImage.coverFileName);
    
    // Clear undo data
    setDeletedCoverImage(null);
    
    // Mark as having unsaved changes
    setHasUnsavedChanges(true);
    
    toast({
      title: "Återställd!",
      description: "Din cover-bild har återställts"
    });
  };

  const handleDeleteCv = async () => {
    if (!user?.id) return;

    try {
      // Update database to remove CV
      const { error } = await supabase
        .from('profiles')
        .update({ 
          cv_url: null,
          cv_filename: null 
        })
        .eq('user_id', user.id);

      if (error) throw error;

      // Update local state
      setCvUrl('');
      setCvFileName('');
      setHasUnsavedChanges(false); // No need to save when we just updated DB directly

      toast({
        title: "CV borttaget",
        description: "Ditt CV har tagits bort från din profil"
      });

      // Refresh profile to update state
      await refreshProfile();
    } catch (error) {
      console.error('Error deleting CV:', error);
      toast({
        title: "Kunde inte ta bort CV",
        description: "Ett fel uppstod vid borttagning av CV",
        variant: "destructive"
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
        // Preserve existing CV unless explicitly changed/removed
        cv_url: cvUrl ? cvUrl : (originalValues?.cvUrl || null),
        cv_filename: cvFileName ? cvFileName : ((profile as any)?.cv_filename || null),
        employment_status: employmentStatus || null,
        working_hours: workingHours || null,
        availability: availability || null,
      };

      // Handle profile image/video updates
      if (isProfileVideo && videoUrl) {
        // It's a video - save storage path only
        updates.video_url = videoUrl;
        
        // If user had a profile image but no cover, make the profile image the cover
        if (profileImageUrl && !coverImageUrl) {
          updates.cover_image_url = profileImageUrl; // Preserve old profile image as cover
          setCoverImageUrl(profileImageUrl); // Update local state
          setCoverFileName(profileFileName); // Track for deletion
        } else {
          // Keep existing cover image when video exists
          updates.cover_image_url = coverImageUrl || null;
        }
        
        updates.profile_image_url = null; // Clear profile image when using video
      } else if (!profileImageUrl && coverImageUrl) {
        // No video/image but has cover - make cover the profile image (but keep cover as cover)
        updates.profile_image_url = coverImageUrl;
        updates.video_url = null;
        updates.cover_image_url = coverImageUrl; // Preserve cover image so it remains available when adding video again
        
        // Update local state to reflect this change
        setProfileImageUrl(coverImageUrl);
        setIsProfileVideo(false);
        setProfileFileName(coverFileName);
        // Do NOT clear cover state here
        setDeletedCoverImage(null);
        setDeletedProfileMedia(null); // Clear undo states
      } else {
        // It's an image or no media
        updates.profile_image_url = profileImageUrl || null;
        updates.video_url = null;
        updates.cover_image_url = coverImageUrl || null;
      }

      if (isEmployer) {
        updates.company_name = companyName.trim() || null;
        updates.org_number = orgNumber.trim() || null;
      }

      const result = await updateProfile(updates);
      
      if (!result.error) {
        // Refresh profile to ensure sidebar is updated immediately
        await refreshProfile();
        
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
        
        // Clear undo states after successful save
        setDeletedProfileMedia(null);
        setDeletedCoverImage(null);
        
        toast({
          title: "Profil uppdaterad",
          description: "Dina ändringar har sparats",
          duration: 2000
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
    <div className="max-w-2xl mx-auto space-y-6 px-4">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-white mb-2">Min Profil</h1>
        <p className="text-white text-sm">
          Hantera din personliga information
        </p>
      </div>

      <div className="space-y-6">
        {/* Profile Image/Video Card */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg">
          <div className="p-6 md:p-4 space-y-2">
            <h3 className="text-base font-semibold text-white text-center">
              Profilbild/Profilvideo
            </h3>
            <p className="text-white text-center text-sm">
              Ladda upp en kort profilbild/profilvideo och gör ditt första intryck minnesvärt
            </p>
            
            {/* Video and Camera Icons */}
            <div className="flex items-center justify-center space-x-4">
              {/* Video option */}
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-white/10 p-2 bg-gradient-to-b from-white/5 to-white/5 backdrop-blur-sm">
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
                <div className="w-16 h-16 rounded-full border-4 border-white/10 p-2 bg-gradient-to-b from-white/5 to-white/5 backdrop-blur-sm">
                  <div className="relative w-full h-full rounded-full bg-gradient-to-b from-primary/30 to-primary/50 overflow-hidden flex items-center justify-center">
                    <Camera className="h-5 w-5 text-white" />
                  </div>
                </div>
                <div className="absolute -top-1 -right-1 bg-white rounded-full p-1 shadow-lg">
                  <Camera className="h-2 w-2 text-primary" />
                </div>
              </div>
            </div>
          </div>
          <div className="p-4 flex flex-col items-center space-y-4">
            <div className="relative">
              {(isProfileVideo && !!videoUrl) ? (
                <ProfileVideo
                  videoUrl={signedVideoUrl}
                  coverImageUrl={signedCoverUrl}
                  userInitials={`${firstName.charAt(0)}${lastName.charAt(0)}`}
                  alt="Profile video"
                  className="w-32 h-32 border-4 border-white/10 hover:border-white/20 transition-all rounded-full overflow-hidden"
                />
              ) : (
                <div 
                  className="cursor-pointer" 
                  onClick={() => document.getElementById('profile-image')?.click()}
                >
                  <Avatar className="h-32 w-32 border-4 border-white/10 hover:border-white/20 [transition:border-color_0.2s]">
                    {(cachedProfileImageUrl || cachedCoverUrl || signedProfileImageUrl || signedCoverUrl) ? (
                      <AvatarImage 
                        src={cachedProfileImageUrl || cachedCoverUrl || signedProfileImageUrl || signedCoverUrl || undefined} 
                        alt="Profilbild"
                        className="object-cover"
                        decoding="sync"
                        loading="eager"
                        fetchPriority="high"
                        draggable={false}
                      />
                    ) : null}
                    {!(cachedProfileImageUrl || cachedCoverUrl || signedProfileImageUrl || signedCoverUrl) && (
                      <AvatarFallback delayMs={300} className="text-4xl font-semibold bg-white/20 text-white">
                        {((firstName?.trim()?.[0]?.toUpperCase() || '') + (lastName?.trim()?.[0]?.toUpperCase() || '')) || '?'}
                      </AvatarFallback>
                    )}
                  </Avatar>
                </div>
              )}

              {/* Delete/Restore icon for profile media */}
              {!!(videoUrl || profileImageUrl) && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteProfileMedia();
                  }}
                  className="absolute -top-3 -right-3 bg-white/20 hover:bg-destructive/30 backdrop-blur-sm text-white rounded-full p-2 shadow-lg transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
              
              {/* Undo button - shown when media was just deleted */}
              {!(videoUrl || profileImageUrl) && deletedProfileMedia && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    restoreProfileMedia();
                  }}
                  className="absolute -top-2 -right-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white rounded-full p-2 shadow-lg transition-colors"
                  title="Ångra borttagning"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
              )}

              <input
                id="profile-image"
                type="file"
                accept="image/*,video/*"
                onChange={handleMediaChange}
                className="hidden"
                disabled={isUploadingMedia}
              />
            </div>

            <div className="space-y-2 text-center">
              <Label 
                htmlFor="profile-image" 
                className="text-white cursor-pointer hover:text-white/90 transition-colors text-center text-sm"
              >
                Klicka för att välja en bild eller video (max 60 sekunder)
              </Label>
              
              {isUploadingMedia && (
                <Badge variant="outline" className="bg-white/10 text-white border-white/20 animate-pulse rounded-md px-3 py-1.5">
                  {uploadingMediaType === 'video' ? `${uploadProgress}%` : `Laddar upp bild...`}
                </Badge>
              )}
              
              {(isProfileVideo && !!videoUrl) && !isUploadingMedia && (
                <Badge variant="outline" className="bg-white/20 text-white border-white/20 px-3 py-1 rounded-md">
                  {isProfileVideo ? 'Video' : 'Bild'} uppladdad!
                </Badge>
              )}
            </div>

            {/* Cover image upload - show when video exists OR when cover image exists without video */}
            {(isProfileVideo && !!videoUrl) && (
              <div className="flex flex-col items-center space-y-3 mt-4 p-4 rounded-lg bg-white/5 w-full">
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => document.getElementById('cover-image')?.click()}
                    disabled={isUploadingCover}
                    className="bg-white/5 backdrop-blur-sm border-white/10 !text-white disabled:opacity-50 hover:bg-white/10 hover:!text-white md:hover:bg-white/10 md:hover:!text-white md:hover:border-white/10"
                  >
                    {coverImageUrl ? 'Ändra cover-bild' : 'Lägg till cover-bild'}
                  </Button>
                  {coverImageUrl && (
                    <button
                      onClick={deleteCoverImage}
                      disabled={isUploadingCover}
                      className="bg-white/20 hover:bg-destructive/30 backdrop-blur-sm text-white rounded-full p-2 shadow-lg transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                  {!coverImageUrl && deletedCoverImage && (
                    <button
                      onClick={restoreCoverImage}
                      disabled={isUploadingCover}
                      className="bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white rounded-full p-2 shadow-lg transition-colors disabled:opacity-50"
                      title="Ångra borttagning"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </button>
                  )}
                </div>
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
                    <Badge variant="outline" className="bg-white/10 text-white border-white/20 text-sm animate-pulse">
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1"></div>
                      Laddar upp cover-bild...
                    </Badge>
                  </div>
                )}
                
                {coverImageUrl && !isUploadingCover && (
                  <div className="flex flex-col items-center space-y-2 w-full">
                     <div className="flex items-center justify-center">
                       <Badge variant="outline" className="bg-white/20 text-white border-white/20 text-sm font-normal whitespace-nowrap px-3 py-1 rounded-md">
                          Cover-bild uppladdad!
                        </Badge>
                     </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Profile Information */}
        <div className="rounded-lg">
          <div className="p-6 md:p-4 border-b border-white/10">
            <h3 className="flex items-center gap-2 text-base font-semibold text-white">
              <User className="h-4 w-4" />
              Personlig Information
            </h3>
            <p className="text-white text-sm mt-1">
              Uppdatera din grundläggande profilinformation
            </p>
          </div>
          <div className="p-6 md:p-4">
            <form onSubmit={handleSubmit} className="space-y-6 md:space-y-3">
              {/* Personal Information */}
              <div className="space-y-4 md:space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-3">
                  <div className="space-y-2 md:space-y-1.5">
                    <Label htmlFor="firstName" className="text-white text-sm">
                      Förnamn <span className="text-white">*</span>
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
                      className={`h-9 bg-white/5 backdrop-blur-sm border-white/10 text-white hover:bg-white/10 placeholder:text-white/40 text-sm ${errors.firstName ? 'border-red-400' : ''}`}
                    />
                    {errors.firstName && <p className="text-sm text-red-300">{errors.firstName}</p>}
                  </div>

                  <div className="space-y-2 md:space-y-1.5">
                    <Label htmlFor="lastName" className="text-white text-sm">
                      Efternamn <span className="text-white">*</span>
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
                      className={`h-9 bg-white/5 backdrop-blur-sm border-white/10 text-white hover:bg-white/10 placeholder:text-white/40 text-sm ${errors.lastName ? 'border-red-400' : ''}`}
                    />
                    {errors.lastName && <p className="text-sm text-red-300">{errors.lastName}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-3">
                  <div className="space-y-2 md:space-y-1.5">
                    <Label htmlFor="birthDate" className="text-white">
                      Födelsedatum <span className="text-white">*</span>
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
                    {errors.birthDate && <p className="text-sm text-red-300">{errors.birthDate}</p>}
                  </div>

                  <div className="space-y-2 md:space-y-1.5">
                    <Label htmlFor="phone" className="text-white text-sm">
                      Telefon <span className="text-white">*</span>
                    </Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white z-10" />
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
                        className={`h-9 pl-10 bg-white/5 backdrop-blur-sm border-white/10 text-white hover:bg-white/10 placeholder:text-white/40 text-sm ${errors.phone ? 'border-red-400' : ''}`}
                      />
                    </div>
                    {errors.phone && <p className="text-sm text-red-300">{errors.phone}</p>}
                  </div>
                </div>
              </div>

              {/* E-post - full width */}
              <div className="space-y-2 md:space-y-1.5">
                <Label className="text-white text-sm">E-post</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white z-10" />
                  <div className="flex min-h-touch md:h-10 w-full rounded-md border bg-white/5 backdrop-blur-sm border-white/10 text-white pl-10 pr-3 py-2 text-sm items-center min-w-0 hover:bg-white/10 transition-all duration-150">
                    <span 
                      className="truncate" 
                      title={user?.email || ''}
                    >
                      {user?.email || ''}
                    </span>
                  </div>
                </div>
              </div>

              {/* Postnummer & Ort */}
              <WorkplacePostalCodeSelector
                postalCodeValue={postalCode}
                cityValue={userLocation}
                onPostalCodeChange={setPostalCode}
                onLocationChange={(city, postalCode, municipality, county) => {
                  setUserLocation(city);
                }}
                onValidationChange={setHasValidLocation}
              />
              {errors.userLocation && !hasValidLocation && <p className="text-sm text-red-300">{errors.userLocation}</p>}

              {/* Bio */}
              <div className="space-y-2 md:space-y-1.5 pt-4 md:pt-3 border-t border-white/10">
                <Label htmlFor="bio" className="text-white">Presentation / Om mig</Label>
                <Textarea
                  id="bio"
                  placeholder={isEmployer ? "Berätta om ditt företag..." : "Berätta kort om dig själv..."}
                  value={bio}
                  onChange={(e) => handleBioChange(e.target.value)}
                  rows={4}
                  className="bg-white/5 backdrop-blur-sm border-white/10 text-white hover:bg-white/10 placeholder:text-white/50"
                />
                <div className="flex justify-end">
                  <span className="text-sm text-white">
                    {countWords(bio)}/150 ord
                  </span>
                </div>
              </div>

              {/* Job Seeker Specific Information */}
              {!isEmployer && (
                <>
                  <div className="space-y-4 md:space-y-3 pt-4 md:pt-3 border-t border-white/10">
                    <div className="flex items-center gap-2 mb-2">
                      <Briefcase className="h-4 w-4 text-white" />
                      <Label className="text-base font-medium text-white">Anställningsinformation</Label>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-3">
                      <div className="space-y-2 md:space-y-1.5">
                        <Label htmlFor="employmentStatus" className="text-white">
                          Anställningsstatus? <span className="text-white">*</span>
                        </Label>
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full h-9 bg-white/5 backdrop-blur-sm border-white/10 text-white text-sm transition-all duration-300 md:hover:bg-white/10 md:hover:border-white/50 md:hover:text-white [&_svg]:text-white md:hover:[&_svg]:text-white justify-between"
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
                        {errors.employmentStatus && <p className="text-sm text-red-300">{errors.employmentStatus}</p>}
                      </div>

                      {/* Visa arbetstid endast om användaren har valt något OCH det inte är arbetssökande */}
                      {employmentStatus && employmentStatus !== 'arbetssokande' && (
                        <div className="space-y-2 md:space-y-1.5">
                          <Label htmlFor="workingHours" className="text-white">Hur mycket jobbar du idag? <span className="text-white">*</span></Label>
                          <DropdownMenu modal={false}>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="outline"
                                className="w-full h-9 bg-white/5 backdrop-blur-sm border-white/10 text-white text-sm transition-all duration-300 md:hover:bg-white/10 md:hover:border-white/50 md:hover:text-white [&_svg]:text-white md:hover:[&_svg]:text-white justify-between"
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

                    </div>

                    {/* Visa tillgänglighet endast om användaren har valt något i anställningsstatus */}
                    {employmentStatus && (
                      <div className="space-y-2 md:space-y-1.5">
                        <Label htmlFor="availability" className="text-white">När kan du börja nytt jobb? <span className="text-white">*</span></Label>
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              className="w-full h-9 bg-white/5 backdrop-blur-sm border-white/10 text-white text-sm transition-all duration-300 md:hover:bg-white/10 md:hover:border-white/50 md:hover:text-white [&_svg]:text-white md:hover:[&_svg]:text-white justify-between"
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

                  <div className="space-y-4 md:space-y-3 pt-4 md:pt-3 border-t border-white/10">
                    <div className="flex items-center gap-2 mb-4">
                      <FileText className="h-4 w-4 text-white" />
                      <Label className="text-base font-medium text-white">CV</Label>
                    </div>
                    
                    {cvUrl ? (
                      <div className="bg-white/5 p-3 rounded-lg border border-white/10 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setCvOpen(true)}
                          className="flex items-center gap-2 text-white hover:text-white transition-colors flex-1"
                        >
                          <FileText className="h-4 w-4 text-white flex-shrink-0" />
                          <span className="text-sm">Visa CV</span>
                          <ExternalLink className="h-4 w-4 text-white ml-auto flex-shrink-0" />
                        </button>
                        <button
                          type="button"
                          onClick={handleDeleteCv}
                          className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded transition-all flex-shrink-0"
                          title="Ta bort CV"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="p-0">
                        <FileUpload
                          onFileUploaded={(url, fileName) => {
                            console.log('CV uploaded, received:', { url, fileName });
                            setCvUrl(url);
                            setCvFileName(fileName);
                            setHasUnsavedChanges(true);
                          }}
                          onFileRemoved={() => {
                            setCvUrl('');
                            setCvFileName('');
                          }}
                          currentFile={undefined}
                          acceptedFileTypes={['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']}
                          maxFileSize={5 * 1024 * 1024}
                        />
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Employer-specific fields */}
              {isEmployer && (
                <div className="space-y-4 md:space-y-3 pt-4 md:pt-3 border-t border-white/10">
                  <div className="flex items-center gap-2 mb-2">
                    <Building className="h-4 w-4 text-white" />
                    <Label className="text-base font-medium text-white">Företagsinformation</Label>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-3">
                    <div className="space-y-2 md:space-y-1.5">
                      <Label htmlFor="companyName" className="text-white">Företagsnamn</Label>
                      <Input
                        id="companyName"
                        placeholder="Mitt Företag AB"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        className="bg-white/5 backdrop-blur-sm border-white/10 text-white hover:bg-white/10 placeholder:text-white/50"
                      />
                    </div>

                    <div className="space-y-2 md:space-y-1.5">
                      <Label htmlFor="orgNumber" className="text-white">Organisationsnummer</Label>
                      <Input
                        id="orgNumber"
                        placeholder="556123-4567"
                        value={orgNumber}
                        onChange={(e) => setOrgNumber(e.target.value)}
                        className="bg-white/5 backdrop-blur-sm border-white/10 text-white hover:bg-white/10 placeholder:text-white/50"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-center">
                <Button 
                  type="submit" 
                  className="bg-white/5 backdrop-blur-sm border border-white/10 !text-white disabled:opacity-50 disabled:cursor-not-allowed font-medium h-9 px-6 text-sm hover:bg-white/10 hover:!text-white md:hover:bg-white/10 md:hover:!text-white [&_svg]:text-white" 
                  disabled={loading || isUploadingMedia || isUploadingCover}
                >
                  {loading ? 'Sparar...' : 'Spara ändringar'}
                </Button>
              </div>
            </form>
          </div>
        </div>
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

      {/* CV Dialog */}
      <Dialog open={cvOpen} onOpenChange={setCvOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden bg-transparent border-none shadow-none p-8">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-white text-2xl">{cvFileName || 'CV'}</DialogTitle>
          </DialogHeader>
          {cvUrl && signedCvUrl && (
            <CvViewer src={signedCvUrl} fileName={cvFileName || 'cv.pdf'} height="70vh" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Profile;