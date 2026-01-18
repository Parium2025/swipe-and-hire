import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import FileUpload from '@/components/FileUpload';
import ImageEditor from '@/components/ImageEditor';
import { BirthDatePicker } from '@/components/BirthDatePicker';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import phoneWithPariumLogo from '@/assets/phone-with-parium-logo.jpg';
import { Heart, Users, Briefcase, Star, User, Camera, FileText, MapPin, ArrowRight, ArrowLeft, Check, Sparkles, Target, Phone, Play, Video, Trash2, ChevronDown, RotateCcw } from 'lucide-react';
import ProfileVideo from '@/components/ProfileVideo';
import SwipeIntro from '@/components/SwipeIntro';
import WorkplacePostalCodeSelector from '@/components/WorkplacePostalCodeSelector';
import { validateSwedishPhoneNumber } from '@/lib/phoneValidation';
import { uploadMedia, getMediaUrl, deleteMedia } from '@/lib/mediaManager';
import { useMediaUrl } from '@/hooks/useMediaUrl';

interface WelcomeTunnelProps {
  onComplete: () => void;
}

const WelcomeTunnel = ({ onComplete }: WelcomeTunnelProps) => {
  const { profile, updateProfile, user, signOut } = useAuth();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(-1); // Start with SwipeIntro (-1)
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [uploadingMediaType, setUploadingMediaType] = useState<'image' | 'video' | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  
  // Track if CV has been preloaded to avoid redundant preloading
  const [cvPreloaded, setCvPreloaded] = useState(false);
  
  // 🔒 CRITICAL: Store local media values in sessionStorage to survive component remounts
  const WELCOME_LOCAL_MEDIA_KEY = 'parium_welcome_local_media';
  // localStorage key for form data persistence across page refreshes
  const WELCOME_DRAFT_KEY = 'parium_draft_welcome-tunnel';
  
  interface WelcomeLocalMediaState {
    profileImageUrl: string;
    profileMediaType: string;
    coverImageUrl: string;
    cvUrl: string;
  }
  
  const getLocalMediaState = (): WelcomeLocalMediaState | null => {
    try {
      const stored = sessionStorage.getItem(WELCOME_LOCAL_MEDIA_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  };
  
  const setLocalMediaState = (state: WelcomeLocalMediaState | null) => {
    try {
      if (state) {
        sessionStorage.setItem(WELCOME_LOCAL_MEDIA_KEY, JSON.stringify(state));
      } else {
        sessionStorage.removeItem(WELCOME_LOCAL_MEDIA_KEY);
      }
    } catch (e) {
      console.warn('SessionStorage not available:', e);
    }
  };
  
  const getHasLocalMediaChanges = (): boolean => {
    return getLocalMediaState() !== null;
  };
  
  // Cache CV signed URL permanently to avoid re-resolving when revisiting CV-steget
  const [cachedCvUrl, setCachedCvUrl] = useState<string | null>(null);
  
  
  
  // Undo state - store deleted media for restore
  const [deletedProfileMedia, setDeletedProfileMedia] = useState<{
    profileImageUrl: string;
    coverImageUrl: string;
    profileMediaType: string;
  } | null>(null);
  
  // Undo state for deleted cover image
  const [deletedCoverImage, setDeletedCoverImage] = useState<string | null>(null);
  
  // Track dropdown open states for arrow rotation animation
  const [employmentStatusOpen, setEmploymentStatusOpen] = useState(false);
  const [workingHoursOpen, setWorkingHoursOpen] = useState(false);
  const [availabilityOpen, setAvailabilityOpen] = useState(false);
  
  // Image editor states
  const [imageEditorOpen, setImageEditorOpen] = useState(false);
  const [coverEditorOpen, setCoverEditorOpen] = useState(false);
  const [pendingImageSrc, setPendingImageSrc] = useState<string>('');
  const [pendingCoverSrc, setPendingCoverSrc] = useState<string>('');
  const [originalProfileImageFile, setOriginalProfileImageFile] = useState<File | null>(null);
  const [originalCoverImageFile, setOriginalCoverImageFile] = useState<File | null>(null);

  // Form data
  const [formData, setFormData] = useState({
    firstName: profile?.first_name || '',
    lastName: profile?.last_name || '',
    email: user?.email || '',
    bio: profile?.bio || '',
    location: profile?.location || '',
    phone: profile?.phone || '',
    birthDate: '',
    employmentStatus: (profile as any)?.employment_type || '', // Fixed: employment_type not employment_status
    workingHours: (profile as any)?.work_schedule || '', // Fixed: work_schedule not working_hours
    availability: (profile as any)?.availability || '', // Tillgänglighet
    profileImageUrl: profile?.profile_image_url || '',
    profileMediaType: 'image', // 'image' or 'video'
    coverImageUrl: '', // Cover image for videos
    cvUrl: '',
    cvFileName: '',
    interests: [] as string[],
    consentGiven: false // New field for data sharing consent
  });
  
  // Update form data when profile/user loads (for pre-filled registration data)
  useEffect(() => {
    if (profile || user) {
      setFormData(prev => ({
        ...prev,
        firstName: profile?.first_name || prev.firstName,
        lastName: profile?.last_name || prev.lastName,
        email: user?.email || prev.email,
        phone: profile?.phone || prev.phone,
        bio: profile?.bio || prev.bio,
        location: profile?.location || prev.location,
        employmentStatus: (profile as any)?.employment_type || prev.employmentStatus,
        workingHours: (profile as any)?.work_schedule || prev.workingHours,
        availability: (profile as any)?.availability || prev.availability,
      }));
    }
  }, [profile, user]);
  const [inputType, setInputType] = useState('text');
  const [phoneError, setPhoneError] = useState('');
  const [postalCode, setPostalCode] = useState((profile as any)?.postal_code || '');
  const [userLocation, setUserLocation] = useState((profile as any)?.location || '');
  const [hasValidLocation, setHasValidLocation] = useState(false);
  
  // Update postal code and location when profile loads
  useEffect(() => {
    if (profile) {
      if ((profile as any)?.postal_code) {
        setPostalCode((profile as any).postal_code);
      }
      if ((profile as any)?.location) {
        setUserLocation((profile as any).location);
      }
    }
  }, [profile]);
  
  // Save form data to localStorage for persistence across page refreshes
  useEffect(() => {
    // Check if there's meaningful content to save
    const hasContent = formData.firstName.trim() || formData.lastName.trim() || 
                       formData.bio.trim() || formData.phone.trim() ||
                       formData.employmentStatus || formData.workingHours ||
                       formData.availability || formData.birthDate ||
                       postalCode;
    
    if (hasContent) {
      try {
        localStorage.setItem(WELCOME_DRAFT_KEY, JSON.stringify({
          formData,
          postalCode,
          userLocation,
          currentStep,
          savedAt: Date.now()
        }));
      } catch (e) {
        console.warn('Failed to save welcome tunnel draft');
      }
    }
  }, [formData, postalCode, userLocation, currentStep]);
  
  // Restore draft from localStorage on mount
  useEffect(() => {
    try {
      const savedDraft = localStorage.getItem(WELCOME_DRAFT_KEY);
      if (savedDraft) {
        const parsed = JSON.parse(savedDraft);
        // Only restore if saved recently (within 7 days)
        if (parsed.savedAt && Date.now() - parsed.savedAt < 7 * 24 * 60 * 60 * 1000) {
          if (parsed.formData) {
            console.log('📝 Restoring welcome tunnel draft from localStorage');
            setFormData(prev => ({
              ...prev,
              ...parsed.formData,
              // Don't override media URLs from profile
              profileImageUrl: prev.profileImageUrl || parsed.formData.profileImageUrl,
            }));
          }
          if (parsed.postalCode) setPostalCode(parsed.postalCode);
          if (parsed.userLocation) setUserLocation(parsed.userLocation);
        } else {
          // Clear old draft
          localStorage.removeItem(WELCOME_DRAFT_KEY);
        }
      }
    } catch (e) {
      console.warn('Failed to restore welcome tunnel draft');
    }
  }, []); // Run only on mount
  
  // Clear draft helper
  const clearWelcomeDraft = () => {
    try {
      localStorage.removeItem(WELCOME_DRAFT_KEY);
      console.log('🗑️ Welcome tunnel draft cleared');
    } catch (e) {
      console.warn('Failed to clear welcome draft');
    }
  };
 
  // Use mediaUrl hooks for signed URLs
  const signedProfileImageUrl = useMediaUrl(
    formData.profileImageUrl, 
    formData.profileMediaType === 'video' ? 'profile-video' : 'profile-image'
  );
  const signedCoverUrl = useMediaUrl(formData.coverImageUrl, 'cover-image');


  // Intelligent CV caching: Generera signed URL EN GÅNG och cacha permanent
  // så CV:et laddas aldrig om när användaren navigerar mellan steg
  useEffect(() => {
    // Start preloading IMMEDIATELY when CV exists, regardless of step - background loading
    if (formData.cvUrl && !cachedCvUrl) {
      const cacheCv = async () => {
        try {
          const signedUrl = await getMediaUrl(formData.cvUrl, 'cv', 86400);
          if (signedUrl) {
            // Cacha URL:en permanent - används direkt av CvViewer för instant visning
            setCachedCvUrl(signedUrl);
            
            // Preloadea också i service worker för offline-tillgänglighet
            const { preloadSingleFile } = await import('@/lib/serviceWorkerManager');
            await preloadSingleFile(signedUrl);
            setCvPreloaded(true);
            
            console.log('CV cached and preloaded in background - ready before step 3 ✓');
          }
        } catch (error) {
          console.log('CV caching skipped:', error);
        }
      };
      cacheCv();
    }
  }, [formData.cvUrl, cachedCvUrl]);

  // Use centralized phone validation
  const validatePhoneNumber = (phoneNumber: string) => {
    return validateSwedishPhoneNumber(phoneNumber, true);
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

  const handlePhoneChange = (value: string) => {
    // Filter out non-numeric characters except + (for +46)
    const filteredValue = value.replace(/[^0-9+]/g, '');
    handleInputChange('phone', filteredValue);
    const validation = validatePhoneNumber(filteredValue);
    setPhoneError(validation.error);
  };

  // Load existing media as storage paths (not URLs) when component mounts
  useEffect(() => {
    // 🔒 CRITICAL: Restore local media state from sessionStorage if it exists
    const localMedia = getLocalMediaState();
    if (localMedia) {
      setFormData(prev => ({
        ...prev,
        profileImageUrl: localMedia.profileImageUrl,
        profileMediaType: localMedia.profileMediaType,
        coverImageUrl: localMedia.coverImageUrl,
        cvUrl: localMedia.cvUrl
      }));
      return;
    }
    
    const loadExistingMedia = async () => {
      if (profile?.profile_image_url || profile?.video_url || profile?.cv_url) {
        const updates: any = {};
        
        // Handle profile image/video - store as path
        if (profile.video_url) {
          let videoPath = profile.video_url;
          if (videoPath.includes('/profile-media/')) {
            const match = videoPath.match(/\/profile-media\/(.+?)(\?|$)/);
            if (match) videoPath = match[1];
          }
          updates.profileImageUrl = videoPath;
          updates.profileMediaType = 'video';
          
          if (profile.cover_image_url) {
            let coverPath = profile.cover_image_url;
            if (coverPath.includes('/profile-media/')) {
              const match = coverPath.match(/\/profile-media\/(.+?)(\?|$)/);
              if (match) coverPath = match[1];
            }
            updates.coverImageUrl = coverPath;
          }
        } else if (profile.profile_image_url) {
          let imagePath = profile.profile_image_url;
          if (imagePath.includes('/profile-media/')) {
            const match = imagePath.match(/\/profile-media\/(.+?)(\?|$)/);
            if (match) imagePath = match[1];
          }
          updates.profileImageUrl = imagePath;
          updates.profileMediaType = 'image';
        }
        
        if (profile.cv_url) {
          updates.cvUrl = profile.cv_url;
        }
        
        if (Object.keys(updates).length > 0) {
          setFormData(prev => ({ ...prev, ...updates }));
        }
      }
    };
    
    loadExistingMedia();
  }, [profile]);

  const totalSteps = 9; // Introduktion + 6 profil steg + samtycke + submit + slutskärm
  const progress = currentStep / (totalSteps - 1) * 100;

  const countWords = (text: string) => {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  };

  const handleInputChange = (field: string, value: string | string[] | boolean) => {
    if (field === 'bio' && typeof value === 'string') {
      const wordCount = countWords(value);
      if (wordCount <= 100) {
        setFormData(prev => ({ ...prev, [field]: value }));
      }
      return;
    }
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleNext = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
    }
  };
  
  // Preload next step content when on previous step
  useEffect(() => {
    // Preload avatar/initials for step 2 when on step 1
    if (currentStep === 1 && formData.firstName && formData.lastName) {
      // Force browser to calculate and cache the avatar component
      const initials = `${formData.firstName?.[0]?.toUpperCase() || ''}${formData.lastName?.[0]?.toUpperCase() || ''}`;
      // This triggers the browser to pre-render/cache the text
      const tempDiv = document.createElement('div');
      tempDiv.style.cssText = 'position:absolute;opacity:0;pointer-events:none;font-size:36px;font-weight:600;';
      tempDiv.textContent = initials;
      document.body.appendChild(tempDiv);
      // Force reflow to ensure rendering
      tempDiv.offsetHeight;
      // Cleanup after a tick
      requestAnimationFrame(() => {
        if (document.body.contains(tempDiv)) {
          document.body.removeChild(tempDiv);
        }
      });
    }
  }, [currentStep, formData.firstName, formData.lastName]);

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    } else if (currentStep === 1) {
      setCurrentStep(-1); // Go back to SwipeIntro instead of the removed welcome slide
    }
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
      
      // Preserve current profile image as cover if none set yet and uploading video
      if (isVideo && !formData.coverImageUrl && formData.profileImageUrl && formData.profileMediaType === 'image') {
        handleInputChange('coverImageUrl', formData.profileImageUrl);
      }
      
      // Store the storage path (not the URL) so it never expires
      handleInputChange('profileImageUrl', storagePath);
      handleInputChange('profileMediaType', isVideo ? 'video' : 'image');
      // 🔒 Save to sessionStorage to survive remounts
      const newCoverUrl = isVideo && !formData.coverImageUrl && formData.profileImageUrl && formData.profileMediaType === 'image' 
        ? formData.profileImageUrl 
        : formData.coverImageUrl;
      setLocalMediaState({
        profileImageUrl: storagePath,
        profileMediaType: isVideo ? 'video' : 'image',
        coverImageUrl: newCoverUrl,
        cvUrl: formData.cvUrl
      });
      
      toast({
        title: `${isVideo ? 'Video' : 'Bild'} uppladdad!`,
        description: `Din profil${isVideo ? 'video' : 'bild'} har laddats upp.`
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
    if (!user?.id) {
      toast({
        title: "Fel vid uppladdning",
        description: "Användare saknas.",
        variant: "destructive"
      });
      return;
    }

    setIsUploadingCover(true);
    
    try {
      // Använd mediaManager för cover-bild uppladdning
      const { storagePath, error: uploadError } = await uploadMedia(
        file,
        'cover-image',
        user.id
      );

      if (uploadError) {
        throw uploadError;
      }
      
      // Store the storage path directly
      handleInputChange('coverImageUrl', storagePath);
      // 🔒 Save to sessionStorage to survive remounts
      setLocalMediaState({
        profileImageUrl: formData.profileImageUrl,
        profileMediaType: formData.profileMediaType,
        coverImageUrl: storagePath,
        cvUrl: formData.cvUrl
      });
      
      toast({
        title: "Cover-bild uppladdad!",
        description: "Din cover-bild har laddats upp."
      });
    } catch (error) {
      console.error('Cover upload error:', error);
      toast({
        title: "Fel vid uppladdning",
        description: error instanceof Error ? error.message : "Kunde inte ladda upp cover-bilden.",
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
      // Förbättrad video-validering med specifika felmeddelanden
      let proceeded = false;
      let metadataAttempted = false;
      
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.crossOrigin = 'anonymous'; // Hjälper med vissa videofiler

      const revoke = () => {
        try { URL.revokeObjectURL(video.src); } catch (revokeError) {
          console.warn('Failed to revoke video object URL:', revokeError);
        }
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
          // Video är OK - ladda upp
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

      // Längre timeout för stora filer + mer specifik feedback
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
      }, 8000); // Längre timeout för stora filer

      // Lyssna på progress för att ge feedback om laddning
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
      // Handle image - open editor
      // Spara originalfilen för framtida redigeringar
      setOriginalProfileImageFile(file);
      const imageUrl = URL.createObjectURL(file);
      setPendingImageSrc(imageUrl);
      setImageEditorOpen(true);
    }
  };

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;

    // Spara originalfilen för framtida redigeringar
    setOriginalCoverImageFile(file);
    const imageUrl = URL.createObjectURL(file);
    setPendingCoverSrc(imageUrl);
    setCoverEditorOpen(true);
  };

  const handleEditExistingCover = async () => {
    if (!formData.coverImageUrl) return;
    
    // 1) Om vi har en explicit uppladdad cover-bild, använd den ursprungliga filen
    if (originalCoverImageFile) {
      const imageUrl = URL.createObjectURL(originalCoverImageFile);
      setPendingCoverSrc(imageUrl);
      setCoverEditorOpen(true);
      return;
    }

    // 2) Om cover-bilden kommer från en tidigare profilbild (video + auto-cover),
    //    använd den ursprungliga profilbildsfilen som "original" för covern
    if (formData.profileMediaType === 'video' && originalProfileImageFile) {
      const imageUrl = URL.createObjectURL(originalProfileImageFile);
      setPendingCoverSrc(imageUrl);
      setCoverEditorOpen(true);
      return;
    }

    // 3) Fallback: hämta signerad URL för befintlig cover-bild från lagring
    try {
      const signedUrl = await getMediaUrl(formData.coverImageUrl, 'cover-image', 86400);
      if (signedUrl) {
        setPendingCoverSrc(signedUrl);
        setCoverEditorOpen(true);
      }
    } catch (error) {
      console.error('Error loading existing cover:', error);
      toast({
        title: "Fel",
        description: "Kunde inte ladda cover-bilden för redigering.",
        variant: "destructive"
      });
    }
  };

  const handleEditExistingProfile = async () => {
    // Kan endast redigera bilder, inte videor
    if (!formData.profileImageUrl || formData.profileMediaType === 'video') return;
    
    // Visa alltid originalbilden i editorn (om den finns)
    if (originalProfileImageFile) {
      const imageUrl = URL.createObjectURL(originalProfileImageFile);
      setPendingImageSrc(imageUrl);
      setImageEditorOpen(true);
    } else {
      // Fallback: Hämta den signerade URL:en för den befintliga profilbilden
      try {
        const signedUrl = await getMediaUrl(formData.profileImageUrl, 'profile-image', 86400);
        if (signedUrl) {
          setPendingImageSrc(signedUrl);
          setImageEditorOpen(true);
        }
      } catch (error) {
        console.error('Error loading profile image for editing:', error);
        toast({
          title: "Fel",
          description: "Kunde inte ladda bilden för redigering",
          variant: "destructive"
        });
      }
    }
  };

  const handleProfileImageSave = async (editedBlob: Blob) => {
    try {
      setIsUploadingMedia(true);
      setUploadingMediaType('image');
      
      const { data } = await supabase.auth.getUser();
      if (!data.user) throw new Error('User not authenticated');

      // Skapa File från Blob så vi kan återanvända mediaManager-logiken
      const editedFile = new File([editedBlob], 'profile-image.jpg', { type: 'image/jpeg' });

      // Ladda upp till privata bucketen via mediaManager (sparar endast storage path)
      const { storagePath, error: uploadError } = await uploadMedia(
        editedFile,
        'profile-image',
        data.user.id
      );

      if (uploadError || !storagePath) throw uploadError || new Error('Upload failed');

      // Förladda den signerade URL:en i bakgrunden (utan att blockera UI)
      import('@/lib/serviceWorkerManager').then(async ({ preloadSingleFile }) => {
        const signed = await getMediaUrl(storagePath, 'profile-image', 86400);
        if (signed) {
          preloadSingleFile(signed).catch(err => console.log('Preload error:', err));
        }
      });
      
      // Uppdatera lokalt state i tunneln (sparas vid handleSubmit)
      handleInputChange('profileImageUrl', storagePath);
      handleInputChange('profileMediaType', 'image');
      // 🔒 Save to sessionStorage to survive remounts
      setLocalMediaState({
        profileImageUrl: storagePath,
        profileMediaType: 'image',
        coverImageUrl: formData.coverImageUrl,
        cvUrl: formData.cvUrl
      });
      
      setImageEditorOpen(false);
      // Cleanup blob URL
      if (pendingImageSrc) {
        URL.revokeObjectURL(pendingImageSrc);
      }
      setPendingImageSrc('');
    } catch (error) {
      console.error('Profile image upload error:', error);
      toast({
        title: "Fel vid uppladdning",
        description: "Kunde inte ladda upp bilden.",
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
      
      const { data } = await supabase.auth.getUser();
      if (!data.user) throw new Error('User not authenticated');

      // Skapa File från Blob så vi kan återanvända mediaManager-logiken
      const editedFile = new File([editedBlob], 'cover-image.jpg', { type: 'image/jpeg' });

      // Ladda upp till privata bucketen via mediaManager (sparar endast storage path)
      const { storagePath, error: uploadError } = await uploadMedia(
        editedFile,
        'cover-image',
        data.user.id
      );

      if (uploadError || !storagePath) throw uploadError || new Error('Upload failed');

      // Förladda den signerade URL:en i bakgrunden (utan att blockera UI)
      import('@/lib/serviceWorkerManager').then(async ({ preloadSingleFile }) => {
        const signed = await getMediaUrl(storagePath, 'cover-image', 86400);
        if (signed) {
          preloadSingleFile(signed).catch(err => console.log('Preload error:', err));
        }
      });
      
      // Uppdatera lokalt state i tunneln (sparas vid handleSubmit)
      handleInputChange('coverImageUrl', storagePath);
      // 🔒 Save to sessionStorage to survive remounts
      setLocalMediaState({
        profileImageUrl: formData.profileImageUrl,
        profileMediaType: formData.profileMediaType,
        coverImageUrl: storagePath,
        cvUrl: formData.cvUrl
      });
      
      setCoverEditorOpen(false);
      // Cleanup blob URL
      if (pendingCoverSrc) {
        URL.revokeObjectURL(pendingCoverSrc);
      }
      setPendingCoverSrc('');
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
    // Save current values for undo so we can restore exakt samma läge
    setDeletedProfileMedia({
      profileImageUrl: formData.profileImageUrl,
      coverImageUrl: formData.coverImageUrl,
      profileMediaType: formData.profileMediaType
    });

    const isVideoWithCover = formData.profileMediaType === 'video' && !!formData.coverImageUrl;

    // Uppdatera all media i ett enda state-anrop för att undvika visuella "blixtrar"
    let newProfileImageUrl = '';
    let newProfileMediaType = 'image';
    let newCoverImageUrl = '';
    
    if (isVideoWithCover) {
      // Video tas bort, cover-bilden blir ny profilbild
      newProfileImageUrl = formData.coverImageUrl;
      newProfileMediaType = 'image';
      newCoverImageUrl = '';
    }
    
    setFormData(prev => ({
      ...prev,
      profileImageUrl: newProfileImageUrl,
      profileMediaType: newProfileMediaType,
      coverImageUrl: newCoverImageUrl
    }));

    // 🔒 Save deleted state to sessionStorage to survive remounts
    setLocalMediaState({
      profileImageUrl: newProfileImageUrl,
      profileMediaType: newProfileMediaType,
      coverImageUrl: newCoverImageUrl,
      cvUrl: formData.cvUrl
    });

    if (isVideoWithCover) {
      toast({
        title: "Video borttagen",
        description: "Din cover-bild är nu din profilbild"
      });
    } else {
      toast({
        title: "Media borttagen",
        description: "Din profilvideo har tagits bort"
      });
    }

    // Reset the file input to allow new uploads
    const fileInput = document.getElementById('profileMedia') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  };

  const restoreProfileMedia = () => {
    if (!deletedProfileMedia) return;

    // Återställ alla värden i ett enda state-anrop för mjukare övergång
    setFormData(prev => ({
      ...prev,
      profileImageUrl: deletedProfileMedia.profileImageUrl,
      coverImageUrl: deletedProfileMedia.coverImageUrl,
      profileMediaType: deletedProfileMedia.profileMediaType,
    }));

    // 🔒 Update sessionStorage with restored values
    setLocalMediaState({
      profileImageUrl: deletedProfileMedia.profileImageUrl,
      profileMediaType: deletedProfileMedia.profileMediaType,
      coverImageUrl: deletedProfileMedia.coverImageUrl,
      cvUrl: formData.cvUrl
    });

    // Clear undo data
    setDeletedProfileMedia(null);

    toast({
      title: "Återställd!",
      description: "Din profilvideo har återställts"
    });
  };

  const deleteCoverImage = () => {
    // Save current cover image for undo
    setDeletedCoverImage(formData.coverImageUrl);

    handleInputChange('coverImageUrl', '');

    // 🔒 Save deleted state to sessionStorage to survive remounts
    setLocalMediaState({
      profileImageUrl: formData.profileImageUrl,
      profileMediaType: formData.profileMediaType,
      coverImageUrl: '',
      cvUrl: formData.cvUrl
    });

    toast({
      title: "Cover-bild borttagen", 
      description: "Din cover-bild har tagits bort"
    });
  };

  const restoreCoverImage = () => {
    if (!deletedCoverImage) return;

    // Restore cover image
    handleInputChange('coverImageUrl', deletedCoverImage);

    // 🔒 Update sessionStorage with restored values
    setLocalMediaState({
      profileImageUrl: formData.profileImageUrl,
      profileMediaType: formData.profileMediaType,
      coverImageUrl: deletedCoverImage,
      cvUrl: formData.cvUrl
    });

    // Clear undo data
    setDeletedCoverImage(null);

    toast({
      title: "Återställd!",
      description: "Din cover-bild har återställts"
    });
  };

  const handleSubmit = async () => {
    // Check if online before submitting
    if (!navigator.onLine) {
      toast({
        title: 'Offline',
        description: 'Du måste vara online för att slutföra registreringen',
        variant: 'destructive'
      });
      return;
    }
    
    setIsSubmitting(true);
    try {
      console.log('Starting profile update with data:', {
        first_name: formData.firstName,
        last_name: formData.lastName,
        bio: formData.bio,
        location: formData.location,
        postal_code: postalCode,
        phone: formData.phone,
        birth_date: formData.birthDate || null,
        employment_type: formData.employmentStatus, // Fixed: employment_type
        work_schedule: formData.workingHours, // Fixed: work_schedule
        availability: formData.availability,
        cv_url: formData.cvUrl,
        cv_filename: formData.cvFileName,
        profile_image_url: formData.profileMediaType === 'video' ? null : formData.profileImageUrl,
        video_url: formData.profileMediaType === 'video' ? formData.profileImageUrl : null,
        cover_image_url: formData.coverImageUrl || null,
        onboarding_completed: true
      });

      // First, save consent
      if (formData.consentGiven) {
        const { error: consentError } = await supabase
          .from('user_data_consents')
          .upsert({
            user_id: user?.id,
            consent_given: true,
            consent_date: new Date().toISOString(),
          }, {
            onConflict: 'user_id'
          });

        if (consentError) {
          console.error('Consent save failed:', consentError);
          throw new Error('Could not save consent: ' + consentError.message);
        }
      }

      const result = await updateProfile({
        first_name: formData.firstName,
        last_name: formData.lastName,
        bio: formData.bio,
        location: formData.location,
        city: userLocation, // Save city separately for consistency
        postal_code: postalCode,
        phone: formData.phone,
        birth_date: formData.birthDate || null,
        employment_type: formData.employmentStatus, // Fixed: employment_type
        work_schedule: formData.workingHours, // Fixed: work_schedule
        availability: formData.availability,
        cv_url: formData.cvUrl,
        cv_filename: formData.cvFileName,
        // Fix: Properly save profile media and cover image
        profile_image_url: formData.profileMediaType === 'video' ? null : formData.profileImageUrl,
        video_url: formData.profileMediaType === 'video' ? formData.profileImageUrl : null,
        cover_image_url: formData.coverImageUrl || null, // Save cover image correctly
        onboarding_completed: true // Mark onboarding as completed
      } as any);
      
      console.log('Profile update result:', result);
      
      if (result?.error) {
        console.error('Profile update failed:', result.error);
        throw new Error('Profile update failed: ' + result.error);
      }
      
      setCurrentStep(totalSteps - 1); // Go to completion step
      setLocalMediaState(null); // 🔒 Clear sessionStorage after successful save
      clearWelcomeDraft(); // Clear localStorage draft after successful save

      setTimeout(() => {
        toast({
          title: "Välkommen till Parium!",
          description: "Din profil är nu skapad och du kan börja söka jobb."
        });
        onComplete();
      }, 2000);
    } catch (error) {
      console.error('Error in handleSubmit:', error);
      toast({
        title: "Ett fel uppstod",
        description: "Kunde inte skapa profilen. Försök igen.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isStepValid = () => {
    switch (currentStep) {
      case 0: return true; // Intro
      case 1: 
        const requiredFields = !!(formData.firstName.trim() && formData.lastName.trim() && formData.email.trim() && formData.phone.trim() && formData.birthDate.trim() && formData.location.trim() && formData.employmentStatus.trim());
        const phoneValid = validatePhoneNumber(formData.phone).isValid;
        const locationValid = hasValidLocation; // Must have valid postal code/location
        // Only require workingHours if NOT arbetssokande AND employment status is selected
        const workingHoursValid = formData.employmentStatus === 'arbetssokande' || !formData.employmentStatus || formData.workingHours.trim();
        // Only require availability if employment status is selected
        const availabilityValid = !formData.employmentStatus || formData.availability.trim();
        return requiredFields && phoneValid && locationValid && workingHoursValid && availabilityValid;
      case 2: return true; // Profile image is optional
      case 3: return !!formData.cvUrl.trim(); // CV is now required
      case 4: return true; // Bio is optional
      case 5: return formData.consentGiven; // Consent is required
      case 6: return true; // Submit step
      default: return false;
    }
  };

  const toggleInterest = (interest: string) => {
    const currentInterests = formData.interests;
    if (currentInterests.includes(interest)) {
      handleInputChange('interests', currentInterests.filter(i => i !== interest));
    } else {
      handleInputChange('interests', [...currentInterests, interest]);
    }
  };

  // Render SwipeIntro fullscreen
  if (currentStep === -1) {
    return <SwipeIntro onComplete={() => setCurrentStep(1)} />;
  }

  function renderCvStep() {
    return (
      <div className="space-y-6">
        <div className="text-center mb-8">
          <div className="bg-white/20 backdrop-blur-sm p-4 rounded-full w-fit mx-auto mb-4">
            <FileText className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-xl md:text-2xl font-semibold mb-2 text-white tracking-tight">CV</h2>
          <p className="text-sm text-white">Ladda upp ditt CV för att visa din erfarenhet</p>
        </div>

        <div className="flex flex-col items-center space-y-4">
          <FileUpload 
            onFileUploaded={async (url, fileName) => {
              handleInputChange('cvUrl', url);
              handleInputChange('cvFileName', fileName);
              // Clear cached URL så den regenereras vid nästa visning
              setCachedCvUrl(null);
              
              // 🚀 TRIGGER PROACTIVE AI ANALYSIS IMMEDIATELY in background
              // So the summary is ready before employer or user views the profile
              if (user?.id && url) {
                console.log('🤖 Triggering proactive CV analysis in background...');
                supabase.functions.invoke('generate-cv-summary', {
                  body: {
                    applicant_id: user.id,
                    cv_url_override: url,
                    proactive: true
                  }
                }).then(({ data, error }) => {
                  if (error) {
                    console.error('Background CV analysis error:', error);
                  } else {
                    console.log('✅ Background CV analysis complete:', data?.is_valid_cv ? 'Valid CV' : data?.document_type);
                  }
                }).catch(err => console.error('CV analysis failed:', err));
              }
            }} 
            onFileRemoved={() => {
              handleInputChange('cvUrl', '');
              handleInputChange('cvFileName', '');
              setCachedCvUrl(null); // Clear cache när CV tas bort
            }}
            acceptedFileTypes={['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']} 
            maxFileSize={10 * 1024 * 1024} 
            currentFile={formData.cvUrl ? { 
              url: cachedCvUrl || formData.cvUrl, // Use cached URL for instant loading
              name: 'Din valda fil' 
            } : undefined} 
          />
          {formData.cvUrl && (
            <Badge variant="secondary" className="bg-white/20 text-white hover:bg-white/20">
              CV uppladdat!
            </Badge>
          )}
        </div>
      </div>
    );
  }
  
  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="text-center space-y-8 py-8">
            <div className="space-y-6">
              {/* Removed center icon for cleaner, minimal hero */}
              <div className="h-2" />
              
              <div className="space-y-4">
                <h1 className="text-xl font-semibold text-white animate-fade-in leading-tight">Välkommen till Parium</h1>
                
                <div className="space-y-1">
                  <p className="text-sm text-white animate-fade-in leading-relaxed">Framtiden börjar med ett swipe</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-2xl mx-auto">
              <div className="space-y-3 animate-fade-in transition-all duration-300 hover:scale-105 hover:bg-white/5 hover:border-white/50 p-4 rounded-xl cursor-pointer" style={{animationDelay: '0.2s'}}>
                <div className="p-4 rounded-full w-16 h-16 mx-auto flex items-center justify-center bg-white/20 backdrop-blur-sm transition-all duration-300 hover:bg-white/30 hover:scale-110">
                  <Sparkles className="h-8 w-8 text-white transition-transform duration-300 hover:rotate-12" />
                </div>
                <h3 className="text-white text-center font-semibold">Nästa generation av jobbsök är här</h3>
              </div>

              <div className="space-y-3 animate-fade-in transition-all duration-300 hover:scale-105 hover:bg-white/5 hover:border-white/50 p-4 rounded-xl cursor-pointer" style={{animationDelay: '0.4s'}}>
                <div className="p-4 rounded-full w-16 h-16 mx-auto flex items-center justify-center bg-white/20 backdrop-blur-sm transition-all duration-300 hover:bg-white/30 hover:scale-110">
                  <Target className="h-8 w-8 text-white transition-transform duration-300 hover:rotate-12" />
                </div>
                <h3 className="text-white text-center font-semibold">Hitta rätt. Snabbt. Enkelt.</h3>
              </div>

              <div className="space-y-3 animate-fade-in transition-all duration-300 hover:scale-105 hover:bg-white/5 hover:border-white/50 p-4 rounded-xl cursor-pointer" style={{animationDelay: '0.6s'}}>
                <div className="p-4 rounded-full w-16 h-16 mx-auto flex items-center justify-center bg-white/20 backdrop-blur-sm transition-all duration-300 hover:bg-white/30 hover:scale-110">
                  <Heart className="h-8 w-8 text-white transition-transform duration-300 hover:rotate-12" />
                </div>
                <h3 className="text-white text-center font-semibold">Jobbmatchning på ett helt nytt sätt</h3>
              </div>
            </div>

            <div className="text-center mt-8">
              <p className="text-lg md:text-xl text-white max-w-md mx-auto drop-shadow-sm font-semibold">Låt oss skapa din profil tillsammans</p>
            </div>
          </div>
        );

      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <div className="bg-white/20 backdrop-blur-sm p-4 rounded-full w-fit mx-auto mb-4">
                <User className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-xl md:text-2xl font-semibold mb-2 text-white tracking-tight">Låt oss lära känna dig</h2>
            </div>
            
            <div className="space-y-4 max-w-md mx-auto">
               <div>
                 <Label htmlFor="firstName" className="text-white">Förnamn</Label>
                 <Input 
                   id="firstName" 
                   value={formData.firstName} 
                   onChange={(e) => handleInputChange('firstName', e.target.value)} 
                   placeholder="Ditt förnamn" 
                   className="text-base bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10 hover:border-white/50 placeholder:text-white"
                 />
               </div>
               <div>
                 <Label htmlFor="lastName" className="text-white">Efternamn</Label>
                 <Input 
                   id="lastName" 
                   value={formData.lastName} 
                   onChange={(e) => handleInputChange('lastName', e.target.value)} 
                   placeholder="Ditt efternamn" 
                   className="text-base bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10 hover:border-white/50 placeholder:text-white"
                 />
               </div>
               <div>
                 <Label htmlFor="email" className="text-white">E-post</Label>
                 <Input 
                   id="email" 
                   type="email"
                   value={formData.email} 
                   onChange={(e) => handleInputChange('email', e.target.value)} 
                   placeholder="Din e-postadress" 
                   className="text-base bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10 hover:border-white/50 placeholder:text-white"
                 />
               </div>
                 <div>
                  <Label htmlFor="birthDate" className="text-white">Födelsedatum</Label>
                  <BirthDatePicker
                    value={formData.birthDate}
                    onChange={(date) => handleInputChange('birthDate', date)}
                    placeholder="Välj födelsedatum"
                    className="w-full"
                    popoverAlign="center"
                    popoverAlignOffset={-240}
                    alignToIcon={true}
                  />
                  {formData.birthDate && calculateAge(formData.birthDate) !== null && (
                    <p className="text-sm text-white mt-1">
                      {calculateAge(formData.birthDate)} år gammal
                    </p>
                  )}
                </div>
               <div>
                 <Label htmlFor="phone" className="text-white">
                   <Phone className="h-4 w-4 inline mr-2" />
                   Telefonnummer *
                 </Label>
                  <Input 
                    id="phone" 
                    type="tel" 
                    required
                    value={formData.phone} 
                    onChange={(e) => handlePhoneChange(e.target.value)} 
                    className="text-base bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10 hover:border-white/50 placeholder:text-white"
                    placeholder="070-123 45 67" 
                  />
                  {phoneError && (
                    <p className="text-destructive text-sm mt-1">{phoneError}</p>
                  )}
                </div>
               <WorkplacePostalCodeSelector
                 postalCodeValue={postalCode}
                 cityValue={userLocation}
                 onPostalCodeChange={setPostalCode}
                 onLocationChange={(city, postalCode, municipality, county) => {
                   setUserLocation(city);
                   handleInputChange('location', city);
                 }}
                 onValidationChange={setHasValidLocation}
               />
                  <div>
                   <Label htmlFor="employmentStatus" className="text-white text-sm font-medium">Vad gör du i dagsläget? <span className="text-white">*</span></Label>
                   <DropdownMenu modal={false} open={employmentStatusOpen} onOpenChange={setEmploymentStatusOpen}>
                       <DropdownMenuTrigger asChild>
                         <Button
                           variant="outlineNeutral"
                           className="w-full h-10 bg-white/5 backdrop-blur-sm border-white/10 text-white text-sm transition-all duration-300 md:hover:bg-white/10 md:hover:border-white/50 md:hover:text-white [&_svg]:text-white md:hover:[&_svg]:text-white justify-between"
                         >
                         <span className="truncate">
                           {formData.employmentStatus ? (
                             ({
                               tillsvidareanställning: 'Fast anställning',
                               visstidsanställning: 'Visstidsanställning',
                               provanställning: 'Provanställning',
                               interim: 'Interim anställning',
                               bemanningsanställning: 'Bemanningsanställning',
                               egenforetagare: 'Egenföretagare / Frilans',
                               arbetssokande: 'Arbetssökande',
                               annat: 'Annat',
                             } as Record<string, string>)[formData.employmentStatus]
                           ) : 'Välj din nuvarande situation'}
                         </span>
                         <ChevronDown className={`h-4 w-4 flex-shrink-0 transition-transform duration-300 ${employmentStatusOpen ? 'rotate-180' : ''}`} />
                       </Button>
                     </DropdownMenuTrigger>
                     <DropdownMenuContent 
                       className="w-72 bg-slate-900/85 backdrop-blur-xl border border-white/20 shadow-lg z-50 rounded-md text-white overflow-visible"
                       side="top"
                       align="center"
                       alignOffset={0}
                       sideOffset={6}
                       avoidCollisions={false}
                    >
                      <DropdownMenuItem onClick={() => handleInputChange('employmentStatus', 'tillsvidareanställning')} className="cursor-pointer hover:bg-white/10 focus:bg-white/10 py-3 text-white">
                        Fast anställning
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleInputChange('employmentStatus', 'visstidsanställning')} className="cursor-pointer hover:bg-white/10 focus:bg-white/10 py-3 text-white">
                        Visstidsanställning
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleInputChange('employmentStatus', 'provanställning')} className="cursor-pointer hover:bg-white/10 focus:bg-white/10 py-3 text-white">
                        Provanställning
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleInputChange('employmentStatus', 'interim')} className="cursor-pointer hover:bg-white/10 focus:bg-white/10 py-3 text-white">
                        Interim anställning
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleInputChange('employmentStatus', 'bemanningsanställning')} className="cursor-pointer hover:bg-white/10 focus:bg-white/10 py-3 text-white">
                        Bemanningsanställning
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleInputChange('employmentStatus', 'egenforetagare')} className="cursor-pointer hover:bg-white/10 focus:bg-white/10 py-3 text-white">
                        Egenföretagare / Frilans
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleInputChange('employmentStatus', 'arbetssokande')} className="cursor-pointer hover:bg-white/10 focus:bg-white/10 py-3 text-white">
                        Arbetssökande
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleInputChange('employmentStatus', 'annat')} className="cursor-pointer hover:bg-white/10 focus:bg-white/10 py-3 text-white">
                        Annat
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              {/* Visa arbetstid-frågan endast om användaren har valt något OCH det inte är arbetssökande */}
              {formData.employmentStatus && formData.employmentStatus !== 'arbetssokande' && (
                  <div>
                    <Label htmlFor="workingHours" className="text-white text-sm font-medium">Hur mycket jobbar du idag? <span className="text-white">*</span></Label>
                    <DropdownMenu modal={false} open={workingHoursOpen} onOpenChange={setWorkingHoursOpen}>
                        <DropdownMenuTrigger asChild>
                         <Button
                           variant="outline"
                           className="w-full h-10 bg-white/5 backdrop-blur-sm border-white/10 text-white text-sm transition-all duration-300 md:hover:bg-white/10 md:hover:border-white/50 md:hover:text-white [&_svg]:text-white md:hover:[&_svg]:text-white justify-between"
                         >
                          <span className="truncate">
                            {formData.workingHours ? (
                              ({
                                heltid: 'Heltid',
                                deltid: 'Deltid',
                                varierande: 'Varierande / Flexibelt',
                              } as Record<string, string>)[formData.workingHours]
                            ) : 'Välj arbetstid/omfattning'}
                          </span>
                          <ChevronDown className={`h-4 w-4 flex-shrink-0 transition-transform duration-300 ${workingHoursOpen ? 'rotate-180' : ''}`} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent 
                        className="w-72 max-h-80 overflow-y-auto bg-slate-900/85 backdrop-blur-xl border border-white/20 shadow-lg z-50 rounded-md text-white"
                       side="top"
                       align="center"
                       alignOffset={0}
                       sideOffset={6}
                       avoidCollisions={false}
                     >
                        <DropdownMenuItem onClick={() => handleInputChange('workingHours', 'heltid')} className="cursor-pointer hover:bg-white/10 focus:bg-white/10 py-3 text-white">
                          Heltid
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleInputChange('workingHours', 'deltid')} className="cursor-pointer hover:bg-white/10 focus:bg-white/10 py-3 text-white">
                          Deltid
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleInputChange('workingHours', 'varierande')} className="cursor-pointer hover:bg-white/10 focus:bg-white/10 py-3 text-white">
                          Varierande / Flexibelt
                        </DropdownMenuItem>
                     </DropdownMenuContent>
                   </DropdownMenu>
                 </div>
              )}
              {/* Visa tillgänglighet-frågan endast om användaren har valt något i employment status */}
              {formData.employmentStatus && (
                  <div>
                    <Label htmlFor="availability" className="text-white text-sm font-medium">När kan du börja nytt jobb? <span className="text-white">*</span></Label>
                    <DropdownMenu modal={false} open={availabilityOpen} onOpenChange={setAvailabilityOpen}>
                        <DropdownMenuTrigger asChild>
                         <Button
                           variant="outline"
                           className="w-full h-10 bg-white/5 backdrop-blur-sm border-white/10 text-white text-sm transition-all duration-300 md:hover:bg-white/10 md:hover:border-white/50 md:hover:text-white [&_svg]:text-white md:hover:[&_svg]:text-white justify-between"
                         >
                          <span className="truncate">
                            {formData.availability ? (
                              ({
                                omgaende: 'Omgående',
                                'inom-1-manad': 'Inom 1 månad',
                                'inom-3-manader': 'Inom 3 månader',
                                'inom-6-manader': 'Inom 6 månader',
                                'ej-aktuellt': 'Inte aktuellt just nu',
                                osaker: 'Osäker',
                              } as Record<string, string>)[formData.availability]
                            ) : 'Välj din tillgänglighet'}
                          </span>
                          <ChevronDown className={`h-4 w-4 flex-shrink-0 transition-transform duration-300 ${availabilityOpen ? 'rotate-180' : ''}`} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent 
                        className="w-72 bg-slate-900/85 backdrop-blur-xl border border-white/20 shadow-lg z-50 rounded-md text-white overflow-visible"
                       side="top"
                       align="center"
                       alignOffset={0}
                       sideOffset={6}
                       avoidCollisions={false}
                     >
                        <DropdownMenuItem onClick={() => handleInputChange('availability', 'omgaende')} className="cursor-pointer hover:bg-white/10 focus:bg-white/10 py-3 text-white">
                          Omgående
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleInputChange('availability', 'inom-1-manad')} className="cursor-pointer hover:bg-white/10 focus:bg-white/10 py-3 text-white">
                          Inom 1 månad
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleInputChange('availability', 'inom-3-manader')} className="cursor-pointer hover:bg-white/10 focus:bg-white/10 py-3 text-white">
                          Inom 3 månader
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleInputChange('availability', 'inom-6-manader')} className="cursor-pointer hover:bg-white/10 focus:bg-white/10 py-3 text-white">
                          Inom 6 månader
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleInputChange('availability', 'ej-aktuellt')} className="cursor-pointer hover:bg-white/10 focus:bg-white/10 py-3 text-white">
                          Inte aktuellt just nu
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleInputChange('availability', 'osaker')} className="cursor-pointer hover:bg-white/10 focus:bg-white/10 py-3 text-white">
                          Osäker
                        </DropdownMenuItem>
                     </DropdownMenuContent>
                   </DropdownMenu>
                 </div>
              )}
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h2 className="text-xl md:text-2xl font-semibold mb-2 text-white tracking-tight">Profilbild/Profilvideo</h2>
              <p className="text-sm text-white">Ladda upp en kort profilvideo eller en bild och gör ditt första intryck minnesvärt</p>
            </div>

            {/* Profile Image/Video Card - matching structure from Profile.tsx */}
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
                  {formData.profileImageUrl && formData.profileMediaType === 'video' ? (
                    <ProfileVideo
                      videoUrl={signedProfileImageUrl || ''}
                      coverImageUrl={signedCoverUrl || ''}
                      userInitials=""
                      alt="Profile video"
                      className="w-32 h-32 border-4 border-white/10 transition-all rounded-full overflow-hidden"
                    />
                  ) : (
                    <div 
                      className="cursor-pointer" 
                      onClick={() => document.getElementById('profileMedia')?.click()}
                    >
                      <Avatar className="h-32 w-32 border-4 border-white/10 [transition:border-color_0.2s]">
                        <AvatarImage 
                          src={formData.profileImageUrl ? (signedProfileImageUrl || '') : ''}
                          alt="Profilbild"
                          className="object-cover"
                          decoding="sync"
                          loading="eager"
                          fetchPriority="high"
                          draggable={false}
                        />
                        <AvatarFallback delayMs={0} className={`text-4xl font-semibold bg-white/20 text-white ${formData.profileImageUrl ? 'hidden' : ''}`}>
                          {((formData.firstName?.trim()?.[0]?.toUpperCase() || '') + (formData.lastName?.trim()?.[0]?.toUpperCase() || '')) || '?'}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                  )}

                  {/* Delete/Restore icon for profile media */}
                  {formData.profileImageUrl && !deletedProfileMedia && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteProfileMedia();
                      }}
                      className="absolute -top-3 -right-3 bg-white/20 hover:bg-destructive/30 backdrop-blur-sm text-white rounded-full p-2 shadow-lg"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                  
                  {/* Undo button - shown when media was just deleted */}
                  {deletedProfileMedia && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        restoreProfileMedia();
                      }}
                      className="absolute -top-3 -right-3 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white rounded-full p-2 shadow-lg"
                      title="Ångra borttagning"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </button>
                  )}

                  <input
                    id="profileMedia"
                    type="file"
                    accept="image/*,video/*"
                    onChange={handleMediaChange}
                    className="hidden"
                    disabled={isUploadingMedia}
                  />
                </div>

                <div className="space-y-2 text-center w-full px-4">
                  <Label 
                    htmlFor="profileMedia" 
                    className="text-white cursor-pointer hover:text-white transition-colors text-center text-sm"
                  >
                    Klicka här för att välja en bild eller video (max 60 sekunder)
                  </Label>
                  
                  {isUploadingMedia && (
                    <div className="flex flex-col items-center gap-2">
                      <Badge variant="outline" className="bg-white/10 text-white border-white/20 animate-pulse rounded-md px-3 py-1.5">
                        {uploadingMediaType === 'video' ? `${uploadProgress}%` : `Laddar upp bild...`}
                      </Badge>
                      {uploadingMediaType === 'video' && (
                        <p className="text-white text-xs">
                          (Obs, det kan ta uppemot 20-30 sekunder för att ladda upp en minuts video)
                        </p>
                      )}
                    </div>
                  )}
                  
                  {formData.profileImageUrl && !isUploadingMedia && (
                    <div className="flex flex-col items-center gap-2">
                      <Badge variant="outline" className="bg-white/20 text-white border-white/20 px-3 py-1 rounded-md">
                        {formData.profileMediaType === 'video' ? 'Video' : 'Bild'} uppladdad!
                      </Badge>
                      
                      {/* Anpassa knapp - endast för bilder */}
                      {formData.profileMediaType === 'image' && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={handleEditExistingProfile}
                          className="bg-white/5 backdrop-blur-sm border-white/10 !text-white hover:bg-white/10 hover:!text-white hover:border-white/50 md:hover:bg-white/10 md:hover:!text-white md:hover:border-white/50"
                        >
                          Anpassa din bild
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {/* Cover image upload - show when video exists */}
                {formData.profileMediaType === 'video' && formData.profileImageUrl && (
                  <div className="flex flex-col items-center space-y-3 mt-4 p-4 rounded-lg bg-white/5 w-full">
                    <div className="flex items-center gap-2 w-full justify-center">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          if (formData.coverImageUrl) {
                            handleEditExistingCover();
                          } else {
                            document.getElementById('coverImage')?.click();
                          }
                        }}
                        disabled={isUploadingCover}
                        className="bg-white/5 backdrop-blur-sm border-white/10 !text-white disabled:opacity-50 hover:bg-white/10 hover:!text-white hover:border-white/50 md:hover:bg-white/10 md:hover:!text-white md:hover:border-white/50"
                      >
                        {formData.coverImageUrl ? 'Anpassa din bild' : 'Lägg till cover-bild'}
                      </Button>
                      
                      {formData.coverImageUrl && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteCoverImage();
                          }}
                          className="bg-white/20 hover:bg-destructive/30 backdrop-blur-sm text-white rounded-full p-2 shadow-lg"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                      
                      {deletedCoverImage && !formData.coverImageUrl && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            restoreCoverImage();
                          }}
                          className="bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white rounded-full p-2 shadow-lg"
                          title="Ångra borttagning"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <Input 
                      type="file" 
                      id="coverImage" 
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
                    
                    {formData.coverImageUrl && !isUploadingCover && (
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
          </div>
        );

      case 3:
        return renderCvStep();

      case 4:
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <div className="bg-white/20 backdrop-blur-sm p-4 rounded-full w-fit mx-auto mb-4">
                <Briefcase className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-xl md:text-2xl font-semibold mb-2 text-white tracking-tight">Din profil</h2>
              <p className="text-sm text-white">Ge en kortare beskrivning om dig själv?</p>
            </div>

            <div className="space-y-4 max-w-md mx-auto">
              <div>
                <Label htmlFor="bio" className="text-white">Frivilligt</Label>
                <Textarea
                  id="bio"
                  className="text-base bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10 hover:border-white/50 placeholder:text-white" 
                  value={formData.bio}
                  onChange={(e) => handleInputChange('bio', e.target.value)}
                  placeholder="Berätta kort om dig själv..."
                />
                <div className="flex justify-end mt-1">
                  <span className="text-sm text-white">
                    {countWords(formData.bio)}/100 ord
                  </span>
                </div>
              </div>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <div className="bg-white/20 backdrop-blur-sm p-4 rounded-full w-fit mx-auto mb-4">
                <Users className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-xl md:text-2xl font-semibold mb-2 text-white tracking-tight">Dela din information</h2>
            </div>

            <div className="max-w-md mx-auto space-y-6">
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 space-y-4">
                <h3 className="text-white font-semibold mb-3">Detta kommer att delas med arbetsgivare:</h3>
                <div className="space-y-2 text-sm text-white">
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-400" />
                    <span>Din ålder</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-400" />
                    <span>Postnummer (för geografisk matchning)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-400" />
                    <span>Telefonnummer och e-post</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-400" />
                    <span>Kommun/stad (inte fullständig adress)</span>
                  </div>
                </div>
              </div>


              <div className="space-y-4">
                <label className="flex items-start gap-3 cursor-pointer bg-white/10 rounded-lg p-4 hover:bg-white/15 transition-colors">
                  <input
                    type="checkbox"
                    checked={formData.consentGiven}
                    onChange={(e) => handleInputChange('consentGiven', e.target.checked)}
                    className="mt-1 rounded border-white/30 bg-white/10 text-primary focus:ring-primary focus:ring-offset-0"
                  />
                  <div className="text-sm text-white">
                    <p className="font-medium mb-1">Jag godkänner att mina uppgifter delas</p>
                    <p className="text-white">Genom att kryssa i denna ruta godkänner jag att Parium delar ovanstående information med arbetsgivare när jag ansöker om jobb. Du kan när som helst återkalla detta samtycke från din profil.</p>
                  </div>
                </label>
              </div>
            </div>
          </div>
        );

      case 6:
        return (
          <div className="text-center space-y-8">
            <div className="bg-white/20 backdrop-blur-sm p-6 rounded-full w-fit mx-auto mb-6">
              <Check className="h-12 w-12 text-white" />
            </div>
            <div className="space-y-4">
              <h2 className="text-xl md:text-2xl font-semibold text-white tracking-tight">Profilen är klar</h2>
              <p className="text-sm text-white">Är du redo?</p>
            </div>
            <div className="flex flex-col items-center gap-4 pt-8">
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-12 py-6 bg-primary hover:bg-primary/90 hover:scale-105 transition-all duration-300 text-white font-bold text-xl rounded-2xl shadow-2xl"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                    Laddar...
                  </>
                ) : (
                  'Börja swipa'
                )}
              </Button>
              <Button
                variant="outlineNeutral"
                onClick={handlePrevious}
                className="px-8 py-3 bg-white/10 border border-white/20 text-white text-sm md:hover:text-white md:hover:bg-white/10 md:hover:border-white/20 hover:scale-105 transition-all duration-300"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Tillbaka
              </Button>
            </div>
          </div>
        );

      case 7:
        return (
          <div className="text-center space-y-6">
            <div className="bg-white/20 backdrop-blur-sm p-4 rounded-full w-fit mx-auto mb-4">
              <Check className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-xl font-semibold text-white">Profil skapad!</h2>
            <p className="text-sm text-white">
              Välkommen till Parium! Din profil är nu skapad och du kan börja söka jobb.
            </p>
            <img src={phoneWithPariumLogo} alt="Parium på en mobiltelefon" className="max-w-sm mx-auto rounded-xl shadow-lg" />
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-parium flex flex-col relative overflow-x-hidden">
      {/* Static animated background - identical to AuthMobile */}
      <div className="fixed inset-0 pointer-events-none z-0">
        
        
        {/* Animated floating elements - completely isolated from layout changes */}
        <div className="fixed top-20 left-10 w-4 h-4 bg-secondary/30 rounded-full animate-bounce pointer-events-none z-[1]" style={{ animationDuration: '2s' }}></div>
        <div className="fixed top-32 left-16 w-2 h-2 bg-accent/40 rounded-full animate-bounce pointer-events-none z-[1]" style={{ animationDuration: '2.5s' }}></div>
        <div className="fixed top-24 left-20 w-3 h-3 bg-secondary/20 rounded-full animate-bounce pointer-events-none z-[1]" style={{ animationDuration: '3s' }}></div>
        
        <div className="fixed bottom-40 right-20 w-5 h-5 bg-accent/30 rounded-full animate-bounce pointer-events-none z-[1]" style={{ animationDuration: '2.2s' }}></div>
        <div className="fixed bottom-32 right-16 w-3 h-3 bg-secondary/25 rounded-full animate-bounce pointer-events-none z-[1]" style={{ animationDuration: '2.8s' }}></div>
        <div className="fixed bottom-36 right-24 w-2 h-2 bg-accent/35 rounded-full animate-bounce pointer-events-none z-[1]" style={{ animationDuration: '2.3s' }}></div>
        
        {/* Pulsing lights */}
        <div className="fixed top-10 right-10 w-3 h-3 bg-secondary/40 rounded-full animate-pulse pointer-events-none z-[1]" style={{ animationDuration: '1.5s' }}></div>
        <div className="fixed top-16 right-20 w-2 h-2 bg-accent/30 rounded-full animate-pulse pointer-events-none z-[1]" style={{ animationDuration: '2s' }}></div>
        <div className="fixed top-12 left-8 w-3 h-3 bg-accent/40 rounded-full animate-pulse pointer-events-none z-[1]" style={{ animationDuration: '1.8s' }}></div>
        
        {/* Small stars */}
        <div className="fixed top-1/4 left-1/3 w-1 h-1 bg-accent/60 rounded-full animate-pulse pointer-events-none z-[1]" style={{ animationDuration: '3s' }}>
          <div className="absolute inset-0 bg-accent/40 rounded-full animate-ping" style={{ animationDuration: '3s' }}></div>
        </div>
        <div className="fixed top-1/3 right-1/3 w-1 h-1 bg-secondary/60 rounded-full animate-pulse pointer-events-none z-[1]" style={{ animationDuration: '2.5s' }}>
          <div className="absolute inset-0 bg-secondary/40 rounded-full animate-ping" style={{ animationDuration: '2.5s' }}></div>
        </div>
      </div>

      <div className="relative z-10">
        {/* Progress indicator */}
      {currentStep > 0 && currentStep < totalSteps - 1 && (
        <div className="w-full max-w-md mx-auto pt-8 px-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-white font-medium">Steg {currentStep} av {totalSteps - 3}</span>
            <span className="text-sm text-white font-medium">{Math.round(progress)}%</span>
          </div>
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-primary/30">
            <div 
              className="h-full bg-white transition-all duration-300" 
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center px-6 py-8 relative z-10">
        <div className="w-full max-w-2xl">
          <div className={currentStep === 3 ? 'block' : 'hidden'}>
            {renderCvStep()}
          </div>
          {currentStep !== 3 && renderStep()}
        </div>
      </div>

      {/* Navigation buttons */}
      {currentStep < totalSteps - 1 && currentStep < 6 && (
        <div className="w-full max-w-md mx-auto px-6 pb-8 relative z-10">
          <div className="flex gap-4">
            {currentStep > 0 && (
              <Button
                variant="outlineNeutral"
                onClick={handlePrevious}
                className="py-3 bg-white/5 border border-white/10 !text-white text-sm px-4"
              >
                <ArrowLeft className="h-4 w-4 mr-2 text-white" />
                Tillbaka
              </Button>
            )}
            
            {currentStep === 5 ? (
              <Button
                onClick={handleNext}
                disabled={!isStepValid()}
                variant="glass"
                className="flex-1 py-4 font-semibold text-lg"
              >
                Nästa
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : currentStep < 5 ? (
              <Button
                onClick={handleNext}
                disabled={!isStepValid()}
                variant="glass"
                className="flex-1 py-4 font-semibold text-lg"
              >
                {currentStep === 0 ? 'Kom igång' : 'Nästa'}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : null}
          </div>
        </div>
      )}
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
        isCircular={true}
      />
      
      <ImageEditor
        isOpen={coverEditorOpen}
        onClose={() => {
          setCoverEditorOpen(false);
          setPendingCoverSrc('');
        }}
        imageSrc={pendingCoverSrc}
        onSave={handleCoverImageSave}
        isCircular={true}
        aspectRatio={1}
      />
    </div>
  );
};

export default WelcomeTunnel;
