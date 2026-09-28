import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/useAuth';
import { ProfileFormSkeleton } from '@/components/profile/ProfileFormSkeleton';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { useMediaUrl } from '@/hooks/useMediaUrl';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { Trash2, Camera, Pencil, RotateCcw, WifiOff, AlertCircle, Check, Loader2 } from 'lucide-react';
import { useOnline } from '@/hooks/useOnlineStatus';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import ImageEditor from '@/components/ImageEditor';
import { uploadMedia, getMediaUrl, getOriginalImageUrl, uploadOriginalImage } from '@/lib/mediaManager';

// localStorage key för draft
// Utkastet måste vara låst till kontot, annars kan nästa inloggade
// användare på samma dator få upp någon annans osparade uppgifter.
const DRAFT_KEY_PREFIX = 'parium_draft_employer-profile';
const LEGACY_DRAFT_KEY = 'parium_draft_employer-profile';
const draftKeyFor = (userId?: string | null) =>
  userId ? `${DRAFT_KEY_PREFIX}_${userId}` : null;

const EmployerProfile = () => {
  const { profile, updateProfile, user, userRole, loading: authLoading } = useAuth();
  const { hasUnsavedChanges, setHasUnsavedChanges, registerAutosaveFlush } = useUnsavedChanges();
  const [loading, setLoading] = useState(false);
  const [originalValues, setOriginalValues] = useState<any>({});
  
  // Image editor states
  const [imageEditorOpen, setImageEditorOpen] = useState(false);
  const [pendingImageSrc, setPendingImageSrc] = useState<string>('');
  const [originalProfileImageFile, setOriginalProfileImageFile] = useState<File | null>(null);
  // Job Wizard pattern: store original URL and storage path separately
  const [originalProfileImageUrl, setOriginalProfileImageUrl] = useState<string>(''); // URL/blob for editor source
  const [originalProfileImageStoragePath, setOriginalProfileImageStoragePath] = useState<string>(''); // Storage path for restore
  const [profileImageIsEdited, setProfileImageIsEdited] = useState(false); // Track if image has been cropped/edited
  const [isEditingExistingProfileImage, setIsEditingExistingProfileImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const didInitRef = useRef(false);

  // Initialize originalProfileImageStoragePath from database when profile loads (Job Wizard pattern)
  // This ensures that existing profile images can be edited from the original source
  useEffect(() => {
    if (profile && profile.profile_image_url && !originalProfileImageStoragePath) {
      // The profile_image_url IS the storage path - store it for restore functionality
      setOriginalProfileImageStoragePath(profile.profile_image_url);
    }
  }, [profile, originalProfileImageStoragePath]);

  // Undo state - spara borttagen bild för återställning
  const [deletedProfileImage, setDeletedProfileImage] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    first_name: profile?.first_name || '',
    last_name: profile?.last_name || '',
    profile_image_url: profile?.profile_image_url || '',
  });
  // Synkron spegel för snabba mobiltryck. React hinner inte alltid rendera om
  // mellan två touch-events, så eventhanterarna får aldrig arbeta på ett gammalt bildvärde.
  const profileImagePathRef = useRef(formData.profile_image_url);
  profileImagePathRef.current = formData.profile_image_url;
  // Sätts före state-uppdateringen så en bakgrundsuppdatering av profilen inte
  // kan lägga tillbaka bilden mellan trycket och autosparningen.
  const localChangesRef = useRef(false);

  // Konvertera storage path till signerad URL för visning
  const profileImageUrl = useMediaUrl(formData.profile_image_url, 'profile-image');

  const draftKey = draftKeyFor(user?.id);

  // När den cachade signerade originallänken slutar gälla
  const signedOriginalExpiresAtRef = useRef(0);

  // Städa bort det gamla kontolösa utkastet en gång, så att det inte kan
  // dyka upp hos nästa användare på samma dator.
  useEffect(() => {
    try { localStorage.removeItem(LEGACY_DRAFT_KEY); } catch { /* ignorera */ }
  }, []);


  // Osparat-läget läses via ref: effekten får bara köras när profilen själv
  // ändras. Tidigare kördes den även när en autosparning nollade osparat-läget
  // och skrev då tillbaka en äldre profil — ångrad bild försvann igen.
  const hasUnsavedChangesRef = useRef(hasUnsavedChanges);
  hasUnsavedChangesRef.current = hasUnsavedChanges;

  // Update form data when profile changes OR restore from localStorage draft
  useEffect(() => {
    if (!profile) return;

    // Viktigt: skriv inte över lokala (osparade) ändringar, annars "kommer bilden tillbaka"
    // om profilen råkar uppdateras i bakgrunden.
    if (didInitRef.current && (hasUnsavedChangesRef.current || localChangesRef.current || savingRef.current)) return;

    // Check for saved draft in localStorage
    const DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
    let savedDraft = null;
    try {
      const stored = draftKey ? localStorage.getItem(draftKey) : null;
      if (stored) {
        const parsed = JSON.parse(stored);
        // Ett gammalt utkast får aldrig skriva över nyare uppgifter från servern
        const savedAt = typeof parsed?.savedAt === 'number' ? parsed.savedAt : 0;
        if (savedAt && Date.now() - savedAt > DRAFT_MAX_AGE_MS) {
          if (draftKey) localStorage.removeItem(draftKey);
        } else {
          // Handle both old format (direct formData) and new format (with savedAt)
          savedDraft = parsed.formData || parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to load draft:', e);
    }

    const values = {
      first_name: profile.first_name || '',
      last_name: profile.last_name || '',
      profile_image_url: profile.profile_image_url || '',
    };

    // If we have a saved draft with different content, use it
    // Profilbilden autosparas och ägs ALLTID av servern. Ett kvarlämnat lokalt
    // utkast (t.ex. mitt i ta bort/ångra) fick tidigare skriva över den sparade
    // bilden när sidan öppnades igen — och autosparningen raderade då bilden.
    if (savedDraft && !didInitRef.current) {
      const draftFirst = typeof savedDraft.first_name === 'string' ? savedDraft.first_name : values.first_name;
      const draftLast = typeof savedDraft.last_name === 'string' ? savedDraft.last_name : values.last_name;
      const hasDraftContent = draftFirst !== values.first_name || draftLast !== values.last_name;

      if (hasDraftContent) {
        const profile_image_url = values.profile_image_url;
        setFormData({ first_name: draftFirst, last_name: draftLast, profile_image_url });
        profileImagePathRef.current = profile_image_url;
        setOriginalValues(values);
        setHasUnsavedChanges(true);
        didInitRef.current = true;
        console.log('📝 Draft restored for employer-profile');
        return;
      }
    }

    setFormData(values);
    profileImagePathRef.current = values.profile_image_url;
    setOriginalValues(values);
    localChangesRef.current = false;
    setHasUnsavedChanges(false);
    didInitRef.current = true;
  }, [profile, setHasUnsavedChanges, draftKey]);

  const checkForChanges = useCallback(() => {
    // Vänta tills profilen är inläst. Tidigare krävdes ett namn i profilen,
    // vilket gjorde att en profil utan namn aldrig kunde spara ens en ny
    // profilbild — Spara-knappen förblev låst.
    if (!didInitRef.current) return false;

    const hasChanges = Object.keys(formData).some(key => {
      return formData[key] !== originalValues[key];
    });

    localChangesRef.current = hasChanges;
    setHasUnsavedChanges(hasChanges);
    return hasChanges;
  }, [originalValues, formData, setHasUnsavedChanges]);

  // Senaste formulärvärden — används efter asynkron sparning.
  const formDataRef = useRef(formData);
  formDataRef.current = formData;

  // Check for changes whenever form values change + auto-save to localStorage
  useEffect(() => {
    const hasChanges = checkForChanges();
    
    // Auto-save draft to localStorage when there are changes
    if (hasChanges && draftKey) {
      try {
        localStorage.setItem(draftKey, JSON.stringify({
          formData,
          savedAt: Date.now()
        }));
      } catch (e) {
        console.warn('Failed to save draft:', e);
      }
    }
  }, [checkForChanges, formData, draftKey]);

  // Ingen egen lämna-varning: sidan autosparar och sparar direkt vid avfärd
  // (utkastet ligger dessutom kvar lokalt om fliken stängs mitt i).

  // Hantera bildval och öppna editor
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Stoppa för stora filer innan de laddas in i redigeraren — annars
    // laddas hela bilden i minnet och uppladdningen nekas först efteråt.
    const MAX_IMAGE_BYTES = 50 * 1024 * 1024;
    if (file.size > MAX_IMAGE_BYTES) {
      toast({
        title: "Bilden är för stor",
        description: "Välj en bild som är mindre än 50 MB.",
        variant: "destructive"
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (file.type.startsWith('image/')) {
      // Store original file for future edits (Job Wizard pattern)
      setOriginalProfileImageFile(file);
      const imageUrl = URL.createObjectURL(file);
      // Store the original blob URL - this will be our original for editing
      setOriginalProfileImageUrl(imageUrl);
      setOriginalProfileImageStoragePath(''); // New file, no storage path yet
      setPendingImageSrc(imageUrl);
      setIsEditingExistingProfileImage(false);
      setImageEditorOpen(true);
      setProfileImageIsEdited(false); // Fresh image, not edited yet
    } else {
      toast({
        title: "Fel filtyp",
        description: "Vänligen välj en bildfil (JPG, PNG eller WebP).",
        variant: "destructive"
      });
    }
    
    // Reset input så samma fil kan väljas igen
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Redigera befintlig bild - ALLTID använd originalet om det finns
  const handleEditExistingImage = async () => {
    // Job Wizard pattern: ALWAYS prioritize originalProfileImageUrl for editing from the original source
    // This prevents quality loss from double-cropping
    
    // Priority 1: Use stored original URL from current session.
    // Signerade länkar gäller i en timme — en gammal länk ger en tom
    // redigerare, så den hämtas om i stället.
    const cachedIsUsable =
      originalProfileImageUrl.startsWith('blob:') ||
      (!!originalProfileImageUrl && Date.now() < signedOriginalExpiresAtRef.current);
    if (cachedIsUsable && originalProfileImageFile) {
      setPendingImageSrc(originalProfileImageUrl);
      setIsEditingExistingProfileImage(true);
      setImageEditorOpen(true);
      return;
    }

    // Guidens och profilsidans nya beskärningar har originalet bredvid visningsbilden.
    if (formData.profile_image_url) {
      const pairedOriginal = await getOriginalImageUrl(formData.profile_image_url, 'profile-image', 3600);
      if (pairedOriginal) {
        signedOriginalExpiresAtRef.current = Date.now() + 55 * 60 * 1000;
        setOriginalProfileImageUrl(pairedOriginal);
        setPendingImageSrc(pairedOriginal);
        setIsEditingExistingProfileImage(true);
        setImageEditorOpen(true);
        return;
      }
    }

    if (cachedIsUsable) {
      setPendingImageSrc(originalProfileImageUrl);
      setIsEditingExistingProfileImage(true);
      setImageEditorOpen(true);
      return;
    }

    // Priority 2: Fetch from stored original storage path
    if (originalProfileImageStoragePath) {
      try {
        const signedUrl = await getMediaUrl(originalProfileImageStoragePath, 'profile-image', 3600);
        if (signedUrl) {
          // Cache for future edits in the same session (Job Wizard pattern)
          signedOriginalExpiresAtRef.current = Date.now() + 55 * 60 * 1000;
          setOriginalProfileImageUrl(signedUrl);
          setPendingImageSrc(signedUrl);
          setIsEditingExistingProfileImage(true);
          setImageEditorOpen(true);
          return;
        }
      } catch (error) {
        console.error('Error loading original image:', error);
      }
    }

    // Priority 3: Fallback - fetch current cropped image (least preferred)
    if (formData.profile_image_url) {
      try {
        const signedUrl = await getMediaUrl(formData.profile_image_url, 'profile-image', 3600);
        if (signedUrl) {
          // This becomes our "original" if we don't have a better one (Job Wizard pattern)
          signedOriginalExpiresAtRef.current = Date.now() + 55 * 60 * 1000;
          setOriginalProfileImageUrl(signedUrl);
          setOriginalProfileImageStoragePath(formData.profile_image_url);
          setPendingImageSrc(signedUrl);
          setIsEditingExistingProfileImage(true);
          setImageEditorOpen(true);
          return;
        }
      } catch (error) {
        console.error('Error loading image for editing:', error);
      }
    }

    // Inget kunde hämtas — säg det i stället för att inget händer
    toast({
      title: "Kunde inte ladda bilden",
      description: "Försök ladda upp en ny bild istället.",
      variant: "destructive"
    });
  };

  // Spara redigerad bild
  const handleProfileImageSave = async (editedBlob: Blob) => {
    try {
      if (!user?.id) throw new Error('User not authenticated');

      // Skapa File från Blob
      const editedFile = new File([editedBlob], 'profile-image.webp', { type: 'image/webp' });

      // Ladda upp redigerad bild via mediaManager
      const { storagePath, error: uploadError } = await uploadMedia(
        editedFile,
        'profile-image',
        user.id
      );

      if (uploadError || !storagePath) throw uploadError || new Error('Upload failed');

      // Behåll samma obeskurna källa per bild även när guiden redan är avslutad.
      const originalSource = originalProfileImageFile ?? (pendingImageSrc
        ? await fetch(pendingImageSrc).then(response => {
            if (!response.ok) throw new Error('Originalbilden kunde inte hämtas');
            return response.blob();
          })
        : null);
      if (originalSource && !await uploadOriginalImage(storagePath, originalSource, 'profile-image')) {
        throw new Error('Originalbilden kunde inte sparas');
      }

      // Upload original file if we have a new file (not already saved) - Job Wizard pattern
      if (originalProfileImageFile && !originalProfileImageStoragePath) {
        try {
          const fileExt = originalProfileImageFile.name.split('.').pop() || 'jpg';
          const timestamp = Date.now();
          const originalFileName = `${user.id}/original-${timestamp}.${fileExt}`;

          // 🚀 Resilient upload med retry + exponential backoff
          const { uploadWithRetry } = await import('@/lib/uploadWithProgress');
          await uploadWithRetry({
            bucket: 'job-applications',
            path: originalFileName,
            file: originalProfileImageFile,
            contentType: originalProfileImageFile.type,
            cacheControl: '31536000',
            upsert: true,
          });
          setOriginalProfileImageStoragePath(originalFileName);
          // Keep originalProfileImageUrl (blob) for session-based edits
        } catch (origErr) {
          console.error('Failed to save original image:', origErr);
          toast({
            title: "Bilden sparades",
            description: "Originalbilden kunde inte sparas, så du kan inte beskära om den senare.",
          });
        }
      }

      // Uppdatera formData
      profileImagePathRef.current = storagePath;
      localChangesRef.current = true;
      setFormData(prev => ({ ...prev, profile_image_url: storagePath }));
      setDeletedProfileImage(null); // Rensa undo-state
      setHasUnsavedChanges(true);
      setProfileImageIsEdited(true); // Mark as edited/cropped
      
      setImageEditorOpen(false);
      // Frigör bara om länken inte fortfarande används som original för
      // "Anpassa din bild" — annars blir originalet en död länk.
      if (pendingImageSrc.startsWith('blob:') && pendingImageSrc !== originalProfileImageUrl) {
        URL.revokeObjectURL(pendingImageSrc);
        blobUrlsRef.current.delete(pendingImageSrc);
      }
      setPendingImageSrc('');

    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Fel vid uppladdning",
        description: "Kunde inte ladda upp profilbilden.",
        variant: "destructive"
      });
    }
  };

  // Restore original profile image - Job Wizard pattern
  const handleRestoreOriginal = async () => {
    if (!originalProfileImageStoragePath && !originalProfileImageUrl) {
      console.log('No original image to restore');
      return;
    }
    
    // If we have original storage path, restore to that
    if (originalProfileImageStoragePath) {
      setFormData(prev => ({ ...prev, profile_image_url: originalProfileImageStoragePath }));
      setProfileImageIsEdited(false);
    }
  };

  // Ta bort profilbild
  const handleRemoveProfileImage = () => {
    // Ignorera ett andra touch-event som hann köas före nästa render.
    const currentImage = profileImagePathRef.current;
    if (!currentImage) return;

    profileImagePathRef.current = '';
    localChangesRef.current = true;
    setDeletedProfileImage(currentImage);
    
    setFormData(prev => ({ ...prev, profile_image_url: '' }));
    setOriginalProfileImageFile(null);
    setOriginalProfileImageUrl('');
    setOriginalProfileImageStoragePath('');
    setProfileImageIsEdited(false);
    setHasUnsavedChanges(true);
  };

  // Återställ borttagen profilbild
  const restoreProfileImage = () => {
    if (!deletedProfileImage || profileImagePathRef.current) return;
    
    profileImagePathRef.current = deletedProfileImage;
    localChangesRef.current = true;
    setFormData(prev => ({ ...prev, profile_image_url: deletedProfileImage }));
    setOriginalProfileImageStoragePath(prev => prev || deletedProfileImage);
    setDeletedProfileImage(null);
    setHasUnsavedChanges(true);
  };

  // Reset form to original values when user confirms leaving without saving
  useEffect(() => {
    const onUnsavedConfirm = () => {
      if (!originalValues) return;
      setFormData({ ...originalValues });
      profileImagePathRef.current = originalValues.profile_image_url || '';
      localChangesRef.current = false;
      // IMPORTANT: user chose to discard changes -> clear local draft as well
      try {
        draftKey && localStorage.removeItem(draftKey);
      } catch {}
      setHasUnsavedChanges(false);
    };
    window.addEventListener('unsaved-confirm', onUnsavedConfirm as EventListener);
    return () => window.removeEventListener('unsaved-confirm', onUnsavedConfirm as EventListener);
  }, [originalValues, setHasUnsavedChanges]);

  // Släpp blob-URL:er när sidan lämnas så att minnet inte växer
  const blobUrlsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (pendingImageSrc.startsWith('blob:')) blobUrlsRef.current.add(pendingImageSrc);
  }, [pendingImageSrc]);
  useEffect(() => {
    if (originalProfileImageUrl.startsWith('blob:')) blobUrlsRef.current.add(originalProfileImageUrl);
  }, [originalProfileImageUrl]);
  useEffect(() => {
    const urls = blobUrlsRef.current;
    return () => {
      urls.forEach((url) => {
        try { URL.revokeObjectURL(url); } catch { /* ignorera */ }
      });
      urls.clear();
    };
  }, []);

  const { isOnline, showOfflineToast } = useOnline();

  const savingRef = useRef(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSave = async (opts?: { silent?: boolean }): Promise<boolean> => {
    const silent = !!opts?.silent;
    // Dubbelklickspärr: två parallella sparningar får inte skickas
    if (savingRef.current) return false;
    if (!isOnline) {
      if (!silent) showOfflineToast();
      setSaveError('Ingen anslutning. Ändringen sparas när du är online igen.');
      return false;
    }
    savingRef.current = true;
    try {
      setLoading(true);
      // updateProfile kastar inte vid DB-fel — den returnerar { error }.
      // Utan den här kontrollen visades "Profil uppdaterad" och utkastet
      // rensades även när databasen nekade skrivningen.
      // Läs det senaste formulärläget när sparningen faktiskt startar. Det gör
      // att ett snabbt ta bort/ångra/ta bort aldrig kan spara ett äldre mellanläge.
      const valuesToSave = { ...formDataRef.current };
      const result = await updateProfile(valuesToSave as any);
      if (result?.error) {
        // updateProfile visar redan en svensk feltoast. Behåll utkastet
        // och osparat-läget så att ändringen inte går förlorad.
        setSaveError('Kunde inte spara ändringen. Försök igen.');
        return false;
      }

      const updatedValues = valuesToSave;

      // Skriv aldrig tillbaka den sparade ögonblicksbilden i formuläret —
      // användaren kan ha fortsatt skriva/radera medan sparningen pågick.
      // Endast jämförelsebasen flyttas; osparat-läget räknas om automatiskt.
      setOriginalValues(updatedValues);
      
      try {
        const stillSame = JSON.stringify(formDataRef.current) === JSON.stringify(updatedValues);
        localChangesRef.current = !stillSame;
        if (stillSame && draftKey) localStorage.removeItem(draftKey);
      } catch (e) {
        console.warn('Failed to clear draft:', e);
      }

      setSaveError(null);
      if (!silent) {
        toast({
          title: "Profil uppdaterad",
          description: "Din profil har uppdaterats.",
          route: '/profile'
        });
      }
      return true;
    } catch (error) {
      if (!silent) {
        toast({
          title: "Fel",
          description: "Kunde inte uppdatera profilen.",
          variant: "destructive"
        });
      }
      setSaveError('Kunde inte spara ändringen. Försök igen.');
      return false;
    } finally {
      savingRef.current = false;
      setLoading(false);
    }
  };

  // 🔄 Autospar: profilen sparas direkt, precis som företagsprofilen.
  // Ingen notis visas vid lyckad sparning — bara en diskret "Sparat"-indikator.
  const saveRef = useRef(handleSave);
  saveRef.current = handleSave;
  // Autosparande sida: lämnar man före debounce-fönstret skrivs ändringen
  // ned direkt — därför visas aldrig någon "Osparade ändringar"-dialog här.
  const hasUnsavedFlushRef = useRef(hasUnsavedChanges);
  hasUnsavedFlushRef.current = hasUnsavedChanges;
  // Registreras bara medan sidan faktiskt visas — sidan ligger kvar i minnet
  // (KeepAlive) och får aldrig ta över en annan sidas sparning.
  const flushPathname = useLocation().pathname;
  const flushActive = flushPathname === '/employer-profile';
  useEffect(() => {
    if (!flushActive) return;
    return registerAutosaveFlush(() => {
      if (!hasUnsavedFlushRef.current) return;
      void saveRef.current({ silent: true });
    });
  }, [registerAutosaveFlush, flushActive]);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  // Sidan ligger kvar i minnet (KeepAlive) när man navigerar bort — nollställ
  // "Sparat" vid avnavigering så bekräftelsen aldrig ligger kvar missvisande
  // när användaren kommer tillbaka.
  const location = useLocation();
  useEffect(() => {
    if (location.pathname !== '/employer-profile') setSaveStatus('idle');
  }, [location.pathname]);
  // Skydd mot omförsöksloop: samma misslyckade data sparas inte om och om igen,
  // men signaturen nollställs när användaren kommer online eller trycker "Försök igen".
  const [failedSignature, setFailedSignature] = useState<string | null>(null);
  // När nätet kommer tillbaka ska den blockerade ändringen sparas automatiskt.
  useEffect(() => {
    if (isOnline) setFailedSignature(null);
  }, [isOnline]);
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    if (loading) return;
    const signature = JSON.stringify(formData);
    if (failedSignature === signature) return;
    const t = setTimeout(async () => {
      setSaveStatus('saving');
      try {
        const ok = await saveRef.current({ silent: true });
        if (ok) {
          setFailedSignature(null);
          // "Sparat" ligger kvar tills användaren lämnar sidan — ingen
          // automatisk dold, så bekräftelsen syns även när man står långt ner.
          setSaveStatus('saved');
        } else {
          setFailedSignature(signature);
          setSaveStatus('error');
        }
      } catch {
        setFailedSignature(signature);
        setSaveStatus('error');
      }
    }, 900);
    return () => clearTimeout(t);
  }, [hasUnsavedChanges, loading, formData, failedSignature, isOnline]);

  // Manuell återförsöksväg så en ändring aldrig kan gå förlorad tyst.
  const retrySave = useCallback(() => {
    setFailedSignature(null);
    setSaveStatus('idle');
  }, []);

  // Kallstart: visa innehållsformat skelett istället för tomma fält.
  if (authLoading && !profile) {
    return <ProfileFormSkeleton variant="employer" />;
  }

  return (
     <div className="space-y-8 responsive-container [padding-bottom:calc(env(safe-area-inset-bottom,0px)+50px)]">
      <div className="text-center mb-6">
        <h1 className="text-xl md:text-2xl font-semibold text-white tracking-tight">Min Profil</h1>
      </div>

      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-6 md:p-4">
        <form onSubmit={(e) => { e.preventDefault(); }} className="space-y-5 md:space-y-3">
            {/* Profilbild-sektion - matchar jobbsökarsidans stil */}
            <div className="flex flex-col items-center gap-4 pb-5 border-b border-white/10">
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
                onChange={handleImageChange}
                className="hidden"
              />
              
              {/* Rubrik */}
              <h3 className="text-base font-semibold text-white text-center">
                Profilbild
              </h3>
              <p className="text-white text-center text-sm -mt-2">
                Ladda upp en profilbild som syns för kandidater.
              </p>
              
              
              {/* Avatar med klickbar uppladdning och soptunna */}
              <div className="relative">
                <div 
                  className="cursor-pointer" 
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Avatar key={formData.profile_image_url || 'no-profile-image'} className="h-32 w-32 border-4 border-white/10">
                    <AvatarImage 
                      src={profileImageUrl || ''} 
                      alt="Profilbild" 
                      className="object-cover"
                    />
                    <AvatarFallback className="text-4xl font-semibold bg-white/20 text-white" delayMs={150}>
                      {(formData.first_name?.trim()?.[0]?.toUpperCase() || '') + (formData.last_name?.trim()?.[0]?.toUpperCase() || '') || '?'}
                    </AvatarFallback>
                  </Avatar>
                </div>

                {/* Soptunna/Undo-knapp som på jobbsökarsidan.
                    Styrs av det sparade värdet (inte av att bilden hunnit laddas),
                    så att man kan växla fram och tillbaka hur snabbt som helst. */}
                {deletedProfileImage && !formData.profile_image_url ? (
                  <button
                    type="button"
                    aria-label="Återställ profilbild"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      restoreProfileImage();
                    }}
                    className="absolute -top-3 -right-3 z-20 pointer-events-auto bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white rounded-full p-2 shadow-lg transition-colors"
                    title="Återställ profilbild"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                ) : formData.profile_image_url ? (
                  <button
                    type="button"
                    aria-label="Ta bort profilbild"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleRemoveProfileImage();
                    }}
                    className="absolute -top-3 -right-3 z-20 pointer-events-auto rounded-full border border-0 bg-red-500/80 p-2 text-white shadow-lg transition-colors md:hover:!bg-red-500 md:hover:!text-white"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                ) : null}
              </div>

              {/* Text och knappar under avataren */}
              <div className="space-y-2 text-center">
                <label 
                  htmlFor="profile-image-employer" 
                  className="text-white cursor-pointer hover:text-white transition-colors text-center text-sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Klicka för att ladda upp • Max 50 MB
                </label>
                
                {/* Anpassa din bild-knapp om bild finns */}
                {profileImageUrl && (
                  <div className="flex flex-col items-center space-y-2">
                    <Badge variant="outline" className="bg-white/20 text-white border-white/20 px-3 py-1 rounded-full">
                      Bild uppladdad!
                    </Badge>
                    <button 
                      type="button"
                      onClick={handleEditExistingImage}
                      className="bg-white/5 backdrop-blur-sm border border-white/10 text-white hover:bg-white/10 hover:border-white/50 px-4 py-1.5 text-sm font-medium rounded-full transition-colors"
                    >
                      Anpassa din bild
                    </button>
                  </div>
                )}

                {/* Sparstatus under "Anpassa din bild" */}
                <div className="min-h-4 pt-1 text-center text-xs text-white" aria-live="polite" role="status">
                  {saveStatus === 'error' ? (
                    <span className="inline-flex flex-wrap items-center justify-center gap-1.5 text-destructive">
                      <AlertCircle className="h-3 w-3" aria-hidden="true" />
                      {saveError || 'Kunde inte spara ändringen.'}
                      <button
                        type="button"
                        onClick={retrySave}
                        className="underline underline-offset-2 text-white"
                      >
                        Försök igen
                      </button>
                    </span>
                  ) : (
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
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="first_name" className="text-sm text-white">Förnamn</Label>
                <Input
                  id="first_name"
                  value={formData.first_name}
                  onChange={(e) => setFormData({...formData, first_name: e.target.value})}
                  className="bg-white/5 border-white/10 hover:border-white/50 text-white placeholder:text-white h-11 !min-h-0 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="last_name" className="text-sm text-white">Efternamn</Label>
                <Input
                  id="last_name"
                  value={formData.last_name}
                  onChange={(e) => setFormData({...formData, last_name: e.target.value})}
                  className="bg-white/5 border-white/10 hover:border-white/50 text-white placeholder:text-white h-11 !min-h-0 text-sm"
                />
              </div>
            </div>
            
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm text-white">E-post</Label>
              <Input
                id="email"
                value={user?.email || ''}
                readOnly
                className="bg-white/5 border-white/10 text-white h-11 !min-h-0 text-sm cursor-not-allowed"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="role" className="text-sm text-white">Roll</Label>
              <Input
                id="role"
                value={userRole?.role === 'employer' ? 'Admin' : 'Jobbsökare'}
                readOnly
                className="bg-white/5 border-white/10 text-white h-11 !min-h-0 text-sm cursor-not-allowed"
              />
            </div>

          </form>
      </div>


      {/* Image Editor */}
      <ImageEditor
        isOpen={imageEditorOpen}
        onClose={() => {
          setImageEditorOpen(false);
          setIsEditingExistingProfileImage(false);
          if (pendingImageSrc.startsWith('blob:') && pendingImageSrc !== originalProfileImageUrl) {
            URL.revokeObjectURL(pendingImageSrc);
            blobUrlsRef.current.delete(pendingImageSrc);
          }
          setPendingImageSrc('');
        }}
        imageSrc={pendingImageSrc}
        onSave={handleProfileImageSave}
        onRestoreOriginal={isEditingExistingProfileImage && originalProfileImageStoragePath ? handleRestoreOriginal : undefined}
       aspectRatio={1}
        isCircular={true}
      />
    </div>
  );
};

export default EmployerProfile;
