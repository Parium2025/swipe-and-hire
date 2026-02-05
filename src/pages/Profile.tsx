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
import { User, MapPin, Building, Camera, Mail, Phone, Calendar as CalendarIcon, Briefcase, Clock, FileText, Video, Play, Check, Trash2, ChevronDown, RotateCcw, ExternalLink, Bot, AlertTriangle, Loader2, WifiOff } from 'lucide-react';
import { useOnline } from '@/hooks/useOnlineStatus';
import { Dialog, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DialogContentNoFocus } from '@/components/ui/dialog-no-focus';
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

// Draft key for localStorage
const PROFILE_DRAFT_KEY = 'parium_draft_profile';

// Clear draft
export const clearProfileDraft = () => {
  try {
    localStorage.removeItem(PROFILE_DRAFT_KEY);
  } catch (e) {
    console.warn('Failed to clear profile draft');
  }
};

interface CvSummary {
  summary_text: string | null;
  is_valid_cv: boolean;
  document_type: string | null;
  key_points: Record<string, unknown> | null;
  analyzed_at: string;
  cv_url: string;
}

// Component to display the user's CV summary
const CvSummarySection = ({ userId, cvUrl, refreshKey }: { userId?: string; cvUrl?: string; refreshKey?: number }) => {
  const [summary, setSummary] = useState<CvSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [isStale, setIsStale] = useState(false);

  useEffect(() => {
    const fetchSummary = async () => {
      if (!userId) return;
      
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('profile_cv_summaries')
          .select('summary_text, is_valid_cv, document_type, key_points, analyzed_at, cv_url')
          .eq('user_id', userId)
          .order('analyzed_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (error) {
          console.error('Error fetching CV summary:', error);
          return;
        }
        
        if (data) {
          setSummary(data as CvSummary);
          // Check if summary is for a different CV (stale)
          if (cvUrl && data.cv_url !== cvUrl) {
            setIsStale(true);
          } else {
            setIsStale(false);
          }
        } else {
          setSummary(null);
          setIsStale(false);
        }
      } finally {
        setLoading(false);
      }
    };
    
    fetchSummary();
  }, [userId, cvUrl, refreshKey]);

  if (!cvUrl) {
    return null;
  }

  if (loading) {
    return (
      <div className="space-y-4 md:space-y-3 pt-4 md:pt-3 border-t border-white/10">
        <div className="flex items-center gap-2 mb-4">
          <Bot className="h-4 w-4 text-white" />
          <Label className="text-base font-medium text-white">AI-analys av ditt CV</Label>
        </div>
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-md p-4 flex items-center gap-2 text-white/70">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Laddar sammanfattning...</span>
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="space-y-4 md:space-y-3 pt-4 md:pt-3 border-t border-white/10">
        <div className="flex items-center gap-2 mb-4">
          <Bot className="h-4 w-4 text-white" />
          <Label className="text-base font-medium text-white">AI-analys av ditt CV</Label>
        </div>
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-md p-4 text-white/70 text-sm">
          <p>Ingen AI-analys tillgänglig ännu. Spara din profil så analyseras ditt CV automatiskt.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-3 pt-4 md:pt-3 border-t border-white/10">
      <div className="flex items-center gap-2 mb-4">
        <Bot className="h-4 w-4 text-white" />
        <Label className="text-base font-medium text-white">AI-analys av ditt CV</Label>
        {isStale && (
          <Badge variant="outline" className="bg-yellow-500/20 text-yellow-300 border-yellow-500/30 text-xs">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Gammal analys
          </Badge>
        )}
      </div>
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-md p-4 space-y-3">
        {/* Document type indicator */}
        {!summary.is_valid_cv && (
          <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md">
            <AlertTriangle className="h-4 w-4 text-yellow-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-yellow-200">
              <p className="font-medium">Dokumentet verkar inte vara ett CV</p>
              {summary.document_type && (
                <p className="text-yellow-300/80 mt-1">Upptäckt typ: {summary.document_type}</p>
              )}
            </div>
          </div>
        )}
        
        {/* Summary text */}
        {summary.summary_text ? (
          <div className="text-white/90 text-sm leading-relaxed whitespace-pre-wrap">
            {summary.summary_text}
          </div>
        ) : (
          <p className="text-white/60 text-sm italic">Ingen sammanfattning tillgänglig.</p>
        )}
        
        {/* Analysis timestamp */}
        <p className="text-white text-xs pt-2 border-t border-white/10">
          Analyserad: {format(new Date(summary.analyzed_at), 'd MMMM yyyy, HH:mm', { locale: sv })}
        </p>
      </div>
      
      {isStale && (
        <p className="text-white/50 text-xs">
          💡 Spara din profil igen för att uppdatera AI-analysen med ditt nya CV.
        </p>
      )}
    </div>
  );
};

const Profile = () => {
  const { profile, userRole, updateProfile, refreshProfile, user, preloadedAvatarUrl, preloadedCoverUrl } = useAuth();
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
  const [cvSummaryRefreshKey, setCvSummaryRefreshKey] = useState(0);
  
  // 🔒 CRITICAL: Store local media values in sessionStorage to survive component remounts
  // This prevents DB sync from overwriting local changes when screenshot tools or tab switches cause remounts
  const LOCAL_MEDIA_KEY = 'parium_local_media_state';
  
  interface LocalMediaState {
    profileImageUrl: string;
    videoUrl: string;
    coverImageUrl: string;
    isProfileVideo: boolean;
    profileFileName: string;
    coverFileName: string;
    cvUrl: string;
  }
  
  const getLocalMediaState = (): LocalMediaState | null => {
    try {
      const stored = sessionStorage.getItem(LOCAL_MEDIA_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  };
  
  const setLocalMediaState = (state: LocalMediaState | null) => {
    try {
      if (state) {
        sessionStorage.setItem(LOCAL_MEDIA_KEY, JSON.stringify(state));
      } else {
        sessionStorage.removeItem(LOCAL_MEDIA_KEY);
      }
    } catch (e) {
      console.warn('SessionStorage not available:', e);
    }
  };
  
  const getHasLocalMediaChanges = (): boolean => {
    return getLocalMediaState() !== null;
  };
  
  const saveCurrentMediaToSession = () => {
    setLocalMediaState({
      profileImageUrl,
      videoUrl,
      coverImageUrl,
      isProfileVideo,
      profileFileName,
      coverFileName,
      cvUrl
    });
  };
  
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
  const [originalProfileImageFile, setOriginalProfileImageFile] = useState<File | null>(null);
  const [originalCoverImageFile, setOriginalCoverImageFile] = useState<File | null>(null);
  
  // Undo state - store deleted media for restore
  const [deletedProfileMedia, setDeletedProfileMedia] = useState<{
    profileImageUrl: string;
    coverImageUrl: string;
    profileFileName: string;
    coverFileName: string;
    isProfileVideo: boolean;
    videoUrl: string;
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
  
  // 🎯 Generera signed URLs (hooks måste alltid anropas, inte villkorligt)
  // Om profilbilden har markerats för borttagning ska vi INTE falla tillbaka till värdet från databasen
  const effectiveProfileImagePath = profileImageUrl || (deletedProfileMedia ? null : (profile as any)?.profile_image_url);
  const fallbackProfileImageUrl = useMediaUrl(effectiveProfileImagePath, 'profile-image');
  const signedVideoUrl = useMediaUrl(videoUrl || (profile as any)?.video_url, 'profile-video');
  
  // För cover image: använd inte fallback från profile om coverImageUrl explicit är tom (har raderats)
  const effectiveCoverImagePath = coverImageUrl || ((deletedCoverImage || deletedProfileMedia) ? null : (profile as any)?.cover_image_url);
  const fallbackCoverUrl = useMediaUrl(effectiveCoverImagePath, 'cover-image');
  const signedCvUrl = useMediaUrl(cvUrl || (profile as any)?.cv_url, 'cv');
  
  // Använd förladdade URLs från useAuth om tillgängliga, men respektera lokala borttagningar
  const signedProfileImageUrl = effectiveProfileImagePath ? (preloadedAvatarUrl || fallbackProfileImageUrl) : null;
  const signedCoverUrl = effectiveCoverImagePath ? (preloadedCoverUrl || fallbackCoverUrl) : null;
  
  // Cache images to prevent blinking during re-renders
  const { cachedUrl: cachedProfileImageUrl } = useCachedImage(signedProfileImageUrl);
  const { cachedUrl: cachedCoverUrl } = useCachedImage(signedCoverUrl);
  
  // Extended profile fields - using correct database field names
  const [employmentStatus, setEmploymentStatus] = useState(''); // Maps to employment_type
  const [workingHours, setWorkingHours] = useState(''); // Maps to work_schedule
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
      const dbHasVideo = !!(profile as any)?.video_url;

      const values = {
        firstName: profile.first_name || '',
        lastName: profile.last_name || '',
        bio: profile.bio || '',
        userLocation: profile.location || '',
        postalCode: (profile as any)?.postal_code || '',
        phone: profile.phone || '',
        birthDate: profile.birth_date || '',
        // If profile has a video, treat it as the active profile media (ignore any stale image path in DB)
        profileImageUrl: dbHasVideo ? '' : ((profile as any)?.profile_image_url || ''),
        videoUrl: dbHasVideo ? (profile as any).video_url : '',
        cvUrl: (profile as any)?.cv_url || '',
        companyName: profile.company_name || '',
        orgNumber: profile.org_number || '',
        employmentStatus: (profile as any)?.employment_type || '',
        workingHours: (profile as any)?.work_schedule || '',
        availability: (profile as any)?.availability || '',
        coverImageUrl: (profile as any)?.cover_image_url || '',
        isProfileVideo: dbHasVideo,
        profileFileName: '',
        coverFileName: '',
      };

      // Try to restore localStorage draft for text fields
      let draftData: any = null;
      try {
        const saved = localStorage.getItem(PROFILE_DRAFT_KEY);
        if (saved) {
          draftData = JSON.parse(saved);
          console.log('💾 Profile draft found');
        }
      } catch (e) {
        console.warn('Failed to restore profile draft');
      }

      // Use draft values if they differ from DB (means user had unsaved changes)
      setFirstName(draftData?.firstName && draftData.firstName !== values.firstName ? draftData.firstName : values.firstName);
      setLastName(draftData?.lastName && draftData.lastName !== values.lastName ? draftData.lastName : values.lastName);
      setBio(draftData?.bio && draftData.bio !== values.bio ? draftData.bio : values.bio);
      setUserLocation(draftData?.userLocation && draftData.userLocation !== values.userLocation ? draftData.userLocation : values.userLocation);
      setPostalCode(draftData?.postalCode && draftData.postalCode !== values.postalCode ? draftData.postalCode : values.postalCode);
      setPhone(draftData?.phone && draftData.phone !== values.phone ? draftData.phone : values.phone);
      setBirthDate(draftData?.birthDate && draftData.birthDate !== values.birthDate ? draftData.birthDate : values.birthDate);
      
      // 🔒 CRITICAL: Restore local media state from sessionStorage if it exists
      // This survives component remounts from tab switches or screenshot tools
      const localMediaRaw = getLocalMediaState();
      const localMediaMatchesDb =
        !!localMediaRaw &&
        localMediaRaw.profileImageUrl === values.profileImageUrl &&
        localMediaRaw.videoUrl === values.videoUrl &&
        localMediaRaw.coverImageUrl === values.coverImageUrl &&
        localMediaRaw.isProfileVideo === values.isProfileVideo &&
        localMediaRaw.cvUrl === values.cvUrl;

      if (localMediaRaw && localMediaMatchesDb) {
        // Clear stale session state that would otherwise falsely trigger "Osparade ändringar"
        setLocalMediaState(null);
      }

      const localMedia = localMediaMatchesDb ? null : localMediaRaw;

      if (localMedia) {
        // Restore local unsaved media values instead of DB values
        setProfileImageUrl(localMedia.profileImageUrl);
        setVideoUrl(localMedia.videoUrl);
        setCoverImageUrl(localMedia.coverImageUrl);
        setIsProfileVideo(localMedia.isProfileVideo);
        setProfileFileName(localMedia.profileFileName);
        setCoverFileName(localMedia.coverFileName);
        setCvUrl(localMedia.cvUrl);
      } else {
        // No local changes - sync from database
        setVideoUrl(values.videoUrl);
        setProfileImageUrl(values.profileImageUrl);
        setIsProfileVideo(values.isProfileVideo);
        setCoverImageUrl(values.coverImageUrl);
        setCvUrl(values.cvUrl);
      }
      // Only extract from URL if no filename in DB (for old records)
      if ((profile as any)?.cv_filename) {
        setCvFileName((profile as any).cv_filename);
      } else {
        setCvFileName('');
      }
      
      // Restore employer fields from draft if different
      setCompanyName(draftData?.companyName && draftData.companyName !== values.companyName ? draftData.companyName : values.companyName);
      setOrgNumber(draftData?.orgNumber && draftData.orgNumber !== values.orgNumber ? draftData.orgNumber : values.orgNumber);
      setEmploymentStatus(draftData?.employmentStatus && draftData.employmentStatus !== values.employmentStatus ? draftData.employmentStatus : values.employmentStatus);
      setWorkingHours(draftData?.workingHours && draftData.workingHours !== values.workingHours ? draftData.workingHours : values.workingHours);
      setAvailability(draftData?.availability && draftData.availability !== values.availability ? draftData.availability : values.availability);

      // Store original values for comparison
      setOriginalValues(values);
      
      // Only reset unsaved changes flag if we don't have local media changes AND no draft was restored
      const hasDraftChanges = draftData && (
        (draftData.firstName && draftData.firstName !== values.firstName) ||
        (draftData.lastName && draftData.lastName !== values.lastName) ||
        (draftData.bio && draftData.bio !== values.bio) ||
        (draftData.userLocation && draftData.userLocation !== values.userLocation) ||
        (draftData.postalCode && draftData.postalCode !== values.postalCode) ||
        (draftData.phone && draftData.phone !== values.phone) ||
        (draftData.birthDate && draftData.birthDate !== values.birthDate)
      );
      
      if (!getHasLocalMediaChanges() && !hasDraftChanges) {
        setHasUnsavedChanges(false);
      }
    }
  }, [profile]);

  // 🎯 Synkronisera med förladdade URLs från useAuth (precis som sidebaren)
  // Detta säkerställer att Profile.tsx alltid visar de redan cachade bilderna
  useEffect(() => {
    // Sync preloaded avatar URL
  }, [preloadedAvatarUrl, profile?.profile_image_url]);

  useEffect(() => {
    // Sync preloaded cover URL
  }, [preloadedCoverUrl, profile?.cover_image_url]);

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
      videoUrl,
      cvUrl,
      companyName,
      orgNumber,
      employmentStatus,
      workingHours,
      availability,
      coverImageUrl,
      isProfileVideo,
    };

    const hasChanges = Object.keys(currentValues).some(
      key => currentValues[key as keyof typeof currentValues] !== originalValues[key as keyof typeof originalValues]
    );

    setHasUnsavedChanges(hasChanges);
    return hasChanges;
  }, [originalValues, firstName, lastName, bio, userLocation, postalCode, phone, birthDate, 
      profileImageUrl, videoUrl, cvUrl, companyName, orgNumber, employmentStatus, workingHours, availability, coverImageUrl, isProfileVideo]);

  // Check for changes whenever form values change
  useEffect(() => {
    checkForChanges();
  }, [checkForChanges]);

  // Auto-save draft to localStorage for text fields
  useEffect(() => {
    // Only save if there are actual changes
    if (!hasUnsavedChanges) return;
    
    const hasContent = firstName || lastName || bio || userLocation || postalCode || phone || birthDate;
    
    if (hasContent) {
      try {
        localStorage.setItem(PROFILE_DRAFT_KEY, JSON.stringify({
          firstName,
          lastName,
          bio,
          userLocation,
          postalCode,
          phone,
          birthDate,
          employmentStatus,
          workingHours,
          availability,
          companyName,
          orgNumber,
          savedAt: Date.now()
        }));
        console.log('💾 Profile draft saved');
      } catch (e) {
        console.warn('Failed to save profile draft');
      }
    }
  }, [firstName, lastName, bio, userLocation, postalCode, phone, birthDate, 
      employmentStatus, workingHours, availability, companyName, orgNumber, hasUnsavedChanges]);

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
      setVideoUrl(originalValues.videoUrl || '');
      setDeletedProfileMedia(null);
      setDeletedCoverImage(null);
      // Discard any locally cached (unsaved) media state when user chooses "Lämna utan att spara"
      try {
        sessionStorage.removeItem(LOCAL_MEDIA_KEY);
      } catch {}
      // IMPORTANT: user chose to discard changes -> clear local draft as well
      clearProfileDraft();
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
      // 🔒 Save to sessionStorage to survive remounts
      setLocalMediaState({
        profileImageUrl: isVideo ? '' : storagePath,
        videoUrl: isVideo ? storagePath : '',
        coverImageUrl: isVideo && !coverImageUrl && (profileImageUrl || originalValues?.profileImageUrl) 
          ? (profileImageUrl || originalValues?.profileImageUrl || '') 
          : coverImageUrl,
        isProfileVideo: isVideo,
        profileFileName: storagePath,
        coverFileName,
        cvUrl
      });
      
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
      // 🔒 Save to sessionStorage to survive remounts
      setLocalMediaState({
        profileImageUrl,
        videoUrl,
        coverImageUrl: storagePath,
        isProfileVideo,
        profileFileName,
        coverFileName: storagePath,
        cvUrl
      });
      
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
      // Spara originalfilen för framtida redigeringar
      setOriginalProfileImageFile(file);
      const imageUrl = URL.createObjectURL(file);
      setPendingImageSrc(imageUrl);
      setImageEditorOpen(true);
    }
  };

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith('image/')) {
      // Spara originalfilen för framtida redigeringar
      setOriginalCoverImageFile(file);
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
      // Cleanup blob URL
      if (pendingImageSrc) {
        URL.revokeObjectURL(pendingImageSrc);
      }
      setPendingImageSrc('');
      
      // Mark as having unsaved changes
      setHasUnsavedChanges(true);
      // 🔒 Save to sessionStorage to survive remounts
      setLocalMediaState({
        profileImageUrl: storagePath,
        videoUrl: '',
        coverImageUrl,
        isProfileVideo: false,
        profileFileName: storagePath,
        coverFileName,
        cvUrl
      });
      
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
      // Cleanup blob URL
      if (pendingCoverSrc) {
        URL.revokeObjectURL(pendingCoverSrc);
      }
      setPendingCoverSrc('');
      
      // Mark as having unsaved changes
      setHasUnsavedChanges(true);
      // 🔒 Save to sessionStorage to survive remounts
      setLocalMediaState({
        profileImageUrl,
        videoUrl,
        coverImageUrl: storagePath,
        isProfileVideo,
        profileFileName,
        coverFileName: storagePath,
        cvUrl
      });
      
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
    if (!user?.id) return;
    
    try {
      // Save current media for undo
      setDeletedProfileMedia({
        profileImageUrl: originalValues.profileImageUrl || profileImageUrl,
        coverImageUrl: originalValues.coverImageUrl || coverImageUrl,
        profileFileName: originalValues.profileFileName || profileFileName,
        coverFileName: originalValues.coverFileName || coverFileName,
        isProfileVideo: originalValues.isProfileVideo || isProfileVideo,
        videoUrl: originalValues.videoUrl || videoUrl,
      });
      
      // När vi raderar video med en cover-bild, gör cover-bilden till profilbilden
      let newProfileImageUrl = '';
      let newVideoUrl = '';
      let newCoverImageUrl = '';
      let newIsProfileVideo = false;
      let newProfileFileName = '';
      let newCoverFileName = '';
      
      if (isProfileVideo && coverImageUrl) {
        newProfileImageUrl = coverImageUrl;
        newProfileFileName = coverFileName;
        newCoverImageUrl = coverImageUrl; // Keep cover intact
        newCoverFileName = coverFileName;
        setProfileImageUrl(coverImageUrl);
        setProfileFileName(coverFileName);
        setVideoUrl('');
        setIsProfileVideo(false);
      } else {
        // Ingen cover-bild - rensa allt
        setProfileImageUrl('');
        setVideoUrl('');
        setCoverImageUrl('');
        setIsProfileVideo(false);
        setProfileFileName('');
        setCoverFileName('');
      }
      
      // 🔒 Save deleted state to sessionStorage to survive remounts
      setLocalMediaState({
        profileImageUrl: newProfileImageUrl,
        videoUrl: newVideoUrl,
        coverImageUrl: newCoverImageUrl,
        isProfileVideo: newIsProfileVideo,
        profileFileName: newProfileFileName,
        coverFileName: newCoverFileName,
        cvUrl
      });
      
      // Reset file input
      const fileInput = document.getElementById('profile-image') as HTMLInputElement;
      if (fileInput) {
        fileInput.value = '';
      }
      
      // Mark as unsaved changes - user must click "Spara ändringar"
      setHasUnsavedChanges(true);
      
      toast({
        title: "Media markerad för borttagning",
        description: "Tryck på 'Spara ändringar' för att slutföra"
      });
    } catch (error) {
      console.error('Error in deleteProfileMedia:', error);
      toast({
        title: "Fel",
        description: "Kunde inte förbereda borttagning",
        variant: "destructive"
      });
    }
  };
  const restoreProfileMedia = () => {
    if (!deletedProfileMedia) return;
    
    // Återställ alla värden (inklusive video)
    setProfileImageUrl(deletedProfileMedia.profileImageUrl);
    setCoverImageUrl(deletedProfileMedia.coverImageUrl);
    setProfileFileName(deletedProfileMedia.profileFileName);
    setCoverFileName(deletedProfileMedia.coverFileName);
    setIsProfileVideo(deletedProfileMedia.isProfileVideo);
    setVideoUrl(deletedProfileMedia.videoUrl);
    
    // 🔒 Update sessionStorage with restored values
    setLocalMediaState({
      profileImageUrl: deletedProfileMedia.profileImageUrl,
      videoUrl: deletedProfileMedia.videoUrl,
      coverImageUrl: deletedProfileMedia.coverImageUrl,
      isProfileVideo: deletedProfileMedia.isProfileVideo,
      profileFileName: deletedProfileMedia.profileFileName,
      coverFileName: deletedProfileMedia.coverFileName,
      cvUrl
    });
    
    // Rensa ångra-data
    setDeletedProfileMedia(null);
    
    // checkForChanges körs automatiskt och räknar ut korrekt status
    
    toast({
      title: "Återställd!",
      description: "Din profilvideo har återställts"
    });
  };

  const deleteCoverImage = async () => {
    if (!user?.id) return;
    
    try {
      // Save current cover image for undo
      setDeletedCoverImage({
        coverImageUrl,
        coverFileName
      });
      
      // Clear local state (don't save to DB yet - wait for "Spara ändringar")
      setCoverImageUrl('');
      setCoverFileName('');
      
      // 🔒 Save deleted state to sessionStorage to survive remounts
      setLocalMediaState({
        profileImageUrl,
        videoUrl,
        coverImageUrl: '',
        isProfileVideo,
        profileFileName,
        coverFileName: '',
        cvUrl
      });
      
      // Mark as unsaved changes - user must click "Spara ändringar"
      setHasUnsavedChanges(true);
      
      toast({
        title: "Cover-bild markerad för borttagning",
        description: "Tryck på 'Spara ändringar' för att slutföra"
      });
    } catch (error) {
      console.error('Error in deleteCoverImage:', error);
      toast({
        title: "Fel",
        description: "Kunde inte förbereda borttagning",
        variant: "destructive"
      });
    }
  };
  
  const restoreCoverImage = () => {
    if (!deletedCoverImage) return;
    
    // Restore cover image values
    setCoverImageUrl(deletedCoverImage.coverImageUrl);
    setCoverFileName(deletedCoverImage.coverFileName);
    
    // 🔒 Update sessionStorage with restored values
    setLocalMediaState({
      profileImageUrl,
      videoUrl,
      coverImageUrl: deletedCoverImage.coverImageUrl,
      isProfileVideo,
      profileFileName,
      coverFileName: deletedCoverImage.coverFileName,
      cvUrl
    });
    
    // Clear undo data
    setDeletedCoverImage(null);
    
    // checkForChanges körs automatiskt och räknar ut korrekt status
    
    toast({
      title: "Återställd!",
      description: "Din cover-bild har återställts"
    });
  };

  const handleEditExistingProfile = async () => {
    // Kan endast redigera bilder, inte videor
    if (!profileImageUrl || isProfileVideo) return;
    
    // Visa alltid originalbilden i editorn (om den finns)
    if (originalProfileImageFile) {
      const imageUrl = URL.createObjectURL(originalProfileImageFile);
      setPendingImageSrc(imageUrl);
      setImageEditorOpen(true);
    } else {
      // Fallback: Hämta den signerade URL:en för den befintliga profilbilden
      try {
        const signedUrl = await getMediaUrl(profileImageUrl, 'profile-image', 86400);
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

  const handleEditExistingCover = async () => {
    if (!coverImageUrl) return;
    
    // 1) Om vi har en explicit uppladdad cover-bild, använd den ursprungliga filen
    if (originalCoverImageFile) {
      const imageUrl = URL.createObjectURL(originalCoverImageFile);
      setPendingCoverSrc(imageUrl);
      setCoverEditorOpen(true);
      return;
    }

    // 2) Om cover-bilden kommer från en tidigare profilbild (video + auto-cover),
    //    använd den ursprungliga profilbildsfilen som "original" för covern
    if (isProfileVideo && originalProfileImageFile) {
      const imageUrl = URL.createObjectURL(originalProfileImageFile);
      setPendingCoverSrc(imageUrl);
      setCoverEditorOpen(true);
      return;
    }

    // 3) Fallback: hämta signerad URL för befintlig cover-bild från lagring
    try {
      const signedUrl = await getMediaUrl(coverImageUrl, 'cover-image', 86400);
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

  const handleDeleteCv = async () => {
    if (!user?.id) return;

    try {
      // Update database to remove CV
      const { error } = await supabase
        .from('profiles')
        .update({ 
          cv_url: null,
          profile_file_name: null 
        })
        .eq('user_id', user.id);

      if (error) throw error;

      // Update local state
      setCvUrl('');
      setCvFileName('');

      // Keep originalValues in sync so this counts as already saved
      setOriginalValues(prev => ({
        ...prev,
        cvUrl: '',
        cvFileName: ''
      }));

      // No unsaved changes since CV is already removed in DB
      setHasUnsavedChanges(false);

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
  const { isOnline, showOfflineToast } = useOnline();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isOnline) {
      showOfflineToast();
      return;
    }

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
      // 🔥 Hantera media-borttagning från storage innan vi uppdaterar DB
      // Om media har raderats (state är tom men originalValues hade värde), radera från storage
      if (originalValues.profileFileName && !profileImageUrl && !videoUrl) {
        try {
          await supabase.storage
            .from('job-applications')
            .remove([originalValues.profileFileName]);
        } catch (error) {
          console.error('Failed to delete profile file from storage:', error);
        }
      }
      
      if (originalValues.videoUrl && !videoUrl) {
        try {
          await supabase.storage
            .from('job-applications')
            .remove([originalValues.videoUrl]);
        } catch (error) {
          console.error('Failed to delete video from storage:', error);
        }
      }
      
      if (originalValues.coverFileName && !coverImageUrl) {
        try {
          await supabase.storage
            .from('job-applications')
            .remove([originalValues.coverFileName]);
        } catch (error) {
          console.error('Failed to delete cover image from storage:', error);
        }
      }

      const updates: any = {
        first_name: firstName.trim() || null,
        last_name: lastName.trim() || null,
        bio: bio.trim() || null,
        location: userLocation.trim() || null,
        city: userLocation.trim() || null, // Save city separately for consistency
        postal_code: postalCode.trim() || null,
        phone: phone.trim() || null,
        birth_date: birthDate || null,
        // Preserve existing CV unless explicitly changed/removed
        cv_url: cvUrl ? cvUrl : (originalValues?.cvUrl || null),
        profile_file_name: cvFileName ? cvFileName : ((profile as any)?.profile_file_name || null),
        employment_type: employmentStatus || null, // Fixed: employment_type not employment_status
        work_schedule: workingHours || null, // Fixed: work_schedule not working_hours
        availability: availability || null,
      };

      // Handle profile image/video updates
      // 🔒 KRITISK FIX: profile_image_url ska ALDRIG vara null om vi har cover_image_url
      // Detta säkerställer att sidebaren alltid har något att visa
      if (isProfileVideo && videoUrl) {
        // It's a video - save storage path only
        updates.video_url = videoUrl;
        
        // If user had a profile image but no cover, make the profile image the cover
        if (profileImageUrl && !coverImageUrl) {
          updates.cover_image_url = profileImageUrl; // Preserve old profile image as cover
          setCoverImageUrl(profileImageUrl); // Update local state
          setCoverFileName(profileFileName); // Track for deletion
          // 🔒 BEHÅLL profile_image_url som cover för fallback (istället för null)
          updates.profile_image_url = profileImageUrl;
        } else if (coverImageUrl) {
          // Keep existing cover image when video exists
          updates.cover_image_url = coverImageUrl;
          // 🔒 KRITISK: Sätt profile_image_url till cover som fallback
          updates.profile_image_url = coverImageUrl;
        } else {
          // Ingen cover och ingen profilbild - sätt till null (oundvikligt)
          updates.cover_image_url = null;
          updates.profile_image_url = null;
        }
        
        updates.is_profile_video = true;
      } else if (!profileImageUrl && coverImageUrl) {
        // No video/image but has cover - make cover the profile image (but keep cover as cover)
        updates.profile_image_url = coverImageUrl;
        updates.video_url = null;
        updates.cover_image_url = coverImageUrl; // Preserve cover image so it remains available when adding video again
        updates.is_profile_video = false;
        
        // Update local state to reflect this change
        setProfileImageUrl(coverImageUrl);
        setIsProfileVideo(false);
        setProfileFileName(coverFileName);
        // Do NOT clear cover state here
        setDeletedCoverImage(null);
        setDeletedProfileMedia(null); // Clear undo states
      } else {
        // It's an image or no media - ALDRIG null om cover finns
        updates.profile_image_url = profileImageUrl || coverImageUrl || null;
        updates.video_url = null;
        updates.cover_image_url = coverImageUrl || null;
        updates.is_profile_video = false;
      }

      if (isEmployer) {
        updates.company_name = companyName.trim() || null;
        updates.org_number = orgNumber.trim() || null;
      }

      const result = await updateProfile(updates);
      
      if (!result.error) {
        // 🚀 Trigger proactive CV analysis if CV was updated
        const cvWasUpdated = cvUrl && cvUrl !== originalValues.cvUrl;
        if (cvWasUpdated && user?.id) {
          console.log('CV updated, triggering proactive analysis...');
          try {
            const res = await supabase.functions.invoke('generate-cv-summary', {
              body: {
                applicant_id: user.id,
                cv_url_override: cvUrl,
                proactive: true
              }
            });
            
            if (res.error) {
              console.error('Proactive CV analysis error:', res.error);
            } else {
              console.log('Proactive CV analysis completed successfully');
              // 🔄 Trigger re-fetch of CV summary in UI
              setCvSummaryRefreshKey(prev => prev + 1);
            }
          } catch (err) {
            console.error('Proactive CV analysis failed:', err);
          }
        }
        
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
          videoUrl: videoUrl,
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
        setLocalMediaState(null); // 🔒 Clear sessionStorage after successful save
        clearProfileDraft(); // 🔒 Clear localStorage draft after successful save
        console.log('💾 Profile draft cleared after save');
        
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
     <div className="max-w-4xl mx-auto space-y-6 px-3 md:px-8 animate-fade-in">
      <div className="text-center mb-6">
        <h1 className="text-xl md:text-2xl font-semibold text-white tracking-tight">Min Profil</h1>
        <p className="text-sm text-white mt-1">
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
                  className="w-32 h-32 border-4 border-white/10 rounded-full overflow-hidden"
                  countdownVariant="compact"
                />
              ) : (
                <div 
                  className="cursor-pointer" 
                  onClick={() => document.getElementById('profile-image')?.click()}
                >
                  <Avatar className="h-32 w-32 border-4 border-white/10">
                    {(cachedProfileImageUrl || signedProfileImageUrl) ? (
                      <AvatarImage 
                        src={cachedProfileImageUrl || signedProfileImageUrl || undefined} 
                        alt="Profilbild"
                        className="object-cover"
                        decoding="sync"
                        loading="eager"
                        fetchPriority="high"
                        draggable={false}
                      />
                    ) : null}
                    {!(cachedProfileImageUrl || signedProfileImageUrl) && (
                      <AvatarFallback delayMs={300} className="text-4xl font-semibold bg-white/20 text-white">
                        {((firstName?.trim()?.[0]?.toUpperCase() || '') + (lastName?.trim()?.[0]?.toUpperCase() || '')) || '?'}
                      </AvatarFallback>
                    )}
                  </Avatar>
                </div>
              )}

              {/* Delete/Restore icon for profile media */}
              {/* Om video just raderats (deletedProfileMedia finns), visa restore istället för soptunna */}
              {deletedProfileMedia && !videoUrl ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    restoreProfileMedia();
                  }}
                  className="absolute -top-3 -right-3 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white rounded-full p-2 shadow-lg transition-colors"
                  title="Återställ video"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
              ) : !!(videoUrl || profileImageUrl) ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteProfileMedia();
                  }}
                  className="absolute -top-3 -right-3 bg-white/20 hover:bg-destructive/30 backdrop-blur-sm text-white rounded-full p-2 shadow-lg transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              ) : null}

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
                className="text-white cursor-pointer hover:text-white transition-colors text-center text-sm"
              >
                Klicka här för att välja en bild eller video (max 60 sekunder)
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
              
              {/* Anpassa din bild button - only show for images, not videos */}
              {(!isProfileVideo && !!profileImageUrl) && !isUploadingMedia && (
                <div className="flex flex-col items-center space-y-2">
                  <Badge variant="outline" className="bg-white/20 text-white border-white/20 px-3 py-1 rounded-md">
                    Bild uppladdad!
                  </Badge>
                  <button 
                    type="button"
                    onClick={handleEditExistingProfile}
                    className="bg-white/5 backdrop-blur-sm border border-white/10 text-white hover:bg-white/10 hover:border-white/50 px-3 py-1 text-sm font-medium rounded-md transition-colors"
                  >
                    Anpassa din bild
                  </button>
                </div>
              )}
            </div>

            {/* Cover image upload - show when video exists OR when cover image exists without video */}
            {(isProfileVideo && !!videoUrl) && (
              <div className="flex flex-col items-center space-y-3 mt-4 p-4 rounded-lg bg-white/5 w-full">
                <div className="flex flex-col items-center gap-2">
                  {/* First row: Edit existing cover button - same width as second button */}
                  {coverImageUrl && (
                    <div className="w-[180px]">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={handleEditExistingCover}
                        className="w-full h-8 font-normal bg-white/5 backdrop-blur-sm border-white/10 !text-white hover:bg-white/10 hover:!text-white hover:border-white/50 md:hover:bg-white/10 md:hover:!text-white md:hover:border-white/50"
                      >
                        Anpassa din bild
                      </Button>
                    </div>
                  )}
                  
                  {/* Second row: Change cover button and trash */}
                  <div className="relative flex items-center justify-center w-[180px]">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => document.getElementById('cover-image')?.click()}
                      disabled={isUploadingCover}
                      className="w-full h-8 font-normal bg-white/5 backdrop-blur-sm border-white/10 !text-white disabled:opacity-50 hover:bg-white/10 hover:!text-white hover:border-white/50 md:hover:bg-white/10 md:hover:!text-white md:hover:border-white/50"
                    >
                      {coverImageUrl ? 'Ändra cover-bild' : 'Lägg till cover-bild'}
                    </Button>
                    {coverImageUrl && (
                      <button
                        onClick={deleteCoverImage}
                        disabled={isUploadingCover}
                        className="absolute -right-10 bg-white/20 hover:bg-destructive/30 backdrop-blur-sm text-white rounded-full p-2 shadow-lg transition-colors disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                    {!coverImageUrl && deletedCoverImage && (
                      <button
                        onClick={restoreCoverImage}
                        disabled={isUploadingCover}
                        className="absolute -right-10 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white rounded-full p-2 shadow-lg transition-colors disabled:opacity-50"
                        title="Ångra borttagning"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </button>
                    )}
                  </div>
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
                  <div className="flex items-center justify-center">
                    <Badge variant="outline" className="w-[180px] bg-white/20 text-white border-white/20 text-sm font-normal whitespace-nowrap px-3 py-1 rounded-md flex items-center justify-center">
                      Cover-bild uppladdad!
                    </Badge>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Profile Information */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg">
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
                      className={`h-9 bg-white/5 backdrop-blur-sm border-white/10 text-white hover:bg-white/10 hover:border-white/50 md:hover:border-white/50 placeholder:text-white text-sm ${errors.firstName ? 'border-red-400' : ''}`}
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
                      className={`h-9 bg-white/5 backdrop-blur-sm border-white/10 text-white hover:bg-white/10 hover:border-white/50 md:hover:border-white/50 placeholder:text-white text-sm ${errors.lastName ? 'border-red-400' : ''}`}
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
                        className={`h-9 pl-10 bg-white/5 backdrop-blur-sm border-white/10 text-white hover:bg-white/10 hover:border-white/50 md:hover:border-white/50 placeholder:text-white text-sm ${errors.phone ? 'border-red-400' : ''}`}
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
                  <div className="flex min-h-touch md:h-10 w-full rounded-md border bg-white/5 backdrop-blur-sm border-white/10 text-white pl-10 pr-3 py-2 text-sm items-center min-w-0 hover:bg-white/10 hover:border-white/50 md:hover:border-white/50 transition-all duration-150">
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
                  className="bg-white/5 backdrop-blur-sm border-white/10 text-white hover:bg-white/10 hover:border-white/50 md:hover:border-white/50 placeholder:text-white"
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
                            variant="outlineNeutral"
                            className="w-full h-9 bg-white/5 backdrop-blur-sm border-white/10 text-white text-sm transition-all duration-300 md:hover:bg-white/10 md:hover:text-white md:hover:border-white/50 [&_svg]:text-white md:hover:[&_svg]:text-white justify-between"
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
                            className="w-72 bg-slate-900/85 backdrop-blur-xl border border-white/20 shadow-lg z-50 rounded-md text-white overflow-visible"
                            side="bottom"
                            align="center"
                            alignOffset={0}
                            sideOffset={6}
                            avoidCollisions={true}
                          >
                            <DropdownMenuItem onClick={() => setEmploymentStatus('tillsvidareanställning')} className="cursor-pointer hover:bg-white/10 focus:bg-white/10 py-3 text-white">
                              Fast anställning
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setEmploymentStatus('visstidsanställning')} className="cursor-pointer hover:bg-white/10 focus:bg-white/10 py-3 text-white">
                              Visstidsanställning
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setEmploymentStatus('provanställning')} className="cursor-pointer hover:bg-white/10 focus:bg-white/10 py-3 text-white">
                              Provanställning
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setEmploymentStatus('interim')} className="cursor-pointer hover:bg-white/10 focus:bg-white/10 py-3 text-white">
                              Interim anställning
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setEmploymentStatus('bemanningsanställning')} className="cursor-pointer hover:bg-white/10 focus:bg-white/10 py-3 text-white">
                              Bemanningsanställning
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setEmploymentStatus('egenforetagare')} className="cursor-pointer hover:bg-white/10 focus:bg-white/10 py-3 text-white">
                              Egenföretagare / Frilans
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setEmploymentStatus('arbetssokande')} className="cursor-pointer hover:bg-white/10 focus:bg-white/10 py-3 text-white">
                              Arbetssökande
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setEmploymentStatus('annat')} className="cursor-pointer hover:bg-white/10 focus:bg-white/10 py-3 text-white">
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
                               className="w-72 max-h-80 overflow-y-auto bg-slate-900/85 backdrop-blur-xl border border-white/20 shadow-lg z-50 rounded-md text-white"
                              side="bottom"
                              align="center"
                              alignOffset={0}
                              sideOffset={6}
                              avoidCollisions={true}
                            >
                              <DropdownMenuItem onClick={() => setWorkingHours('heltid')} className="cursor-pointer hover:bg-white/10 focus:bg-white/10 py-3 text-white">
                                Heltid
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setWorkingHours('deltid')} className="cursor-pointer hover:bg-white/10 focus:bg-white/10 py-3 text-white">
                                Deltid
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setWorkingHours('varierande')} className="cursor-pointer hover:bg-white/10 focus:bg-white/10 py-3 text-white">
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
                            className="w-72 bg-slate-900/85 backdrop-blur-xl border border-white/20 shadow-lg z-50 rounded-md text-white overflow-visible"
                           side="bottom"
                           align="center"
                           alignOffset={0}
                           sideOffset={6}
                           avoidCollisions={true}
                          >
                            <DropdownMenuItem onClick={() => setAvailability('omgaende')} className="cursor-pointer hover:bg-white/10 focus:bg-white/10 py-3 text-white">
                              Omgående
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setAvailability('inom-1-manad')} className="cursor-pointer hover:bg-white/10 focus:bg-white/10 py-3 text-white">
                              Inom 1 månad
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setAvailability('inom-3-manader')} className="cursor-pointer hover:bg-white/10 focus:bg-white/10 py-3 text-white">
                              Inom 3 månader
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setAvailability('inom-6-manader')} className="cursor-pointer hover:bg-white/10 focus:bg-white/10 py-3 text-white">
                              Inom 6 månader
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setAvailability('ej-aktuellt')} className="cursor-pointer hover:bg-white/10 focus:bg-white/10 py-3 text-white">
                              Inte aktuellt just nu
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setAvailability('osaker')} className="cursor-pointer hover:bg-white/10 focus:bg-white/10 py-3 text-white">
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
                      <div className="w-full min-h-9 py-[11.2px] bg-white/5 backdrop-blur-sm border border-white/10 rounded-md flex items-center px-3 gap-2">
                        <button
                          type="button"
                          onClick={() => setCvOpen(true)}
                          className="flex items-center gap-2 text-white transition-colors flex-1"
                        >
                          <FileText className="h-4 w-4 text-white flex-shrink-0" />
                          <span className="text-sm">Visa CV</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setCvOpen(true)}
                          className="text-white hover:text-white transition-colors"
                          title="Öppna CV"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={handleDeleteCv}
                          className="text-white hover:text-destructive transition-colors"
                          title="Ta bort CV"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="p-0">
                        <FileUpload
                          onFileUploaded={async (url, fileName) => {
                            console.log('CV uploaded, received:', { url, fileName });
                            setCvUrl(url);
                            setCvFileName(fileName);
                            setHasUnsavedChanges(true);
                            
                            // Queue CV for pre-analysis (rate-limit safe)
                            if (user?.id) {
                              supabase.rpc('queue_cv_analysis', {
                                p_applicant_id: user.id,
                                p_cv_url: url,
                                p_priority: 10, // High priority for direct uploads
                              }).then(({ error }) => {
                                if (error) console.warn('Failed to queue CV for analysis:', error);
                                else {
                                  // Trigger queue processor
                                  supabase.functions.invoke('process-cv-queue').catch(() => {});
                                }
                              });
                            }
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

                  {/* CV Summary Section */}
                  <CvSummarySection userId={user?.id} cvUrl={cvUrl || (profile as any)?.cv_url} refreshKey={cvSummaryRefreshKey} />
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
                        className="bg-white/5 backdrop-blur-sm border-white/10 text-white hover:bg-white/10 hover:border-white/50 md:hover:border-white/50 placeholder:text-white"
                      />
                    </div>

                    <div className="space-y-2 md:space-y-1.5">
                      <Label htmlFor="orgNumber" className="text-white">Organisationsnummer</Label>
                      <Input
                        id="orgNumber"
                        placeholder="556123-4567"
                        value={orgNumber}
                        onChange={(e) => setOrgNumber(e.target.value)}
                        className="bg-white/5 backdrop-blur-sm border-white/10 text-white hover:bg-white/10 hover:border-white/50 md:hover:border-white/50 placeholder:text-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {hasUnsavedChanges && (
                <div className="flex justify-center">
                  <Button 
                    type="submit" 
                    variant="glassGreen"
                    className="h-10 px-8 text-base font-medium disabled:opacity-50 disabled:cursor-not-allowed" 
                    disabled={loading || isUploadingMedia || isUploadingCover}
                  >
                    {loading ? 'Sparar...' : 'Spara ändringar'}
                  </Button>
                </div>
              )}
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
        <DialogContentNoFocus className="max-w-4xl max-h-[90vh] overflow-hidden bg-transparent border-none shadow-none p-8">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-white text-2xl">{cvFileName || 'CV'}</DialogTitle>
          </DialogHeader>
          {cvUrl && signedCvUrl && (
            <CvViewer 
              src={signedCvUrl} 
              fileName={cvFileName || 'cv.pdf'} 
              height="70vh"
              onClose={() => setCvOpen(false)}
            />
          )}
        </DialogContentNoFocus>
      </Dialog>
    </div>
  );
};

export default Profile;