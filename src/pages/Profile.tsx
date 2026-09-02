import { TruncatedText } from '@/components/TruncatedText';
import { useState, useEffect, useCallback, useRef } from 'react';
import { looksLikeVideoFile } from '@/lib/videoInput';
import { useAuth } from '@/hooks/useAuth';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { safeReadJsonCache, safeSetItem } from '@/lib/safeStorage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ProfileFormSkeleton } from '@/components/profile/ProfileFormSkeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { User, MapPin, Building, Mail, Phone, Calendar as CalendarIcon, Briefcase, Clock, FileText, Play, Check, X, Trash2, ChevronDown, RotateCcw, ExternalLink, Bot, AlertTriangle, Loader2, WifiOff } from 'lucide-react';
import { useOnline } from '@/hooks/useOnlineStatus';
import { useOfflineProfileQueue } from '@/hooks/useOfflineProfileQueue';
import { getIsOnline } from '@/lib/connectivityManager';
import { Dialog, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DialogContentNoFocus } from '@/components/ui/dialog-no-focus';
import { CvViewer } from '@/components/CvViewer';
import FileUpload from '@/components/FileUpload';
import ProfileVideo from '@/components/ProfileVideo';
import { useVideoPoster } from '@/hooks/useVideoPoster';
import ImageEditor from '@/components/ImageEditor';
import { UploadInlineProgress } from '@/components/ui/upload-inline-progress';
import WorkplacePostalCodeSelector from '@/components/WorkplacePostalCodeSelector';
import { BirthDatePicker } from '@/components/BirthDatePicker';
import { useNavigate, useLocation } from 'react-router-dom';
import { uploadMedia, getMediaUrl } from '@/lib/mediaManager';
import { formatBytes, formatTimeRemaining, UploadAbortedError, type UploadProgress as UploadProgressInfo } from '@/lib/uploadWithProgress';
import { useOfflineMediaQueue } from '@/hooks/useOfflineMediaQueue';
import { Progress } from '@/components/ui/progress';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { isValidSwedishPhone } from '@/lib/phoneValidation';
import { useMediaUrl } from '@/hooks/useMediaUrl';
import { useCachedImage } from '@/hooks/useCachedImage';
import { JobSeekerNotificationSettings } from '@/components/JobSeekerNotificationSettings';
import { ActiveSessionsSettings } from '@/components/ActiveSessionsSettings';
import { PrivacyDataPanel } from '@/components/PrivacyDataPanel';
import ProfileSwitcherRail, { type ProfileSwitcherRailHandle } from '@/components/candidateProfiles/ProfileSwitcherRail';
import type { CandidateProfile } from '@/hooks/useCandidateProfiles';


import { fetchPriority } from '@/lib/fetchPriority';

// Draft key for localStorage — kontospecifik så att två konton (arbetsgivare/jobbsökare)
// på samma enhet aldrig kan skriva över varandras osparade profilutkast.
const PROFILE_DRAFT_KEY_BASE = 'parium_draft_profile';
const draftKeyFor = (userId?: string | null) =>
  userId ? `${PROFILE_DRAFT_KEY_BASE}:${userId}` : PROFILE_DRAFT_KEY_BASE;

interface ProfileDraftData {
  firstName?: string;
  lastName?: string;
  bio?: string;
  userLocation?: string;
  postalCode?: string;
  phone?: string;
  birthDate?: string;
  employmentStatus?: string;
  workingHours?: string;
  availability?: string;
  companyName?: string;
  orgNumber?: string;
  savedAt?: number;
}

interface ProfileFormValues {
  firstName: string;
  lastName: string;
  bio: string;
  userLocation: string;
  postalCode: string;
  phone: string;
  birthDate: string;
  profileImageUrl: string;
  videoUrl: string;
  cvUrl: string;
  companyName: string;
  orgNumber: string;
  employmentStatus: string;
  workingHours: string;
  availability: string;
  coverImageUrl: string;
  isProfileVideo: boolean;
  profileFileName: string;
  coverFileName: string;
}

const isProfileDraftData = (value: unknown): value is ProfileDraftData => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const draft = value as Record<string, unknown>;
  const stringFields = ['firstName', 'lastName', 'bio', 'userLocation', 'postalCode', 'phone', 'birthDate', 'employmentStatus', 'workingHours', 'availability', 'companyName', 'orgNumber'];
  return stringFields.every((field) => draft[field] === undefined || typeof draft[field] === 'string') &&
    (draft.savedAt === undefined || typeof draft.savedAt === 'number');
};

const readProfileDraft = (userId?: string | null) =>
  safeReadJsonCache<ProfileDraftData>(draftKeyFor(userId), isProfileDraftData);

// Clear draft (både kontospecifik och äldre delad nyckel)
export const clearProfileDraft = (userId?: string | null) => {
  try {
    localStorage.removeItem(draftKeyFor(userId));
    localStorage.removeItem(PROFILE_DRAFT_KEY_BASE);
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
  const [analyzing, setAnalyzing] = useState(false);
  const [failed, setFailed] = useState(false);
  const [retryTick, setRetryTick] = useState(0);
  const triggeredRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchSummary = async (): Promise<CvSummary | null> => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from('profile_cv_summaries')
        .select('summary_text, is_valid_cv, document_type, key_points, analyzed_at, cv_url')
        .eq('user_id', userId)
        .order('analyzed_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error fetching CV summary:', error);
        return null;
      }
      return (data as CvSummary) || null;
    };

    const run = async () => {
      if (!userId) return;
      setLoading(true);
      try {
        const data = await fetchSummary();
        if (cancelled) return;

        setSummary(data);
        setIsStale(!!(data && cvUrl && data.cv_url !== cvUrl));

        // Saknas analys för det aktuella CV:t? Kör direkt — och köa som skyddsnät.
        const needsAnalysis = !!cvUrl && (!data || data.cv_url !== cvUrl);
        if (needsAnalysis && triggeredRef.current !== cvUrl) {
          triggeredRef.current = cvUrl!;
          setAnalyzing(true);
          setFailed(false);

          // 1) Direktanrop → svar på sekunder istället för att vänta på cron-minuten.
          let directOk = false;
          try {
            const res = await supabase.functions.invoke('generate-cv-summary', {
              body: { applicant_id: userId, proactive: true },
            });
            directOk = !res.error;
            if (res.error) console.warn('Direkt CV-analys misslyckades:', res.error);
          } catch (err) {
            console.warn('Direkt CV-analys kastade fel:', err);
          }

          // 2) Skyddsnät: bara om direktanropet inte gick igenom (undviker dubbel AI-kostnad).
          //    Kön självläker dessutom var minut via cron om fliken stängs.
          if (!directOk) {
            try {
              await supabase.rpc('queue_cv_analysis', {
                p_applicant_id: userId,
                p_cv_url: cvUrl!,
                p_priority: 10,
              });
            } catch (err) {
              console.warn('Kunde inte köa CV-analys:', err);
            }
          }

          // 3) Poll tills analysen finns (hård gräns 60 sek — kan aldrig fastna).
          let done = false;
          const deadline = Date.now() + 60_000;
          // Kolla direkt efter direktanropet innan vi börjar vänta.
          const immediate = await fetchSummary();
          if (cancelled) return;
          if (immediate && immediate.cv_url === cvUrl) {
            setSummary(immediate);
            setIsStale(false);
            done = true;
          }
          while (!done && !cancelled && Date.now() < deadline) {
            await new Promise((r) => setTimeout(r, 2000));
            const fresh = await fetchSummary();
            if (cancelled) return;
            if (fresh && fresh.cv_url === cvUrl) {
              setSummary(fresh);
              setIsStale(false);
              done = true;
            }
          }

          if (!cancelled) {
            setAnalyzing(false);
            if (!done) setFailed(true);
          }
        }

      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [userId, cvUrl, refreshKey, retryTick]);

  if (!cvUrl) {
    return null;
  }

  if (loading || (analyzing && !summary)) {
    return (
      <div className="space-y-4 md:space-y-3 pt-4 md:pt-3 border-t border-white/10">
        <div className="flex items-center gap-2 mb-4">
          <Bot className="h-4 w-4 text-white" />
          <Label className="text-base font-medium text-white">AI-analys av ditt CV</Label>
        </div>
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-md p-4 flex items-center gap-2 text-white">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">{analyzing ? 'Analyserar ditt dokument…' : 'Laddar sammanfattning…'}</span>
        </div>
      </div>
    );
  }

  if (failed && !summary) {
    return (
      <div className="space-y-4 md:space-y-3 pt-4 md:pt-3 border-t border-white/10">
        <div className="flex items-center gap-2 mb-4">
          <Bot className="h-4 w-4 text-white" />
          <Label className="text-base font-medium text-white">AI-analys av ditt CV</Label>
        </div>
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-md p-4 text-white text-sm space-y-3">
          <p className="text-white">
            Vår AI-tjänst är tillfälligt otillgänglig. Ditt CV är sparat och syns för arbetsgivare —
            analysen görs automatiskt så snart tjänsten är tillbaka.
          </p>
          <Button
            type="button"
            variant="outlineNeutral"
            size="sm"
            className="rounded-full"
            onClick={() => {
              triggeredRef.current = null;
              setFailed(false);
              setRetryTick((t) => t + 1);
            }}
          >
            Försök igen
          </Button>
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
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-md p-4 text-white text-sm">
          <p>Analysen är på väg. Den dyker upp här inom någon minut — du behöver inte göra något.</p>
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
              <p className="font-medium">Det här ser inte ut som ett CV.</p>
              {summary.document_type && (
                <p className="text-yellow-100 mt-1">Vi tolkar filen som: {summary.document_type}</p>
              )}
            </div>

          </div>
        )}
        
        {/* Summary text */}
        {summary.summary_text ? (
          <div className="text-white text-sm leading-relaxed whitespace-pre-wrap">
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
        <p className="text-white text-xs">
          💡 Spara din profil igen för att uppdatera AI-analysen med ditt nya CV.
        </p>
      )}
    </div>
  );
};

const Profile = () => {
  const { profile, userRole, updateProfile, refreshProfile, user, preloadedAvatarUrl, preloadedCoverUrl } = useAuth();

  // Delayed fade-in (employer-side parity)
  const [showContent, setShowContent] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setShowContent(true), 100);
    return () => clearTimeout(timer);
  }, []);
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const notificationSettingsRef = useRef<HTMLDivElement>(null);
  const { hasUnsavedChanges, setHasUnsavedChanges, registerAutosaveFlush } = useUnsavedChanges();
  const isDiscardingChangesRef = useRef(false);
  const didInitProfileRef = useRef(false);
  const { enqueueProfileUpdate } = useOfflineProfileQueue(user?.id);
  const { enqueue: enqueueMediaForLater } = useOfflineMediaQueue(user?.id);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (location.hash !== '#notifications') return;
    const frame = requestAnimationFrame(() => {
      notificationSettingsRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
    return () => cancelAnimationFrame(frame);
  }, [location.hash]);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [uploadingMediaType, setUploadingMediaType] = useState<'image' | 'video' | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadProgressInfo, setUploadProgressInfo] = useState<UploadProgressInfo | null>(null);
  const [uploadAttempt, setUploadAttempt] = useState(1);
  // Avbryt pågående mediauppladdning (t.ex. en 60-sekunders video på svagt nät).
  const mediaUploadAbortRef = useRef<AbortController | null>(null);
  const cancelMediaUpload = useCallback(() => {
    mediaUploadAbortRef.current?.abort();
  }, []);
  // Lämnar användaren sidan mitt i en uppladdning ska nätverksarbetet dö med
  // sidan — annars fortsätter XHR:en och skriver state på en avmonterad vy.
  useEffect(() => () => { mediaUploadAbortRef.current?.abort(); }, []);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [coverProgressInfo, setCoverProgressInfo] = useState<UploadProgressInfo | null>(null);
  const [originalValues, setOriginalValues] = useState<ProfileFormValues | null>(null);
  const [cvSummaryRefreshKey, setCvSummaryRefreshKey] = useState(0);
  
  // 🔒 CRITICAL: Store local media values in sessionStorage to survive component remounts
  // This prevents DB sync from overwriting local changes when screenshot tools or tab switches cause remounts
  const LOCAL_MEDIA_KEY = `parium_local_media_state${user?.id ? `:${user.id}` : ''}`;
  
  interface LocalMediaState {
    profileImageUrl: string;
    videoUrl: string;
    coverImageUrl: string;
    isProfileVideo: boolean;
    profileFileName: string;
    coverFileName: string;
    cvUrl: string;
  }

  const isLocalMediaState = (value: unknown): value is LocalMediaState => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const media = value as Record<string, unknown>;
    return ['profileImageUrl', 'videoUrl', 'coverImageUrl', 'profileFileName', 'coverFileName', 'cvUrl']
      .every((key) => typeof media[key] === 'string') &&
      typeof media.isProfileVideo === 'boolean';
  };
  
  const getLocalMediaState = (): LocalMediaState | null => {
    try {
      const stored = sessionStorage.getItem(LOCAL_MEDIA_KEY);
      if (!stored) return null;
      const parsed: unknown = JSON.parse(stored);
      if (!isLocalMediaState(parsed)) {
        sessionStorage.removeItem(LOCAL_MEDIA_KEY);
        return null;
      }
      return parsed;
    } catch {
      try { sessionStorage.removeItem(LOCAL_MEDIA_KEY); } catch { /* ignore */ }
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
  // Speglar arbetsgivarsidan: när användaren öppnar editorn för en redan
  // befintlig bild ska "Spara" utan ändringar BEHÅLLA originalet istället
  // för att re-encoda och ladda upp en identisk kopia.
  const [isEditingExistingProfileImage, setIsEditingExistingProfileImage] = useState(false);
  const [isEditingExistingCoverImage, setIsEditingExistingCoverImage] = useState(false);
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [coverFileName, setCoverFileName] = useState(''); // Track filename for deletion
  const [profileFileName, setProfileFileName] = useState(''); // Track profile media filename
  const [isProfileVideo, setIsProfileVideo] = useState(false);
  const [cvOpen, setCvOpen] = useState(false);
  const [originalProfileImageFile, setOriginalProfileImageFile] = useState<File | null>(null);
  const [originalCoverImageFile, setOriginalCoverImageFile] = useState<File | null>(null);

  const resetProfileFormToValues = useCallback((values: ProfileFormValues) => {
    setFirstName(values.firstName || '');
    setLastName(values.lastName || '');
    setBio(values.bio || '');
    setUserLocation(values.userLocation || '');
    setPostalCode(values.postalCode || '');
    setPhone(values.phone || '');
    setBirthDate(values.birthDate || '');
    setProfileImageUrl(values.profileImageUrl || '');
    setVideoUrl(values.videoUrl || '');
    setCvUrl(values.cvUrl || '');
    setCompanyName(values.companyName || '');
    setOrgNumber(values.orgNumber || '');
    setEmploymentStatus(values.employmentStatus || '');
    setWorkingHours(values.workingHours || '');
    setAvailability(values.availability || '');
    setCoverImageUrl(values.coverImageUrl || '');
    setIsProfileVideo(values.isProfileVideo || false);
    setProfileFileName(values.profileFileName || '');
    setCoverFileName(values.coverFileName || '');
  }, []);
  
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
  const [deletedCandidateMedia, setDeletedCandidateMedia] = useState<{
    profileId: string;
    kind: 'media' | 'cover';
    profileImageUrl: string | null;
    videoUrl: string | null;
    coverImageUrl: string | null;
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
  const [cvFileName, setCvFileName] = useState(((profile as any)?.cv_filename || (profile as any)?.profile_file_name || ''));
  
  // 🎯 Generera signed URLs (hooks måste alltid anropas, inte villkorligt)
  // Om profilbilden har markerats för borttagning ska vi INTE falla tillbaka till värdet från databasen
  const effectiveProfileImagePath = profileImageUrl || (deletedProfileMedia ? null : (profile as any)?.profile_image_url);
  const fallbackProfileImageUrl = useMediaUrl(effectiveProfileImagePath, 'profile-image');
  const signedVideoUrl = useMediaUrl(videoUrl || (profile as any)?.video_url, 'profile-video');
  const videoPosterUrl = useVideoPoster(videoUrl || (profile as any)?.video_url);
  
  // För cover image: använd inte fallback från profile om coverImageUrl explicit är tom (har raderats)
  const effectiveCoverImagePath = coverImageUrl || ((deletedCoverImage || deletedProfileMedia) ? null : (profile as any)?.cover_image_url);
  const fallbackCoverUrl = useMediaUrl(effectiveCoverImagePath, 'cover-image');
  const signedCvUrl = useMediaUrl(cvUrl || (profile as any)?.cv_url, 'cv');
  
  // Använd förladdade URLs från useAuth om tillgängliga, men respektera lokala borttagningar
  // 🔒 KRITISK FIX: Om användaren har lokala (osparade) ändringar på media-pathen,
  // FÅR vi INTE använda preloaded URL — den pekar på den gamla DB-bilden och gör att
  // "Anpassa din bild" / ny uppladdning inte syns i UI förrän man sparat.
  const profileImagePathChangedLocally = !!profileImageUrl && profileImageUrl !== ((profile as any)?.profile_image_url || '');
  const coverImagePathChangedLocally = !!coverImageUrl && coverImageUrl !== ((profile as any)?.cover_image_url || '');
  const signedProfileImageUrl = effectiveProfileImagePath
    ? (profileImagePathChangedLocally ? fallbackProfileImageUrl : (preloadedAvatarUrl || fallbackProfileImageUrl))
    : null;
  const signedCoverUrl = effectiveCoverImagePath
    ? (coverImagePathChangedLocally ? fallbackCoverUrl : (preloadedCoverUrl || fallbackCoverUrl))
    : null;
  
  // Cache images to prevent blinking during re-renders
  const { cachedUrl: cachedProfileImageUrl } = useCachedImage(signedProfileImageUrl);
  const { cachedUrl: cachedCoverUrl } = useCachedImage(signedCoverUrl);

  // Vald profil i profilväljaren – null = grundprofilen ("Min profil").
  // När en extraprofil är vald visas dess bild/video på huvudytan istället.
  const [activeCandidateProfile, setActiveCandidateProfile] = useState<CandidateProfile | null>(null);
  const profileRailRef = useRef<ProfileSwitcherRailHandle>(null);
  // Sant först när handleSubmit faktiskt persisterade något (inte vid
  // valideringsfel) — styr "Sparat"-statusen i autosparet.
  const lastSaveOkRef = useRef(false);
  const activeExtraImageUrl = useMediaUrl(activeCandidateProfile?.profile_image_url || undefined, 'profile-image');
  const activeExtraVideoUrl = useMediaUrl(activeCandidateProfile?.video_url || undefined, 'profile-video');
  const activeExtraCoverUrl = useMediaUrl(activeCandidateProfile?.cover_image_url || undefined, 'cover-image');
  const activeExtraVideoPoster = useVideoPoster(activeCandidateProfile?.video_url || undefined);


  const displayIsVideo = activeCandidateProfile
    ? !!activeCandidateProfile.video_url
    : (isProfileVideo && !!videoUrl);
  const displayVideoUrl = activeCandidateProfile ? activeExtraVideoUrl : signedVideoUrl;
  const displayVideoPoster = activeCandidateProfile ? activeExtraVideoPoster : videoPosterUrl;
  const displayImageUrl = activeCandidateProfile
    ? activeExtraImageUrl
    : (cachedProfileImageUrl || signedProfileImageUrl);
  /** Sökväg till den visade profilens bild (grundprofil eller vald extraprofil). */
  const displayImagePath = activeCandidateProfile ? (activeCandidateProfile.profile_image_url || '') : profileImageUrl;
  const displayHasMedia = activeCandidateProfile
    ? !!(activeCandidateProfile.video_url || activeCandidateProfile.profile_image_url)
    : !!(videoUrl || profileImageUrl);
  const displayCoverPath = activeCandidateProfile ? (activeCandidateProfile.cover_image_url || '') : coverImageUrl;
  
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
    if (didInitProfileRef.current && hasUnsavedChanges && !isDiscardingChangesRef.current) return;

    if (profile) {
      const dbHasVideo = !!(profile as any)?.video_url;

      const values: ProfileFormValues = {
        firstName: profile.first_name || '',
        lastName: profile.last_name || '',
        bio: profile.bio || '',
        userLocation: profile.location || '',
        postalCode: (profile as any)?.postal_code || '',
        phone: profile.phone || '',
        birthDate: profile.birth_date || '',
        // Bild och video kan samexistera; videon styr bara vilken förhandsvisning som är aktiv.
        profileImageUrl: (profile as any)?.profile_image_url || '',
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

      const draftData = isDiscardingChangesRef.current ? null : readProfileDraft(user?.id);
      const draftValue = (key: keyof ProfileDraftData, fallback: string) => {
        const value = draftData?.[key];
        return typeof value === 'string' && value !== fallback ? value : fallback;
      };

      // Use draft values if they differ from DB (means user had unsaved changes)
      setFirstName(draftValue('firstName', values.firstName));
      setLastName(draftValue('lastName', values.lastName));
      setBio(draftValue('bio', values.bio));
      setUserLocation(draftValue('userLocation', values.userLocation));
      setPostalCode(draftValue('postalCode', values.postalCode));
      setPhone(draftValue('phone', values.phone));
      setBirthDate(draftValue('birthDate', values.birthDate));
      
      // 🔒 CRITICAL: Restore local media state from sessionStorage if it exists
      // This survives component remounts from tab switches or screenshot tools
      const localMediaRaw = isDiscardingChangesRef.current ? null : getLocalMediaState();
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
      const dbCvFileName = (profile as any)?.cv_filename || (profile as any)?.profile_file_name || '';
      setCvFileName(dbCvFileName);
      
      // Restore employer fields from draft if different
      setCompanyName(draftValue('companyName', values.companyName));
      setOrgNumber(draftValue('orgNumber', values.orgNumber));
      setEmploymentStatus(draftValue('employmentStatus', values.employmentStatus));
      setWorkingHours(draftValue('workingHours', values.workingHours));
      setAvailability(draftValue('availability', values.availability));

      // Store original values for comparison
      setOriginalValues(values);
      
      // Only reset unsaved changes flag if we don't have local media changes AND no draft was restored
      const hasDraftChanges = !!draftData && (['firstName', 'lastName', 'bio', 'userLocation', 'postalCode', 'phone', 'birthDate', 'companyName', 'orgNumber', 'employmentStatus', 'workingHours', 'availability'] as const)
        .some((key) => typeof draftData[key] === 'string' && draftData[key] !== values[key]);
      
      if (!getHasLocalMediaChanges() && !hasDraftChanges) {
        setHasUnsavedChanges(false);
      }
      didInitProfileRef.current = true;
    }
  }, [profile, hasUnsavedChanges, setHasUnsavedChanges]);

  // 🎯 Synkronisera med förladdade URLs från useAuth (precis som sidebaren)
  // Detta säkerställer att Profile.tsx alltid visar de redan cachade bilderna
  useEffect(() => {
    // Sync preloaded avatar URL
  }, [preloadedAvatarUrl, profile?.profile_image_url]);

  useEffect(() => {
    // Sync preloaded cover URL
  }, [preloadedCoverUrl, profile?.cover_image_url]);

  const checkForChanges = useCallback(() => {
    if (isDiscardingChangesRef.current) {
      setHasUnsavedChanges(false);
      return false;
    }

    if (!originalValues) return false; // Not loaded yet
    
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
      key => currentValues[key as keyof typeof currentValues] !== originalValues[key as keyof typeof currentValues]
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
    if (isDiscardingChangesRef.current) return;
    // Only save if there are actual changes
    if (!hasUnsavedChanges) return;
    
    const hasContent = firstName || lastName || bio || userLocation || postalCode || phone || birthDate;
    
    if (hasContent) {
      const saved = safeSetItem(draftKeyFor(user?.id), JSON.stringify({
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
      if (saved) {
        console.log('💾 Profile draft saved');
      } else {
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

  // Profilsidan autosparar – ingen "osparade ändringar"-varning behövs här.
  // Istället skrivs eventuell väntande ändring ned direkt när användaren lämnar.

  // Reset form to original values when user confirms leaving without saving on same route
  useEffect(() => {
    const onUnsavedConfirm = () => {
      if (!originalValues) return;
      isDiscardingChangesRef.current = true;
      // IMPORTANT: user chose to discard changes -> clear all local drafts first,
      // before React effects can write the old unsaved state back to storage.
      clearProfileDraft(user?.id);
      setLocalMediaState(null);

      resetProfileFormToValues(originalValues);
      setDeletedProfileMedia(null);
      setDeletedCoverImage(null);
      setHasUnsavedChanges(false);
      window.setTimeout(() => {
        clearProfileDraft(user?.id);
        setLocalMediaState(null);
        isDiscardingChangesRef.current = false;
        setHasUnsavedChanges(false);
      }, 250);
    };
    window.addEventListener('unsaved-confirm', onUnsavedConfirm as EventListener);
    return () => window.removeEventListener('unsaved-confirm', onUnsavedConfirm as EventListener);
  }, [originalValues, resetProfileFormToValues, setHasUnsavedChanges]);

  const isEmployer = userRole?.role === 'employer';

  // Hjälpfunktioner
  const countWords = (text: string) => {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  };

  const handleBioChange = (value: string) => {
    const wordCount = countWords(value);
    if (wordCount <= 250) {
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
    if (!isEmployer && !employmentStatus) newErrors.employmentStatus = 'Anställningsstatus är obligatorisk.';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };



  const uploadProfileMedia = async (file: File) => {
    // Bind uppladdningen till profilen som var vald när den startade.
    const targetProfileId = activeCandidateProfile?.id ?? null;
    const isVideo = looksLikeVideoFile(file);
    let uploadedStoragePath = '';
    setIsUploadingMedia(true);
    setUploadingMediaType(isVideo ? 'video' : 'image');
    setUploadProgress(0);
    setUploadProgressInfo(null);
    setUploadAttempt(1);

    const controller = new AbortController();
    mediaUploadAbortRef.current?.abort();
    mediaUploadAbortRef.current = controller;

    try {
      if (!user?.id) throw new Error('User not found');
      
      // 🚀 Riktig progress från XHR — ersätter den gamla "fake" timern
      const { storagePath, error: uploadError } = await uploadMedia(
        file,
        isVideo ? 'profile-video' : 'profile-image',
        user.id,
        {
          signal: controller.signal,
          onProgress: (p) => {
            setUploadProgress(p.percent);
            setUploadProgressInfo(p);
          },
          onAttempt: (attempt) => setUploadAttempt(attempt),
        }
      );

      setUploadProgress(100);

      if (uploadError) throw uploadError;
      uploadedStoragePath = storagePath;

      // Vald extraprofil: media sparas direkt i dess egen tunnel.
      if (targetProfileId) {
        if (!profileRailRef.current) throw new Error('Profilväljaren är inte tillgänglig.');
        await profileRailRef.current.updateProfileById(
          targetProfileId,
          isVideo
            ? { video_url: storagePath }
            : { profile_image_url: storagePath }
        );
        return;
      }

      
      // Update local state
        if (isVideo) {
          // Preserve current profile image as cover if none set yet
          const previousImage = profileImageUrl || (originalValues?.profileImageUrl || '');
          if (!coverImageUrl && previousImage) {
            setCoverImageUrl(previousImage);
            setCoverFileName(previousImage);
          }
          setVideoUrl(storagePath);
          setIsProfileVideo(true);
          // Signed URL handled by useMediaUrl hook
        } else {
          setProfileImageUrl(storagePath);
          setIsProfileVideo(!!videoUrl);
        }
      
      setProfileFileName(storagePath);
      setDeletedProfileMedia(null);
      setHasUnsavedChanges(true);
      // 🔒 Save to sessionStorage to survive remounts
      setLocalMediaState({
        profileImageUrl: isVideo ? profileImageUrl : storagePath,
        videoUrl: isVideo ? storagePath : videoUrl,
        coverImageUrl: isVideo && !coverImageUrl && (profileImageUrl || originalValues?.profileImageUrl) 
          ? (profileImageUrl || originalValues?.profileImageUrl || '') 
          : coverImageUrl,
        isProfileVideo: isVideo || !!videoUrl,
        profileFileName: storagePath,
        coverFileName,
        cvUrl
      });
    } catch (error) {
      // Användaren tryckte på "Avbryt" – inget fel, ingen offline-kö.
      if (error instanceof UploadAbortedError || controller.signal.aborted) {
        return;
      }
      console.error('Upload error:', error);
      if (activeCandidateProfile && uploadedStoragePath) {
        toast({
          title: 'Uppladdningen återställdes',
          description: 'Filen kunde inte kopplas till profilen och kommer att städas säkert.',
          variant: 'destructive',
        });
        return;
      }
      // 🛟 Offline-fallback: lägg i kö och flush:a när nätet är tillbaka
      const enqueued = await enqueueMediaForLater({
        blob: file,
        fileName: `${user!.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${file.name.split('.').pop() || 'bin'}`,
        mediaType: isVideo ? 'profile-video' : 'profile-image',
        targetTable: 'profiles',
        targetField: isVideo ? 'video_url' : 'profile_image_url',
        targetId: user!.id,
      });
      if (!enqueued) {
        toast({
          title: "Fel vid uppladdning",
          description: error instanceof Error ? error.message : "Kunde inte ladda upp filen.",
          variant: "destructive"
        });
      }
    } finally {
      if (mediaUploadAbortRef.current === controller) mediaUploadAbortRef.current = null;
      setIsUploadingMedia(false);
      setUploadingMediaType(null);
      setUploadProgress(0);
      setUploadProgressInfo(null);
      setUploadAttempt(1);
    }
  };


  const uploadCoverImage = async (file: File) => {
    const targetProfileId = activeCandidateProfile?.id ?? null;
    let uploadedStoragePath = '';
    setIsUploadingCover(true);
    setCoverProgressInfo(null);
    
    try {
      if (!user?.id) throw new Error('User not found');
      
      // Använd mediaManager för cover-bild
      const { storagePath, error: uploadError } = await uploadMedia(
        file,
        'cover-image',
        user.id,
        { onProgress: (p) => setCoverProgressInfo(p) }
      );

      if (uploadError) throw uploadError;
      uploadedStoragePath = storagePath;

      // Vald extraprofil: cover sparas direkt i dess egen tunnel.
      if (targetProfileId) {
        if (!profileRailRef.current) throw new Error('Profilväljaren är inte tillgänglig.');
        await profileRailRef.current.updateProfileById(targetProfileId, { cover_image_url: storagePath });
        return;
      }

      
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
    } catch (error) {
      console.error('Cover upload error:', error);
      if (activeCandidateProfile && uploadedStoragePath) {
        toast({
          title: 'Uppladdningen återställdes',
          description: 'Cover-bilden kunde inte kopplas till profilen och kommer att städas säkert.',
          variant: 'destructive',
        });
        return;
      }
      const enqueued = await enqueueMediaForLater({
        blob: file,
        fileName: `${user!.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${file.name.split('.').pop() || 'bin'}`,
        mediaType: 'cover-image',
        targetTable: 'profiles',
        targetField: 'cover_image_url',
        targetId: user!.id,
      });
      if (!enqueued) {
        toast({
          title: "Fel vid uppladdning",
          description: "Kunde inte ladda upp cover-bilden.",
          variant: "destructive"
        });
      }
    } finally {
      setIsUploadingCover(false);
      setCoverProgressInfo(null);
    }
  };

  const handleMediaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (looksLikeVideoFile(file)) {
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
    } else if (file.type.startsWith('image/') && file.type !== 'image/svg+xml' && !file.name.toLowerCase().endsWith('.svg')) {
      // Spara originalfilen för framtida redigeringar
      setOriginalProfileImageFile(file);
      const imageUrl = URL.createObjectURL(file);
      setPendingImageSrc(imageUrl);
      setIsEditingExistingProfileImage(false); // ny uppladdning, inte befintlig
      setImageEditorOpen(true);
    }
  };

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith('image/') && file.type !== 'image/svg+xml' && !file.name.toLowerCase().endsWith('.svg')) {
      // Spara originalfilen för framtida redigeringar
      setOriginalCoverImageFile(file);
      const imageUrl = URL.createObjectURL(file);
      setPendingCoverSrc(imageUrl);
      setIsEditingExistingCoverImage(false); // ny uppladdning
      setCoverEditorOpen(true);
    }
  };

  const handleProfileImageSave = async (editedBlob: Blob) => {
    const targetProfileId = activeCandidateProfile?.id ?? null;
    let uploadedStoragePath = '';
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
        user.data.user.id,
        {
          onProgress: (p) => {
            setUploadProgress(p.percent);
            setUploadProgressInfo(p);
          },
          onAttempt: (attempt) => setUploadAttempt(attempt),
        }
      );

      if (uploadError || !storagePath) throw uploadError || new Error('Upload failed');
      uploadedStoragePath = storagePath;

      // Vald extraprofil: bilden sparas direkt i dess egen tunnel.
      if (targetProfileId) {
        if (!profileRailRef.current) throw new Error('Profilväljaren är inte tillgänglig.');
        await profileRailRef.current.updateProfileById(targetProfileId, { profile_image_url: storagePath });
        setImageEditorOpen(false);
        if (pendingImageSrc) URL.revokeObjectURL(pendingImageSrc);
        setPendingImageSrc('');
        return;
      }


      // Förladda den signerade URL:en i bakgrunden (utan att blockera UI)
      import('@/lib/serviceWorkerManager').then(async ({ preloadSingleFile }) => {
        const signed = await getMediaUrl(storagePath, 'profile-image', 86400);
        if (signed) {
          preloadSingleFile(signed).catch(err => console.log('Preload error:', err));
        }
      });
      
      // Update local state instead of saving immediately
      setProfileImageUrl(storagePath);
      setIsProfileVideo(!!videoUrl);
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
        videoUrl,
        coverImageUrl,
        isProfileVideo: !!videoUrl,
        profileFileName: storagePath,
        coverFileName,
        cvUrl
      });
    } catch (error) {
      console.error('Profile image upload error:', error);
      if (activeCandidateProfile && uploadedStoragePath) {
        toast({
          title: 'Uppladdningen återställdes',
          description: 'Bilden kunde inte kopplas till profilen och kommer att städas säkert.',
          variant: 'destructive',
        });
        return;
      }
      const u = (await supabase.auth.getUser()).data.user;
      const enqueued = u ? await enqueueMediaForLater({
        blob: editedBlob,
        fileName: `${u.id}/${Date.now()}-profile.jpg`,
        mediaType: 'profile-image',
        targetTable: 'profiles',
        targetField: 'profile_image_url',
        targetId: u.id,
      }) : null;
      if (!enqueued) {
        toast({
          title: "Fel vid uppladdning",
          description: "Kunde inte ladda upp profilbilden.",
          variant: "destructive"
        });
      }
    } finally {
      setIsUploadingMedia(false);
      setUploadingMediaType(null);
      setUploadProgress(0);
      setUploadProgressInfo(null);
      setUploadAttempt(1);
    }
  };

  const handleCoverImageSave = async (editedBlob: Blob) => {
    const targetProfileId = activeCandidateProfile?.id ?? null;
    let uploadedStoragePath = '';
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
        user.data.user.id,
        { onProgress: (p) => setCoverProgressInfo(p) }
      );

      if (uploadError || !storagePath) throw uploadError || new Error('Upload failed');
      uploadedStoragePath = storagePath;

      // Vald extraprofil: cover sparas direkt i dess egen tunnel.
      if (targetProfileId) {
        if (!profileRailRef.current) throw new Error('Profilväljaren är inte tillgänglig.');
        await profileRailRef.current.updateProfileById(targetProfileId, { cover_image_url: storagePath });
        setCoverEditorOpen(false);
        if (pendingCoverSrc) URL.revokeObjectURL(pendingCoverSrc);
        setPendingCoverSrc('');
        return;
      }


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
    } catch (error) {
      console.error('Cover upload error:', error);
      if (activeCandidateProfile && uploadedStoragePath) {
        toast({
          title: 'Uppladdningen återställdes',
          description: 'Cover-bilden kunde inte kopplas till profilen och kommer att städas säkert.',
          variant: 'destructive',
        });
        return;
      }
      const u = (await supabase.auth.getUser()).data.user;
      const enqueued = u ? await enqueueMediaForLater({
        blob: editedBlob,
        fileName: `${u.id}/${Date.now()}-cover.jpg`,
        mediaType: 'cover-image',
        targetTable: 'profiles',
        targetField: 'cover_image_url',
        targetId: u.id,
      }) : null;
      if (!enqueued) {
        toast({
          title: "Fel vid uppladdning",
          description: "Kunde inte ladda upp cover-bilden.",
          variant: "destructive"
        });
      }
    } finally {
      setIsUploadingCover(false);
      setCoverProgressInfo(null);
    }
  };

  const deleteProfileMedia = async () => {
    // Vald extraprofil: samma återställningsbara flöde som grundprofilen.
    if (activeCandidateProfile) {
      try {
        if (!profileRailRef.current) throw new Error('Profilväljaren är inte tillgänglig.');
        const snapshot = {
          profileId: activeCandidateProfile.id,
          kind: 'media' as const,
          profileImageUrl: activeCandidateProfile.profile_image_url,
          videoUrl: activeCandidateProfile.video_url,
          coverImageUrl: activeCandidateProfile.cover_image_url,
        };
        await profileRailRef.current.updateProfileById(snapshot.profileId, { profile_image_url: null, video_url: null });
        setDeletedCandidateMedia(snapshot);
      } catch (error) {
        console.error('Error deleting candidate profile media:', error);
      }
      return;
    }
    if (!user?.id) return;
    
    try {
      // Save current media for undo
      setDeletedProfileMedia({
        profileImageUrl: originalValues?.profileImageUrl || profileImageUrl,
        coverImageUrl: originalValues?.coverImageUrl || coverImageUrl,
        profileFileName: originalValues?.profileFileName || profileFileName,
        coverFileName: originalValues?.coverFileName || coverFileName,
        isProfileVideo: originalValues?.isProfileVideo || isProfileVideo,
        videoUrl: originalValues?.videoUrl || videoUrl,
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
    } catch (error) {
      console.error('Error in deleteProfileMedia:', error);
      toast({
        title: "Fel",
        description: "Kunde inte förbereda borttagning.",
        variant: "destructive"
      });
    }
  };
  const restoreProfileMedia = async () => {
    if (activeCandidateProfile && deletedCandidateMedia?.profileId === activeCandidateProfile.id && deletedCandidateMedia.kind === 'media') {
      try {
        if (!profileRailRef.current) throw new Error('Profilväljaren är inte tillgänglig.');
        await profileRailRef.current.updateProfileById(deletedCandidateMedia.profileId, {
          profile_image_url: deletedCandidateMedia.profileImageUrl,
          video_url: deletedCandidateMedia.videoUrl,
        });
        setDeletedCandidateMedia(null);
      } catch (error) {
        console.error('Error restoring candidate profile media:', error);
      }
      return;
    }
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
  };

  const deleteCoverImage = async () => {
    // Vald extraprofil: samma återställningsbara flöde som grundprofilen.
    if (activeCandidateProfile) {
      try {
        if (!profileRailRef.current) throw new Error('Profilväljaren är inte tillgänglig.');
        const snapshot = {
          profileId: activeCandidateProfile.id,
          kind: 'cover' as const,
          profileImageUrl: activeCandidateProfile.profile_image_url,
          videoUrl: activeCandidateProfile.video_url,
          coverImageUrl: activeCandidateProfile.cover_image_url,
        };
        await profileRailRef.current.updateProfileById(snapshot.profileId, { cover_image_url: null });
        setDeletedCandidateMedia(snapshot);
      } catch (error) {
        console.error('Error deleting candidate profile cover:', error);
      }
      return;
    }
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
    } catch (error) {
      console.error('Error in deleteCoverImage:', error);
      toast({
        title: "Fel",
        description: "Kunde inte förbereda borttagning.",
        variant: "destructive"
      });
    }
  };
  
  const restoreCoverImage = async () => {
    if (activeCandidateProfile && deletedCandidateMedia?.profileId === activeCandidateProfile.id && deletedCandidateMedia.kind === 'cover') {
      try {
        if (!profileRailRef.current) throw new Error('Profilväljaren är inte tillgänglig.');
        await profileRailRef.current.updateProfileById(deletedCandidateMedia.profileId, { cover_image_url: deletedCandidateMedia.coverImageUrl });
        setDeletedCandidateMedia(null);
      } catch (error) {
        console.error('Error restoring candidate profile cover:', error);
      }
      return;
    }
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
  };

  const handleEditExistingProfile = async () => {
    // Vald extraprofil: redigera dess egen bild.
    if (activeCandidateProfile) {
      if (!activeCandidateProfile.profile_image_url) return;
      try {
        const signedUrl = await getMediaUrl(activeCandidateProfile.profile_image_url, 'profile-image', 86400);
        if (signedUrl) {
          setPendingImageSrc(signedUrl);
          setIsEditingExistingProfileImage(true);
          setImageEditorOpen(true);
        }
      } catch (error) {
        console.error('Error loading profile image for editing:', error);
        toast({ title: 'Fel', description: 'Kunde inte ladda bilden för redigering.', variant: 'destructive' });
      }
      return;
    }
    if (!profileImageUrl) return;
    
    // Visa alltid originalbilden i editorn (om den finns)
    if (originalProfileImageFile) {
      const imageUrl = URL.createObjectURL(originalProfileImageFile);
      setPendingImageSrc(imageUrl);
      setIsEditingExistingProfileImage(true);
      setImageEditorOpen(true);
    } else {
      // Fallback: Hämta den signerade URL:en för den befintliga profilbilden
      try {
        const signedUrl = await getMediaUrl(profileImageUrl, 'profile-image', 86400);
        if (signedUrl) {
          setPendingImageSrc(signedUrl);
          setIsEditingExistingProfileImage(true);
          setImageEditorOpen(true);
        }
      } catch (error) {
        console.error('Error loading profile image for editing:', error);
        toast({
          title: "Fel",
          description: "Kunde inte ladda bilden för redigering.",
          variant: "destructive"
        });
      }
    }
  };

  const handleEditExistingCover = async () => {
    // Vald extraprofil: redigera dess egen cover-bild.
    if (activeCandidateProfile) {
      if (!activeCandidateProfile.cover_image_url) return;
      try {
        const signedUrl = await getMediaUrl(activeCandidateProfile.cover_image_url, 'cover-image', 86400);
        if (signedUrl) {
          setPendingCoverSrc(signedUrl);
          setIsEditingExistingCoverImage(true);
          setCoverEditorOpen(true);
        }
      } catch (error) {
        console.error('Error loading existing cover:', error);
        toast({ title: 'Fel', description: 'Kunde inte ladda cover-bilden för redigering.', variant: 'destructive' });
      }
      return;
    }
    if (!coverImageUrl) return;
    
    // 1) Om vi har en explicit uppladdad cover-bild, använd den ursprungliga filen
    if (originalCoverImageFile) {
      const imageUrl = URL.createObjectURL(originalCoverImageFile);
      setPendingCoverSrc(imageUrl);
      setIsEditingExistingCoverImage(true);
      setCoverEditorOpen(true);
      return;
    }

    // 2) Om cover-bilden kommer från en tidigare profilbild (video + auto-cover),
    //    använd den ursprungliga profilbildsfilen som "original" för covern
    if (isProfileVideo && originalProfileImageFile) {
      const imageUrl = URL.createObjectURL(originalProfileImageFile);
      setPendingCoverSrc(imageUrl);
      setIsEditingExistingCoverImage(true);
      setCoverEditorOpen(true);
      return;
    }

    // 3) Fallback: hämta signerad URL för befintlig cover-bild från lagring
    try {
      const signedUrl = await getMediaUrl(coverImageUrl, 'cover-image', 86400);
      if (signedUrl) {
        setPendingCoverSrc(signedUrl);
        setIsEditingExistingCoverImage(true);
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
      setOriginalValues(prev => prev ? ({
        ...prev,
        cvUrl: '',
      }) : prev);

      // No unsaved changes since CV is already removed in DB
      setHasUnsavedChanges(false);

      // Refresh profile to update state
      await refreshProfile();
    } catch (error) {
      console.error('Error deleting CV:', error);
      toast({
        title: "Kunde inte ta bort CV",
        description: "Ett fel uppstod vid borttagning av CV.",
        variant: "destructive"
      });
    }
  };
  const { isOnline, showOfflineToast } = useOnline();

  const rollbackUnsavedBaseMedia = async () => {
    if (!originalValues) return;

    const savedPaths = new Set([
      originalValues.profileImageUrl,
      originalValues.videoUrl,
      originalValues.coverImageUrl,
      originalValues.cvUrl,
    ].filter((path): path is string => !!path));
    const pendingMedia = [
      { path: profileImageUrl, type: 'profile-image' as const },
      { path: videoUrl, type: 'profile-video' as const },
      { path: coverImageUrl, type: 'cover-image' as const },
      { path: cvUrl, type: 'cv' as const },
    ].filter(({ path }) => !!path && !savedPaths.has(path));
    const uniquePending = Array.from(new Map(pendingMedia.map((item) => [item.path, item])).values());

    // Övergivna filer städas av backend först efter full referenskontroll.
    void uniquePending;
    resetProfileFormToValues(originalValues);
    setDeletedProfileMedia(null);
    setDeletedCoverImage(null);
    setLocalMediaState(null);
    setHasUnsavedChanges(false);
  };

  const handleSubmit = async (e?: React.FormEvent, opts?: { silent?: boolean }) => {
    e?.preventDefault?.();
    const silent = !!opts?.silent;
    // Autosparet får bara visa "Sparat" när något faktiskt persisterades.
    lastSaveOkRef.current = false;


    if (!isOnline) {
      // 🚀 OFFLINE: Queue text-based profile updates for auto-sync
      const valid = validateRequiredFields();
      if (!valid) {
        if (!silent) {
          toast({
            title: "Komplettera uppgifter",
            description: "Fyll i alla obligatoriska fält markerade med rött.",
            variant: "destructive",
          });
        }
        return;
      }


      const offlineUpdates: any = {
        first_name: firstName.trim() || null,
        last_name: lastName.trim() || null,
        bio: bio.trim() || null,
        location: userLocation.trim() || null,
        city: userLocation.trim() || null,
        postal_code: postalCode.trim() || null,
        phone: phone.trim() || null,
        birth_date: birthDate || null,
        employment_type: employmentStatus || null,
        work_schedule: workingHours || null,
        availability: availability || null,
      };

      if (isEmployer) {
        offlineUpdates.company_name = companyName.trim() || null;
        offlineUpdates.org_number = orgNumber.trim() || null;
      }

      enqueueProfileUpdate(offlineUpdates);
      lastSaveOkRef.current = true;
      setHasUnsavedChanges(false);

      toast({
        id: 'profile-offline-queued',
        title: "Ändringar köade ✓",
        description: "Sparas automatiskt när du är online igen.",
        duration: 4000,
      });
      return;
    }

    // Validate required fields before saving
    const valid = validateRequiredFields();
    if (!valid) {
      if (!silent) {
        toast({
          title: "Komplettera uppgifter",
          description: "Fyll i alla obligatoriska fält markerade med rött.",
          variant: "destructive",
        });
      }
      return;
    }


    setLoading(true);

    try {
      // 🔒 SNAPSHOT-SKYDD: När kandidaten tar bort sin profilbild/video/omslag
      // från sin egen profil ska filen ligga kvar i storage så att tidigare
      // ansökningar (snapshot vid ansökningstillfället) fortfarande visar
      // rätt media för arbetsgivaren. Filen frånkopplas bara från profiles-
      // tabellen (sätts till null nedan). Faktisk fil-radering sker endast
      // vid total kontoradering (cascade via delete-user edge function).


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

      // Bild, video och videons cover är separata tillgångar och får samexistera.
      updates.profile_image_url = profileImageUrl || null;
      updates.video_url = videoUrl || null;
      updates.cover_image_url = coverImageUrl || null;
      updates.is_profile_video = !!videoUrl;

      if (isEmployer) {
        updates.company_name = companyName.trim() || null;
        updates.org_number = orgNumber.trim() || null;
      }

      const result = await updateProfile(updates);
      
      if (!result.error) {
        // 🚀 Trigger proactive CV analysis if CV was updated
        const cvWasUpdated = cvUrl && cvUrl !== originalValues?.cvUrl;
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
        lastSaveOkRef.current = true;
        setLocalMediaState(null); // 🔒 Clear sessionStorage after successful save
        clearProfileDraft(user?.id); // 🔒 Clear localStorage draft after successful save
        console.log('💾 Profile draft cleared after save');
        
        // Clear undo states after an explicit save. Vid autospar behålls
        // "Ångra borttagning" så att man hinner ändra sig.
        if (!silent) {
          setDeletedProfileMedia(null);
          setDeletedCoverImage(null);

          toast({
            id: 'profile-save-success',
            title: "Profil uppdaterad",
            description: "Dina ändringar har sparats.",
            duration: 2000,
            route: '/profile'
          });
        }

      } else {
        await rollbackUnsavedBaseMedia();
        toast({
          title: 'Ändringarna återställdes',
          description: 'Profilen kunde inte sparas. Nya filer har tagits bort och senast sparade media har återställts.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Profile update error:', error);
      await rollbackUnsavedBaseMedia();
      toast({
        title: "Ändringarna återställdes",
        description: "Profilen kunde inte sparas. Nya filer har tagits bort och senast sparade media har återställts.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // 🔄 Autospar: grundprofilen sparas direkt, precis som extraprofilerna.
  // Ingen "Spara ändringar"-knapp behövs längre. Ogiltiga fält sparas inte
  // (fältfelen visas som vanligt), och ingen notis visas vid lyckad sparning.
  const submitRef = useRef(handleSubmit);
  submitRef.current = handleSubmit;
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const savedResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (savedResetRef.current) clearTimeout(savedResetRef.current); }, []);
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    if (loading || isUploadingMedia || isUploadingCover) return;
    if (isDiscardingChangesRef.current) return;
    const t = setTimeout(async () => {
      if (savedResetRef.current) clearTimeout(savedResetRef.current);
      setSaveStatus('saving');
      try {
        await submitRef.current(undefined, { silent: true });
        // "Sparat" visas bara om något faktiskt persisterades — annars
        // (t.ex. ogiltiga obligatoriska fält) återgår statusen tyst.
        if (lastSaveOkRef.current) {
          setSaveStatus('saved');
          savedResetRef.current = setTimeout(() => setSaveStatus('idle'), 2000);
        } else {
          setSaveStatus('idle');
        }
      } catch {
        setSaveStatus('idle');
      }
    }, 900);
    return () => clearTimeout(t);
  }, [hasUnsavedChanges, loading, isUploadingMedia, isUploadingCover,
      firstName, lastName, bio, userLocation, postalCode, phone, birthDate,
      employmentStatus, workingHours, availability, companyName, orgNumber,
      profileImageUrl, videoUrl, coverImageUrl, cvUrl, isProfileVideo]);

  // Lämnar användaren sidan innan debounce-fönstret gått ut skrivs ändringen
  // ned direkt — därför visas aldrig någon "Osparade ändringar"-dialog här.
  const hasUnsavedRef = useRef(hasUnsavedChanges);
  hasUnsavedRef.current = hasUnsavedChanges;
  useEffect(() => registerAutosaveFlush(() => {
    if (!hasUnsavedRef.current) return;
    void submitRef.current(undefined, { silent: true });
  }), [registerAutosaveFlush]);




  if (!showContent) {
    // Innehållsformat skelett istället för en tom osynlig yta — samma
    // standard som övriga sidor.
    return <ProfileFormSkeleton variant="job_seeker" />;
  }

   return (
     <div className="responsive-container-wide space-y-6 [padding-bottom:calc(env(safe-area-inset-bottom,0px)+50px)]">
      <div className="text-center mb-6">
        <h1 className="text-xl md:text-2xl font-semibold text-white tracking-tight">Min Profil</h1>
        <p className="text-sm text-white mt-1">
          Hantera din personliga information
        </p>
        {!isEmployer && (
          <p className="mt-1 text-xs text-white">
            (Du kan ha upp till tre profiler)
          </p>
        )}
        <div
          className="mt-1 h-4 text-xs text-white/70"
          aria-live="polite"
          role="status"
        >
          <span
            className={`inline-flex items-center gap-1.5 transition-opacity duration-300 ${saveStatus === 'idle' ? 'opacity-0' : 'opacity-100'}`}
          >
            {saveStatus === 'saving' ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                Sparar…
              </>
            ) : (
              <>
                <Check className="h-3 w-3" aria-hidden="true" />
                Sparat
              </>
            )}
          </span>
        </div>
      </div>


      <div className="space-y-6">
        {/* Profile Image/Video Card */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg">
          <div className="p-4 space-y-2">
            {!isEmployer && (
              <ProfileSwitcherRail
                ref={profileRailRef}
                userId={user?.id}
                baseImageUrl={isProfileVideo ? null : signedProfileImageUrl}
                baseCoverUrl={signedCoverUrl}
                baseHasVideo={isProfileVideo && !!videoUrl}
                onActiveProfileChange={setActiveCandidateProfile}
              />
            )}
          </div>
          <div className="p-4 flex flex-col items-center space-y-4">
            <div className="relative">
              {displayIsVideo ? (
                <ProfileVideo
                  videoUrl={displayVideoUrl}
                  coverImageUrl={activeCandidateProfile ? (activeExtraCoverUrl ?? undefined) : signedCoverUrl}
                  posterUrl={displayVideoPoster}
                  userInitials={`${firstName.charAt(0)}${lastName.charAt(0)}`}
                  alt="Profile video"
                  className="w-32 h-32 border-4 border-white/10 rounded-full overflow-hidden"
                  countdownVariant="circle"
                />
              ) : (
                <div
                  className="cursor-pointer"
                  onClick={() => document.getElementById('profile-image')?.click()}
                >
                  <Avatar className="h-32 w-32 border-4 border-white/10">
                    {displayImageUrl ? (
                      <AvatarImage
                        src={displayImageUrl || undefined}
                        alt="Profilbild"
                        className="object-cover"
                        decoding="sync"
                        loading="eager"
                        {...fetchPriority('high')}
                        draggable={false}
                      />
                    ) : null}
                    {!displayImageUrl && (
                      <AvatarFallback className="text-4xl font-semibold bg-white/20 text-white">
                        {((firstName?.trim()?.[0]?.toUpperCase() || '') + (lastName?.trim()?.[0]?.toUpperCase() || '')) || '?'}
                      </AvatarFallback>
                    )}
                  </Avatar>
                </div>
              )}

              {/* Delete/Restore icon for profile media – samma för alla profiler */}
              {((activeCandidateProfile && deletedCandidateMedia?.profileId === activeCandidateProfile.id && deletedCandidateMedia.kind === 'media') || (!activeCandidateProfile && deletedProfileMedia && !videoUrl)) ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    void restoreProfileMedia();
                  }}
                  className="absolute -top-3 -right-3 rounded-full bg-white/20 p-2 text-white outline-none backdrop-blur-sm transition-colors [-webkit-tap-highlight-color:transparent] focus:ring-0 focus-visible:ring-0 hover:bg-white/30"
                  aria-label="Återställ media"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
              ) : displayHasMedia ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteProfileMedia();
                  }}
                  className="absolute -top-3 -right-3 rounded-full border border-destructive/40 bg-destructive/20 p-2 text-white outline-none transition-colors [-webkit-tap-highlight-color:transparent] focus:ring-0 focus-visible:ring-0 md:hover:!border-destructive/50 md:hover:!bg-destructive/30 md:hover:!text-white"
                  aria-label="Ta bort profilmedia"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              ) : null}

              <input
                id="profile-image"
                type="file"
                 accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,video/*,.mp4,.m4v,.mov,.webm,.3gp,.3g2,.mkv"
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
                Välj en profilbild, profilvideo eller båda (video max 60 sekunder).
              </Label>

              {isUploadingMedia && (
                <UploadInlineProgress
                  label={uploadAttempt > 1 ? `Försöker igen (försök ${uploadAttempt})…` : 'Laddar upp…'}
                  percent={uploadProgress > 0 ? uploadProgress : undefined}
                  hint={uploadProgressInfo && uploadProgressInfo.secondsRemaining > 0
                    ? formatTimeRemaining(uploadProgressInfo.secondsRemaining) ?? undefined
                    : undefined}
                  onCancel={cancelMediaUpload}
                />
              )}

            </div>

            {/* Mediakontroller */}
            {!isUploadingMedia && (
              <div className="mt-2 flex w-full flex-col items-center gap-3">
                <div className={`grid w-full max-w-sm gap-2 ${displayIsVideo ? 'grid-cols-2' : 'grid-cols-1'}`} aria-label="Status för profilmedia">
                  <div className="flex min-h-11 items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.07] px-4 py-2 backdrop-blur-sm">
                    <span className="min-w-0 break-words text-center text-xs font-medium leading-tight text-white">
                      {displayIsVideo ? 'Video uppladdad' : `Bild ${displayImagePath ? 'uppladdad' : 'inte uppladdad'}`}
                    </span>
                    <span className={(displayIsVideo || !!displayImagePath) ? 'text-success' : 'text-destructive'} aria-hidden="true">
                      {(displayIsVideo || !!displayImagePath) ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                    </span>
                  </div>
                  {displayIsVideo && (
                    <div className="flex min-h-11 items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.07] px-4 py-2 backdrop-blur-sm">
                      <span className="min-w-0 break-words text-center text-xs font-medium leading-tight text-white">
                        Cover-bild {displayCoverPath ? 'uppladdad' : 'inte uppladdad'}
                      </span>
                      <span className={displayCoverPath ? 'text-success' : 'text-destructive'} aria-hidden="true">
                        {displayCoverPath ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-center gap-2 text-center">
                  {displayImagePath && (
                    <Button
                      type="button"
                      variant="glass"
                      onClick={handleEditExistingProfile}
                      className="h-auto min-h-10 w-full max-w-xs whitespace-normal px-4 py-2 text-center text-sm"
                    >
                      Anpassa profilbild
                    </Button>
                  )}
                  {displayIsVideo && displayCoverPath && (
                    <Button
                      type="button"
                      variant="glass"
                      onClick={handleEditExistingCover}
                      className="h-auto min-h-10 w-full max-w-xs whitespace-normal px-4 py-2 text-center text-sm"
                    >
                      Anpassa cover-bild
                    </Button>
                  )}

                  {displayIsVideo && !displayCoverPath && (
                  <div className="relative flex w-full max-w-xs items-center justify-center">
                    <Button
                      type="button"
                      variant="glass"
                      onClick={() => document.getElementById('cover-image')?.click()}
                      disabled={isUploadingCover || isUploadingMedia}
                      className="h-auto min-h-10 w-full whitespace-normal px-4 py-2 text-center text-sm"
                    >
                      Lägg till cover-bild
                    </Button>
                    {((activeCandidateProfile && deletedCandidateMedia?.profileId === activeCandidateProfile.id && deletedCandidateMedia.kind === 'cover') || (!activeCandidateProfile && !coverImageUrl && deletedCoverImage)) && (
                      <button
                        onClick={() => void restoreCoverImage()}
                        disabled={isUploadingCover}
                        className="absolute -right-10 rounded-full bg-white/20 p-2 text-white outline-none backdrop-blur-sm transition-colors [-webkit-tap-highlight-color:transparent] focus:ring-0 focus-visible:ring-0 disabled:opacity-50 hover:bg-white/30"
                        aria-label="Återställ cover-bild"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  )}

                  {/* Lägg till den mediatyp som saknas; bild och video kan samexistera. */}
                  {!displayIsVideo && (
                    <Button
                      type="button"
                      variant="glass"
                      onClick={() => document.getElementById('profile-video-only')?.click()}
                      disabled={isUploadingMedia}
                      className="h-auto min-h-10 w-full max-w-xs whitespace-normal px-4 py-2 text-center text-sm"
                    >
                      Lägg till profilvideo
                    </Button>
                  )}
                  {displayIsVideo && !displayImagePath && (
                    <Button
                      type="button"
                      variant="glass"
                      onClick={() => document.getElementById('profile-image-only')?.click()}
                      disabled={isUploadingMedia}
                      className="h-auto min-h-10 w-full max-w-xs whitespace-normal px-4 py-2 text-center text-sm"
                    >
                      Lägg till profilbild
                    </Button>
                  )}
                </div>

                <Input
                  type="file"
                  id="cover-image"
                   accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
                  className="hidden"
                  onChange={handleCoverChange}
                  disabled={isUploadingCover}
                />
                <input
                  id="profile-image-only"
                  type="file"
                   accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
                  className="hidden"
                  onChange={handleMediaChange}
                  disabled={isUploadingMedia}
                />
                <input
                  id="profile-video-only"
                  type="file"
                  accept="video/*,.mp4,.m4v,.mov,.webm,.3gp,.3g2,.mkv"
                  className="hidden"
                  onChange={handleMediaChange}
                  disabled={isUploadingMedia}
                />

                {isUploadingCover && (
                  <UploadInlineProgress
                    label="Laddar upp cover-bild…"
                    percent={coverProgressInfo?.percent}
                  />
                )}

              </div>
            )}

          </div>
        </div>

        {/* Profile Information */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg">
          <div className="p-4 border-b border-white/10">
            <h3 className="flex items-center gap-2 text-base font-semibold text-white">
              <User className="h-4 w-4" />
              Personlig Information
            </h3>
            <p className="text-white text-sm mt-1">
              Uppdatera din grundläggande profilinformation
            </p>
          </div>
          <div className="p-4">
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
                      className={`h-11 !min-h-0 bg-white/5 backdrop-blur-sm border-white/10 text-white hover:bg-white/10 hover:border-white/50 md:hover:border-white/50 placeholder:text-white text-sm ${errors.firstName ? 'border-red-400' : ''}`}
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
                      className={`h-11 !min-h-0 bg-white/5 backdrop-blur-sm border-white/10 text-white hover:bg-white/10 hover:border-white/50 md:hover:border-white/50 placeholder:text-white text-sm ${errors.lastName ? 'border-red-400' : ''}`}
                    />
                    {errors.lastName && <p className="text-sm text-red-300">{errors.lastName}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-3">
                  <div className="space-y-2 md:space-y-1.5">
                    <Label htmlFor="birthDate" className="text-white text-sm">
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
                        className={`h-11 !min-h-0 pl-10 bg-white/5 backdrop-blur-sm border-white/10 text-white hover:bg-white/10 hover:border-white/50 md:hover:border-white/50 placeholder:text-white text-sm ${errors.phone ? 'border-red-400' : ''}`}
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
                  <div className="flex h-11 !min-h-0 w-full rounded-md border bg-white/5 backdrop-blur-sm border-white/10 text-white pl-10 pr-3 py-2 text-sm items-center min-w-0 hover:bg-white/10 hover:border-white/50 md:hover:border-white/50 transition-all duration-150">
                    <TruncatedText
                      text={user?.email || ''}
                      className="truncate min-w-0 max-w-full"
                    />
                  </div>
                </div>
              </div>

              {/* Postnummer & Ort */}
              <WorkplacePostalCodeSelector
                postalCodeValue={postalCode}
                cityValue={userLocation}
                onPostalCodeChange={setPostalCode}
                onLocationChange={(city, _postalCode, _municipality, _county, source) => {
                  // Användarens egen redigering vinner alltid. Automatiska
                  // uppslag (t.ex. vid inladdning av sparat postnummer) får bara
                  // fylla i orten när fältet är tomt — annars skulle ett sparat
                  // ortnamn skrivas över utan att användaren gjort något.
                  if (source === 'auto') {
                    setUserLocation((prev) => (prev.trim() ? prev : city));
                    return;
                  }
                  setUserLocation(city);
                }}
                onValidationChange={setHasValidLocation}
              />
              {errors.userLocation && !hasValidLocation && <p className="text-sm text-red-300">{errors.userLocation}</p>}

              {/* Bio */}
              <div className="space-y-2 md:space-y-1.5 pt-4 md:pt-3 border-t border-white/10">
                <Label htmlFor="bio" className="text-white text-sm">Presentation / Om mig</Label>
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
                    {countWords(bio)}/250 ord
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
                        <Label htmlFor="employmentStatus" className="text-white text-sm">
                          Anställningsstatus? <span className="text-white">*</span>
                        </Label>
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger asChild>
                          <Button
                            variant="outlineNeutral"
                            className="w-full h-11 !min-h-0 bg-white/5 backdrop-blur-sm border-white/10 text-white text-sm transition-all duration-300 md:hover:bg-white/10 md:hover:text-white md:hover:border-white/50 [&_svg]:text-white md:hover:[&_svg]:text-white justify-between"
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
                            className="w-72 glass-panel z-50 rounded-md text-white overflow-visible"
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
                          <Label htmlFor="workingHours" className="text-white text-sm">Hur mycket jobbar du idag? <span className="text-white">*</span></Label>
                          <DropdownMenu modal={false}>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="outline"
                                className="w-full h-11 !min-h-0 bg-white/5 backdrop-blur-sm border-white/10 text-white text-sm transition-all duration-300 md:hover:bg-white/10 md:hover:border-white/50 md:hover:text-white [&_svg]:text-white md:hover:[&_svg]:text-white justify-between"
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
                               className="w-72 max-h-80 overflow-y-auto glass-panel z-50 rounded-md text-white"
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
                        <Label htmlFor="availability" className="text-white text-sm">När kan du börja nytt jobb? <span className="text-white">*</span></Label>
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              className="w-full h-11 !min-h-0 bg-white/5 backdrop-blur-sm border-white/10 text-white text-sm transition-all duration-300 md:hover:bg-white/10 md:hover:border-white/50 md:hover:text-white [&_svg]:text-white md:hover:[&_svg]:text-white justify-between"
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
                            className="w-72 glass-panel z-50 rounded-md text-white overflow-visible"
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
                      <div className="w-full min-h-11 py-[11.2px] bg-white/5 backdrop-blur-sm border border-white/10 rounded-md flex items-center px-3 gap-2">
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
                          className="rounded-full border border-destructive/40 bg-destructive/20 p-2 text-white transition-colors md:hover:!border-destructive/50 md:hover:!bg-destructive/30 md:hover:!text-white"
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
                                // Cron-jobbet plockar upp kön inom en minut.
                              });
                            }
                          }}
                          onFileRemoved={() => {
                            setCvUrl('');
                            setCvFileName('');
                          }}
                          currentFile={undefined}
                          acceptedFileTypes={['application/pdf', '.pdf', '.doc', '.docx', '.rtf', '.odt', '.txt', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/rtf', 'application/vnd.oasis.opendocument.text', 'text/plain']}
                          maxFileSize={50 * 1024 * 1024}
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
                      <Label htmlFor="companyName" className="text-white text-sm">Företagsnamn</Label>
                      <Input
                        id="companyName"
                        placeholder="Mitt Företag AB"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        className="bg-white/5 backdrop-blur-sm border-white/10 text-white hover:bg-white/10 hover:border-white/50 md:hover:border-white/50 placeholder:text-white"
                      />
                    </div>

                    <div className="space-y-2 md:space-y-1.5">
                      <Label htmlFor="orgNumber" className="text-white text-sm">Organisationsnummer</Label>
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

            </form>
          </div>
        </div>
      </div>

      {/* Notification Settings */}
      <div id="notifications" ref={notificationSettingsRef} className="mt-8 scroll-mt-6">
        <JobSeekerNotificationSettings />
      </div>

      {/* Active Sessions */}
      <div className="mt-8">
        <ActiveSessionsSettings />
      </div>

      {/* GDPR: dataportabilitet */}
      <div className="mt-8">
        <PrivacyDataPanel />
      </div>


      {/* Image Editors — speglar arbetsgivarsidans exakta struktur:
          aspectRatio, isCircular och onRestoreOriginal så att "Spara" utan
          ändringar BEHÅLLER originalet istället för att re-encoda. */}
      <ImageEditor
        isOpen={imageEditorOpen}
        onClose={() => {
          setImageEditorOpen(false);
          setIsEditingExistingProfileImage(false);
          setPendingImageSrc('');
        }}
        imageSrc={pendingImageSrc}
        onSave={handleProfileImageSave}
        onRestoreOriginal={isEditingExistingProfileImage ? async () => { /* behåll original — ingen åtgärd */ } : undefined}
        aspectRatio={1}
        isCircular={true}
      />

      <ImageEditor
        isOpen={coverEditorOpen}
        onClose={() => {
          setCoverEditorOpen(false);
          setIsEditingExistingCoverImage(false);
          setPendingCoverSrc('');
        }}
        imageSrc={pendingCoverSrc}
        onSave={handleCoverImageSave}
        onRestoreOriginal={isEditingExistingCoverImage ? async () => { /* behåll original — ingen åtgärd */ } : undefined}
        aspectRatio={1}
        isCircular
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