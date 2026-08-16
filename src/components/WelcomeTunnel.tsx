import { useState, useEffect, useRef, useCallback } from 'react';

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
import TunnelBirthDateField from '@/components/tunnel/TunnelBirthDateField';
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
import { fetchPriority } from '@/lib/fetchPriority';
import { RequiredMark } from '@/components/wizard/RequiredMark';
import TunnelSelectField from '@/components/tunnel/TunnelSelectField';
import WizardFooter from '@/components/wizard/WizardFooter';


interface WelcomeTunnelProps {
  onComplete: () => void;
  /** Developer-only: jump directly to a given step on mount */
  initialStep?: number;
  /** Developer-only: when true, no data is written to the database (Spara is mocked) */
  previewMode?: boolean;
}

// 🔒 Alla utkastnycklar är kontospecifika — ett nytt konto i samma flik/enhet
// får ALDRIG se data från ett tidigare konto.
const STEP_KEY_PREFIX = 'parium_welcome_step';
const TEXT_KEY_PREFIX = 'parium_welcome_text_draft';
const MEDIA_KEY_PREFIX = 'parium_welcome_local_media';
const WELCOME_KEY_PREFIXES = [STEP_KEY_PREFIX, TEXT_KEY_PREFIX, MEDIA_KEY_PREFIX];

const scopedKey = (prefix: string, uid?: string | null) => `${prefix}:${uid ?? 'anon'}`;

/** Rensar alla välkomstutkast som inte tillhör det inloggade kontot. */
const purgeForeignWelcomeDrafts = (uid: string) => {
  try {
    const keep = new Set(WELCOME_KEY_PREFIXES.map((p) => scopedKey(p, uid)));
    const toRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (!key) continue;
      if (WELCOME_KEY_PREFIXES.some((p) => key.startsWith(p)) && !keep.has(key)) {
        toRemove.push(key);
      }
    }
    toRemove.forEach((k) => sessionStorage.removeItem(k));
  } catch {
    /* noop */
  }
};

const WelcomeTunnel = ({ onComplete, initialStep, previewMode = false }: WelcomeTunnelProps) => {
  const { profile, updateProfile, refreshProfile, user, signOut } = useAuth();
  const { toast } = useToast();
  const userId = user?.id ?? null;

  // Rensa direkt (synkront) allt som hör till ett annat konto innan något läses in.
  const purgedForRef = useRef<string | null>(null);
  if (userId && purgedForRef.current !== userId) {
    purgedForRef.current = userId;
    purgeForeignWelcomeDrafts(userId);
  }

  const WELCOME_STEP_KEY = scopedKey(STEP_KEY_PREFIX, userId);

  const [currentStep, setCurrentStep] = useState(() => {
    if (typeof initialStep === 'number') return initialStep;
    try {
      const stored = Number(sessionStorage.getItem(scopedKey(STEP_KEY_PREFIX, userId)));
      // Återuppta bara på ett synligt ifyllnadssteg (1–6)
      if (Number.isFinite(stored) && stored >= 1 && stored <= 6) return stored;
    } catch {
      /* noop */
    }
    return 1;
  }); // Intro/SwipeIntro borttagen – vi startar direkt på uppgifterna

  // 🔒 Kom ihåg vilket steg användaren är på vid refresh (samma flik)
  useEffect(() => {
    if (!userId) return;
    try {
      if (currentStep >= 1 && currentStep <= 6) {
        sessionStorage.setItem(WELCOME_STEP_KEY, String(currentStep));
      } else {
        sessionStorage.removeItem(WELCOME_STEP_KEY);
      }
    } catch {
      /* noop */
    }
  }, [currentStep, userId, WELCOME_STEP_KEY]);


  const [isSubmitting, setIsSubmitting] = useState(false);
  const [redirectState, setRedirectState] = useState<'idle' | 'checking' | 'already_completed'>('idle');


  // 🔒 Säkerhetsventil: om profilen redan är färdigställd på annan enhet/flik,
  // omdirigera med tydlig UI så gammal flik inte skriver över eller konkurrerar med ny data.
  const isRedirectingRef = useRef(false);
  const redirectIfCompleted = useCallback((reason: string, delay = 2000) => {
    if (isRedirectingRef.current) return;
    isRedirectingRef.current = true;
    try {
      setLocalMediaState(null);
      clearTextDraft();
      sessionStorage.removeItem(WELCOME_STEP_KEY);
    } catch {
      /* noop */
    }
    setRedirectState('already_completed');
    console.log(`[WelcomeTunnel] redirectIfCompleted: ${reason}`);
    setTimeout(() => {
      onComplete();
    }, delay);
  }, [onComplete]);

  // Kontrollera direkt vid mount och när profilen laddas
  useEffect(() => {
    if (profile?.onboarding_completed && redirectState === 'idle') {
      redirectIfCompleted('onboarding_completed on mount/profile load', 1500);
    }
  }, [profile?.onboarding_completed, redirectState, redirectIfCompleted]);

  // Kontrollera när fliken blir synlig igen (t.ex. användare gick till mobil och tillbaka)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && currentStep >= 1 && currentStep <= 6 && redirectState !== 'already_completed') {
        setRedirectState('checking');
        refreshProfile().then(() => {
          if (profile?.onboarding_completed) {
            redirectIfCompleted('tab became visible, profile already completed');
          } else {
            setRedirectState('idle');
          }
        }).catch((err) => {
          console.warn('refreshProfile on visibility change failed:', err);
          setRedirectState('idle');
        });
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [currentStep, refreshProfile, profile?.onboarding_completed, redirectState, redirectIfCompleted]);


  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [uploadingMediaType, setUploadingMediaType] = useState<'image' | 'video' | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  
  // Track if CV has been preloaded to avoid redundant preloading
  const [cvPreloaded, setCvPreloaded] = useState(false);
  
  // 🔒 CRITICAL: Store local media values in sessionStorage to survive component remounts
  // Uppladdad media behålls inom den aktuella fliken tills profilen slutförs.
  const storageScope = userId ?? 'anon';
  const WELCOME_LOCAL_MEDIA_KEY = scopedKey(MEDIA_KEY_PREFIX, userId);

  // Om användaren går igenom välkomsttunneln ska introduktionsguiden alltid
  // kunna visas efteråt för det kontot — även i en webbläsare som sett den förut.
  useEffect(() => {
    if (previewMode || !user?.id) return;
    try { localStorage.removeItem(`parium_intro_tour_done:${user.id}`); } catch { /* ignorera */ }
    import('@/lib/onboardingState').then(({ resetIntroTourDone }) => resetIntroTourDone().catch(() => {}));
  }, [previewMode, user?.id]);


  
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

  // 🔒 Textfält sparas i sessionStorage (samma flik = överlever refresh, rensas när fliken stängs)
  const WELCOME_TEXT_KEY = scopedKey(TEXT_KEY_PREFIX, userId);

  const getTextDraft = (): Record<string, any> | null => {
    try {
      const stored = sessionStorage.getItem(WELCOME_TEXT_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  };

  const clearTextDraft = () => {
    try {
      sessionStorage.removeItem(WELCOME_TEXT_KEY);
    } catch {
      /* noop */
    }
  };

  // Form data
  const [formData, setFormData] = useState(() => {
    const draft = getTextDraft();
    const base = {
      firstName: profile?.first_name || '',
      lastName: profile?.last_name || '',
      email: user?.email || '',
      bio: profile?.bio || '',
      location: profile?.location || '',
      phone: profile?.phone || '',
      birthDate: profile?.birth_date || '',
      employmentStatus: (profile as any)?.employment_type || '', // Fixed: employment_type not employment_status
      workingHours: (profile as any)?.work_schedule || '', // Fixed: work_schedule not working_hours
      availability: (profile as any)?.availability || '', // Tillgänglighet
      profileImageUrl: profile?.profile_image_url || '',
      profileMediaType: 'image', // 'image' or 'video'
      coverImageUrl: '', // Cover image for videos
      cvUrl: '',
      cvFileName: '',
      interests: [] as string[],
      consentGiven: true // Samtycke lämnas redan vid kontoskapandet
    };
    if (!draft) return base;
    return {
      ...base,
      firstName: draft.firstName ?? base.firstName,
      lastName: draft.lastName ?? base.lastName,
      bio: draft.bio ?? base.bio,
      location: draft.location ?? base.location,
      phone: draft.phone ?? base.phone,
      birthDate: draft.birthDate ?? base.birthDate,
      employmentStatus: draft.employmentStatus ?? base.employmentStatus,
      workingHours: draft.workingHours ?? base.workingHours,
      availability: draft.availability ?? base.availability,
      interests: Array.isArray(draft.interests) ? draft.interests : base.interests,
    };
  });

  // Update form data when profile/user loads (for pre-filled registration data)
  useEffect(() => {
    if (profile || user) {
      setFormData(prev => ({
        ...prev,
        firstName: prev.firstName || profile?.first_name || '',
        lastName: prev.lastName || profile?.last_name || '',
        email: user?.email || prev.email,
        phone: prev.phone || profile?.phone || '',
        birthDate: prev.birthDate || profile?.birth_date || '',
        bio: prev.bio || profile?.bio || '',
        location: prev.location || profile?.location || '',
        employmentStatus: prev.employmentStatus || (profile as any)?.employment_type || '',
        workingHours: prev.workingHours || (profile as any)?.work_schedule || '',
        availability: prev.availability || (profile as any)?.availability || '',
      }));
    }
  }, [profile, user]);
  const [inputType, setInputType] = useState('text');
  const [phoneError, setPhoneError] = useState('');
  const [postalCode, setPostalCode] = useState(
    () => getTextDraft()?.postalCode ?? (profile as any)?.postal_code ?? ''
  );
  const [userLocation, setUserLocation] = useState(
    () => getTextDraft()?.userLocation ?? (profile as any)?.location ?? ''
  );
  const [hasValidLocation, setHasValidLocation] = useState(false);

  // 🔒 Hydrera utkastet först när kontot är känt (annars kan tomma fält skriva över).
  const hydratedForRef = useRef<string | null>(null);
  useEffect(() => {
    if (!userId || hydratedForRef.current === userId) return;
    hydratedForRef.current = userId;
    const draft = getTextDraft();
    if (!draft) return;
    setFormData(prev => ({
      ...prev,
      firstName: draft.firstName || prev.firstName,
      lastName: draft.lastName || prev.lastName,
      bio: draft.bio || prev.bio,
      location: draft.location || prev.location,
      phone: draft.phone || prev.phone,
      birthDate: draft.birthDate || prev.birthDate,
      employmentStatus: draft.employmentStatus || prev.employmentStatus,
      workingHours: draft.workingHours || prev.workingHours,
      availability: draft.availability || prev.availability,
      interests: Array.isArray(draft.interests) && draft.interests.length ? draft.interests : prev.interests,
    }));
    if (draft.postalCode) setPostalCode(draft.postalCode);
    if (draft.userLocation) setUserLocation(draft.userLocation);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // 🔒 Spara textfälten i sessionStorage vid varje ändring
  useEffect(() => {
    if (!userId || hydratedForRef.current !== userId) return;
    try {
      sessionStorage.setItem(
        WELCOME_TEXT_KEY,
        JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
          bio: formData.bio,
          location: formData.location,
          phone: formData.phone,
          birthDate: formData.birthDate,
          employmentStatus: formData.employmentStatus,
          workingHours: formData.workingHours,
          availability: formData.availability,
          interests: formData.interests,
          postalCode,
          userLocation,
        })
      );
    } catch {
      /* noop */
    }
  }, [
    formData.firstName,
    formData.lastName,
    formData.bio,
    formData.location,
    formData.phone,
    formData.birthDate,
    formData.employmentStatus,
    formData.workingHours,
    formData.availability,
    formData.interests,
    postalCode,
    userLocation,
    userId,
  ]);

  
  // Update postal code and location when profile loads
  useEffect(() => {
    if (profile) {
      if ((profile as any)?.postal_code) {
        setPostalCode(prev => prev || (profile as any).postal_code);
      }
      if ((profile as any)?.location) {
        setUserLocation(prev => prev || (profile as any).location);
      }
    }
  }, [profile]);
  
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

  const totalSteps = 8; // Introduktion + 6 profilsteg + slutskärm
  const progress = Math.min(100, Math.max(0, currentStep / 6 * 100)); // 6 synliga steg

  const countWords = (text: string) => {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  };

  const handleInputChange = (field: string, value: string | string[] | boolean) => {
    if (field === 'bio' && typeof value === 'string') {
      const wordCount = countWords(value);
      if (wordCount <= 250) {
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
    setIsSubmitting(true);
    try {
      // 🛠️ Preview mode (DeveloperControls) – do NOT touch the database
      if (previewMode) {
        setCurrentStep(totalSteps - 1);
        setTimeout(() => {
          toast({
            title: "Förhandsgranskning",
            description: "Sparat (preview) – ingen data skrevs till databasen."
          });
          onComplete();
        }, 1500);
        return;
      }

      // 🔒 Säkerhetsventil: om profilen redan är slutförd på annan enhet/flik,
      // skriv aldrig över den. Rensa utkast och omdirigera istället.
      if (profile?.onboarding_completed) {
        redirectIfCompleted('handleSubmit detected already completed profile');
        return;
      }

      if (!user?.id) {
        throw new Error('Not authenticated');
      }

      // 🔒 Färsk kontroll direkt mot databasen (lokalt profil-state kan vara
      // gammalt om tunneln slutfördes på en annan enhet under tiden).
      try {
        const { data: liveProfile } = await supabase
          .from('profiles')
          .select('onboarding_completed')
          .eq('user_id', user.id)
          .maybeSingle();
        if ((liveProfile as { onboarding_completed?: boolean } | null)?.onboarding_completed) {
          await refreshProfile().catch(() => {});
          redirectIfCompleted('handleSubmit: live DB check says profile already completed');
          return;
        }
      } catch (err) {
        console.warn('[WelcomeTunnel] live completion check failed:', err);
      }


      // First, save consent
      if (formData.consentGiven) {
        const { error: consentError } = await supabase
          .from('user_data_consents')
          .upsert({
            user_id: user.id,
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
        interests: formData.interests,
        cv_url: formData.cvUrl,
        cv_filename: formData.cvFileName,
        // Fix: Properly save profile media and cover image
        profile_image_url: formData.profileMediaType === 'video' ? null : formData.profileImageUrl,
        video_url: formData.profileMediaType === 'video' ? formData.profileImageUrl : null,
        cover_image_url: formData.coverImageUrl || null, // Save cover image correctly
        onboarding_completed: true // Mark onboarding as completed
      } as any);
      

      if (result?.error) {
        console.error('Profile update failed:', result.error);
        throw new Error('Profile update failed: ' + result.error);
      }
      
      setCurrentStep(totalSteps - 1); // Go to completion step
      setLocalMediaState(null); // 🔒 Clear sessionStorage after successful save
      clearTextDraft(); // 🔒 Rensa textutkastet efter lyckad sparning
      try { sessionStorage.removeItem(WELCOME_STEP_KEY); } catch { /* noop */ }



      setTimeout(() => {
        onComplete();
      }, 2000);

    } catch (error) {
      console.error('Error in handleSubmit:', error);
      const message = error instanceof Error ? error.message : String(error ?? '');
      const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
      const networkIssue =
        offline ||
        /failed to fetch|networkerror|network request failed|timeout|load failed/i.test(message);
      const authIssue = /jwt|not authenticated|session|permission|row-level/i.test(message);

      toast({
        title: networkIssue
          ? "Ingen internetanslutning"
          : authIssue
            ? "Du behöver logga in igen"
            : "Kunde inte spara profilen",
        description: networkIssue
          ? "Vi når inte servern just nu. Dina uppgifter finns kvar sparade — försök igen när du har täckning."
          : authIssue
            ? "Din inloggning har gått ut. Logga in igen så finns dina uppgifter kvar."
            : "Något gick fel när profilen sparades. Dina uppgifter finns kvar — försök igen om en stund.",
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
      case 5: return true; // Samtycke godkänt redan vid registrering
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

  // SwipeIntro borttagen – tunneln startar direkt på steg 1 (dina uppgifter)
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
            acceptedFileTypes={['application/pdf', '.pdf', '.doc', '.docx', '.rtf', '.odt', '.txt', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/rtf', 'application/vnd.oasis.opendocument.text', 'text/plain']} 
            maxFileSize={50 * 1024 * 1024} 
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
                  <p className="text-sm text-white animate-fade-in leading-relaxed">Framtiden börjar här</p>
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
                <h3 className="text-white text-center font-semibold">Hitta jobb på ett helt nytt sätt</h3>
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
              <p className="text-sm text-white max-w-sm mx-auto">
                Välkommen till Parium — vi börjar med dina uppgifter. Det tar ungefär en minut.
              </p>
            </div>

            
            <div className="space-y-4 max-w-md mx-auto">
               <div className="space-y-2">
                 <Label htmlFor="firstName" className="text-white font-medium text-sm">Förnamn<RequiredMark filled={!!formData.firstName.trim()} /></Label>
                 <Input 
                   id="firstName" 
                   value={formData.firstName} 
                   onChange={(e) => handleInputChange('firstName', e.target.value)} 
                   placeholder="Ditt förnamn" 
                   className="bg-white/10 border-white/20 text-white placeholder:text-white h-11 !min-h-0 text-sm focus:border-white/40"
                 />
               </div>
               <div className="space-y-2">
                 <Label htmlFor="lastName" className="text-white font-medium text-sm">Efternamn<RequiredMark filled={!!formData.lastName.trim()} /></Label>
                 <Input 
                   id="lastName" 
                   value={formData.lastName} 
                   onChange={(e) => handleInputChange('lastName', e.target.value)} 
                   placeholder="Ditt efternamn" 
                   className="bg-white/10 border-white/20 text-white placeholder:text-white h-11 !min-h-0 text-sm focus:border-white/40"
                 />
               </div>
               <div className="space-y-2">
                 <Label htmlFor="email" className="text-white font-medium text-sm">E-post<RequiredMark filled={!!formData.email.trim()} /></Label>
                 <Input 
                   id="email" 
                   type="email"
                   value={formData.email} 
                   onChange={(e) => handleInputChange('email', e.target.value)} 
                   placeholder="Din e-postadress" 
                   className="bg-white/10 border-white/20 text-white placeholder:text-white h-11 !min-h-0 text-sm focus:border-white/40"
                 />
               </div>
                  <div className="space-y-2">
                   <TunnelBirthDateField
                     id="birthDate"
                     label="Födelsedatum"
                     value={formData.birthDate}
                     onChange={(date) => handleInputChange('birthDate', date)}
                   />
                   {formData.birthDate && calculateAge(formData.birthDate) !== null && (
                     <p className="text-sm text-white mt-1">
                       {calculateAge(formData.birthDate)} år gammal
                     </p>
                   )}
                 </div>

               <div className="space-y-2">
                 <Label htmlFor="phone" className="text-white font-medium text-sm">
                   <Phone className="h-4 w-4 inline mr-2" />
                   Telefonnummer<RequiredMark filled={!!formData.phone.trim() && validatePhoneNumber(formData.phone).isValid} />
                 </Label>
                  <Input 
                    id="phone" 
                    type="tel" 
                    required
                    value={formData.phone} 
                    onChange={(e) => handlePhoneChange(e.target.value)} 
                    className="bg-white/10 border-white/20 text-white placeholder:text-white h-11 !min-h-0 text-sm focus:border-white/40"
                    placeholder="T.ex. 070-123 45 67" 
                  />
                  {phoneError && (
                    <p className="text-white text-sm mt-1">{phoneError}</p>
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
              <TunnelSelectField
                id="employmentStatus"
                label="Vad gör du i dagsläget?"
                placeholder="Välj din nuvarande situation"
                value={formData.employmentStatus}
                onChange={(v) => handleInputChange('employmentStatus', v)}
                options={[
                  { value: 'tillsvidareanställning', label: 'Fast anställning' },
                  { value: 'visstidsanställning', label: 'Visstidsanställning' },
                  { value: 'provanställning', label: 'Provanställning' },
                  { value: 'interim', label: 'Interim anställning' },
                  { value: 'bemanningsanställning', label: 'Bemanningsanställning' },
                  { value: 'egenforetagare', label: 'Egenföretagare / Frilans' },
                  { value: 'arbetssokande', label: 'Arbetssökande' },
                  { value: 'annat', label: 'Annat' },
                ]}
              />
              {/* Visa arbetstid-frågan endast om användaren har valt något OCH det inte är arbetssökande */}
              {formData.employmentStatus && formData.employmentStatus !== 'arbetssokande' && (
                <TunnelSelectField
                  id="workingHours"
                  label="Hur mycket jobbar du idag?"
                  placeholder="Välj arbetstid/omfattning"
                  value={formData.workingHours}
                  onChange={(v) => handleInputChange('workingHours', v)}
                  options={[
                    { value: 'heltid', label: 'Heltid' },
                    { value: 'deltid', label: 'Deltid' },
                    { value: 'varierande', label: 'Varierande / Flexibelt' },
                  ]}
                />
              )}
              {/* Visa tillgänglighet-frågan endast om användaren har valt något i employment status */}
              {formData.employmentStatus && (
                <TunnelSelectField
                  id="availability"
                  label="När kan du börja nytt jobb?"
                  placeholder="Välj din tillgänglighet"
                  value={formData.availability}
                  onChange={(v) => handleInputChange('availability', v)}
                  options={[
                    { value: 'omgaende', label: 'Omgående' },
                    { value: 'inom-1-manad', label: 'Inom 1 månad' },
                    { value: 'inom-3-manader', label: 'Inom 3 månader' },
                    { value: 'inom-6-manader', label: 'Inom 6 månader' },
                    { value: 'ej-aktuellt', label: 'Inte aktuellt just nu' },
                    { value: 'osaker', label: 'Osäker' },
                  ]}
                />
              )}
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h2 className="text-xl md:text-2xl font-semibold mb-2 text-white tracking-tight">Profilbild/Profilvideo</h2>
              <p className="text-sm text-white">Ladda upp en kort profilvideo/profilbild – eller båda – och gör ditt första intryck minnesvärt</p>
            </div>

            {/* Profile Image/Video Card - matching structure from Profile.tsx */}
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg">
              <div className="p-6 md:p-4 space-y-2">

                
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
                      countdownVariant="circle"
                      showProgressBar={false}
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
                          {...fetchPriority('high')}
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
                      className="absolute -top-3 -right-3 rounded-full border border-destructive/40 bg-destructive/20 p-2 text-white shadow-lg md:hover:!border-destructive/50 md:hover:!bg-destructive/30 md:hover:!text-white"
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
                    accept="image/*,video/*,.mp4,.m4v,.mov,.webm,.3gp,.3g2,.mkv"
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
                      <Badge variant="outline" className="bg-white/10 text-white border-white/20 animate-pulse rounded-full px-3 py-1.5">
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
                      <Badge variant="outline" className="bg-white/20 text-white border-white/20 px-3 py-1 rounded-full">
                        {formData.profileMediaType === 'video' ? 'Video' : 'Bild'} uppladdad!
                      </Badge>

                      {/* Anpassa knapp - endast för bilder */}
                      {formData.profileMediaType === 'image' && (
                        <button
                          type="button"
                          onClick={handleEditExistingProfile}
                          className="bg-white/5 backdrop-blur-sm border border-white/10 text-white hover:bg-white/10 hover:border-white/50 px-4 py-1.5 text-sm font-medium rounded-full transition-colors focus:outline-none focus-visible:outline-none focus:ring-0"
                        >
                          Anpassa din bild
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Cover image upload - show when video exists */}
                {formData.profileMediaType === 'video' && formData.profileImageUrl && (
                  <div className="flex flex-col items-center space-y-3 mt-4 p-4 rounded-lg bg-white/5 w-full">
                    <div className="flex flex-col items-center gap-2">
                      {/* Första raden: anpassa befintlig cover */}
                      {formData.coverImageUrl && (
                        <button
                          type="button"
                          onClick={handleEditExistingCover}
                          className="bg-white/5 backdrop-blur-sm border border-white/10 text-white hover:bg-white/10 hover:border-white/50 px-4 py-1.5 text-sm font-medium rounded-full transition-colors w-[180px] focus:outline-none focus-visible:outline-none focus:ring-0"
                        >
                          Anpassa din bild
                        </button>
                      )}

                      {/* Andra raden: byt/lägg till cover + papperskorg */}
                      <div className="relative flex items-center justify-center w-[180px]">
                        <button
                          type="button"
                          onClick={() => document.getElementById('coverImage')?.click()}
                          disabled={isUploadingCover}
                          className="bg-white/5 backdrop-blur-sm border border-white/10 text-white hover:bg-white/10 hover:border-white/50 disabled:opacity-50 px-4 py-1.5 text-sm font-medium rounded-full transition-colors w-full focus:outline-none focus-visible:outline-none focus:ring-0"
                        >
                          {formData.coverImageUrl ? 'Byt cover-bild' : 'Lägg till cover-bild'}
                        </button>

                        {formData.coverImageUrl && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteCoverImage();
                            }}
                            className="absolute -right-12 rounded-full border border-destructive/40 bg-destructive/20 p-2 text-white shadow-lg transition-colors md:hover:!border-destructive/50 md:hover:!bg-destructive/30 md:hover:!text-white focus:outline-none focus-visible:outline-none focus:ring-0"
                            title="Ta bort cover-bild"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}

                        {deletedCoverImage && !formData.coverImageUrl && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              restoreCoverImage();
                            }}
                            className="absolute -right-12 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white rounded-full p-2 shadow-lg transition-colors focus:outline-none focus-visible:outline-none focus:ring-0"
                            title="Återställ cover-bild"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </button>
                        )}
                      </div>
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
                        <Badge variant="outline" className="bg-white/10 text-white border-white/20 text-sm animate-pulse rounded-full">
                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1"></div>
                          Laddar upp cover-bild...
                        </Badge>
                      </div>
                    )}
                    
                    {formData.coverImageUrl && !isUploadingCover && (
                      <div className="flex items-center justify-center">
                        <Badge variant="outline" className="w-[180px] bg-white/20 text-white border-white/20 text-sm font-normal whitespace-nowrap px-3 py-1 rounded-full flex items-center justify-center">
                          Cover-bild uppladdad!
                        </Badge>
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
              <h2 className="text-xl md:text-2xl font-semibold mb-2 text-white tracking-tight">Din presentation</h2>
              <p className="text-sm text-white">Några rader om dig gör att arbetsgivare kommer ihåg dig</p>
            </div>

            <div className="space-y-4 max-w-md mx-auto">
              <div>
                <Label htmlFor="bio" className="text-white">Om mig <span className="text-white font-normal">(frivilligt)</span></Label>
                <Textarea
                  id="bio"
                  rows={6}
                  className="welcome-tunnel-bio mt-1.5 min-h-[140px] text-base bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10 hover:border-white/50 resize-none"
                  value={formData.bio}
                  onChange={(e) => handleInputChange('bio', e.target.value)}
                  placeholder="Till exempel: Jag är 24 år, serviceinriktad och van vid högt tempo. Har jobbat två år inom butik och trivs bäst i team. Söker nu ett deltidsjobb i Stockholm."
                />
                <div className="flex items-center justify-between mt-1.5 gap-3">
                  <span className="text-xs text-white break-words">
                    Du kan alltid ändra texten senare under Min profil
                  </span>
                  <span className={`text-sm shrink-0 ${countWords(formData.bio) > 250 ? 'text-red-300' : 'text-white'}`}>
                    {countWords(formData.bio)}/250 ord
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border border-white/15 bg-white/5 backdrop-blur-sm p-4">
                <p className="text-sm font-medium text-white mb-2.5">Tips på vad du kan nämna:</p>
                <ul className="space-y-2">
                  {[
                    'Vem du är och vad du gör i dag',
                    'Din erfarenhet eller utbildning',
                    'Vad du är bra på – och vad du söker',
                  ].map((tip) => (
                    <li key={tip} className="flex items-start gap-2.5">
                      <Check className="h-4 w-4 text-green-400 mt-0.5 shrink-0" />

                      <span className="text-sm text-white leading-relaxed break-words">{tip}</span>
                    </li>
                  ))}
                </ul>
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
                  {[
                    'Namn och profilbild/profilvideo',
                    'Din ålder',
                    'Postnummer',
                    'Kommun/stad',
                    'Telefonnummer och e-post',
                    'Ditt CV',
                    'Din beskrivning om dig själv',
                    'Din nuvarande situation, arbetstid och tillgänglighet',
                    'Dina svar på arbetsgivarens frågor i ansökan',
                  ].map((item) => (
                    <div key={item} className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-green-400 flex-shrink-0 mt-0.5" />
                      <span className="break-words">{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-sm text-white">
                Informationen visas för en arbetsgivare först när du själv söker ett av deras jobb. Du kan när som helst ändra dina uppgifter eller radera ditt konto under Min profil.
              </p>

            </div>
          </div>
        );

      case 6:
        return (
          <div className="text-center space-y-8">
            <div className="bg-green-500/20 backdrop-blur-sm p-6 rounded-full w-fit mx-auto mb-6">
              <Check className="h-12 w-12 text-green-400" />
            </div>
            <div className="space-y-4">
              <h2 className="text-xl md:text-2xl font-semibold text-white tracking-tight">Profilen är klar</h2>
              <p className="text-sm text-white">Är du redo?</p>
            </div>
            <div className="flex flex-col items-center gap-4 pt-8">
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="rounded-full px-10 py-6 bg-green-600 text-white hover:bg-green-600/90 md:hover:bg-green-600/90 hover:text-white font-semibold text-lg shadow-2xl transition-colors duration-150 focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                    Laddar...
                  </>
                ) : (
                  'Börja söka jobb'
                )}
              </Button>
              <Button
                variant="outlineNeutral"
                onClick={handlePrevious}
                className="rounded-full px-8 py-3 bg-white/10 border border-white/20 text-white text-sm md:hover:text-white md:hover:bg-white/10 md:hover:border-white/20 transition-colors duration-150 focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
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
    <div
      className="h-[100dvh] bg-gradient-parium flex flex-col relative overflow-x-hidden"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
    >
      {/* Cross-device completion overlay */}
      {redirectState !== 'idle' && (
        <div className="fixed inset-0 z-50 bg-gradient-parium flex flex-col items-center justify-center px-6 text-center">
          <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-8 max-w-sm w-full shadow-2xl">
            {redirectState === 'checking' ? (
              <>
                <div className="mx-auto mb-5 w-12 h-12 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <h2 className="text-xl font-semibold text-white mb-2">Kontrollerar din profil…</h2>
                <p className="text-sm text-white/80">Vi ser om du redan har slutfört den på en annan enhet.</p>
              </>
            ) : (
              <>
                <div className="mx-auto mb-5 w-14 h-14 bg-green-500 rounded-full flex items-center justify-center shadow-lg">
                  <Check className="h-8 w-8 text-white" />
                </div>
                <h2 className="text-xl font-semibold text-white mb-2">Din profil är redo!</h2>
                <p className="text-sm text-white/80 mb-6">
                  Du har redan slutfört din profil på en annan enhet. Vi dirigerar om dig nu.
                </p>
                <Button
                  onClick={onComplete}
                  className="w-full rounded-full bg-white text-parium-navy hover:bg-white/90 font-semibold h-12"
                >
                  Fortsätt till appen
                </Button>
              </>
            )}
          </div>
        </div>
      )}

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

      <div className="relative z-10 flex-1 flex flex-col min-h-0">
        {/* Progress indicator */}
      {currentStep > 0 && currentStep < totalSteps - 1 && (
        <div className="w-full max-w-md mx-auto pt-8 px-6 flex-shrink-0">
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

      {/* Main content – egen scroll-container (body är fixed globalt) */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 py-8 relative z-10">
        <div className="w-full max-w-2xl mx-auto">
          <div className={currentStep === 3 ? 'block' : 'hidden'}>
            {renderCvStep()}
          </div>
          {currentStep !== 3 && renderStep()}
          {/* Extra scrollutrymme så dropdowns nära botten får plats */}
          <div aria-hidden className="h-40 md:h-56" />
        </div>

      </div>

      {/* Navigation buttons – samma komponent/stil som jobbguiden */}
      {currentStep < totalSteps - 1 && currentStep < 6 && (
        <div className="pb-[env(safe-area-inset-bottom)] flex-shrink-0">
          <WizardFooter
            currentStep={currentStep - 1}
            isLastStep={false}
            onBack={handlePrevious}
            onNext={handleNext}
            onSubmit={handleNext}
            disabled={!isStepValid()}
          />
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
