import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useOrgDefaultVideoLink } from '@/hooks/useOrgDefaultVideoLink';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import ImageEditor from '@/components/ImageEditor';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Upload, CheckCircle, ArrowRight, ArrowLeft, Trash2, Video, AlertCircle, CheckCircle2, MessageSquare, Sparkles, Building2, UserRound, Bell } from 'lucide-react';
import { createSignedUrl } from '@/utils/storageUtils';
import { useOnline } from '@/hooks/useOnlineStatus';
import { normalizeMeetingLink } from '@/lib/meetingLink';
import { isValidMeetingLink } from '@/pages/employer/companyProfile/meetingLinkValidation';
import { fetchPriority } from '@/lib/fetchPriority';
import { TEXT_LIMITS } from '@/lib/textLimits';
import { SWEDISH_INDUSTRIES, EMPLOYEE_COUNT_OPTIONS } from '@/lib/industries';
import AuthSelectField from '@/components/auth/AuthSelectField';
import { useNotificationPreferences, type NotificationChannel, type NotificationType } from '@/hooks/useNotificationPreferences';
import NotificationPreferencesPanel, { type NotificationRow } from '@/components/notifications/NotificationPreferencesPanel';
import { useEmailSubscription } from '@/hooks/useEmailSubscription';
import { isTunnelReplayAccount } from '@/lib/tunnelTestAccounts';
import { useMediaUrl } from '@/hooks/useMediaUrl';

const notificationRows: NotificationRow[] = [
  { type: 'new_application', label: 'Nya ansökningar', description: 'Mejl skickas högst en gång per dag.', channels: ['in_app', 'push', 'email'] },
  { type: 'new_message', label: 'Meddelanden', description: 'Nya meddelanden från kandidater.', channels: ['in_app', 'push', 'email'] },
  { type: 'interview_scheduled', label: 'Intervjuer', description: 'Bokningar och ändringar är alltid på.', channels: ['in_app', 'push', 'email'], locked: ['in_app', 'push', 'email'] },
  { type: 'interview_response', label: 'Kandidatens svar', description: 'När kandidaten tackar ja eller nej.', channels: ['in_app', 'push', 'email'] },
];

const EMPLOYER_WELCOME_DRAFT_PREFIX = 'parium_draft_employer-welcome-tunnel';
const LEGACY_EMPLOYER_WELCOME_DRAFT_KEY = 'parium_draft_employer-welcome-tunnel';

/** Kontoskopad nyckel – samma modell som jobbsökarens välkomsttunnel. */
const employerDraftKey = (uid?: string | null) =>
  `${EMPLOYER_WELCOME_DRAFT_PREFIX}:${uid ?? 'anon'}`;

// Clear draft helper (exported for use elsewhere if needed)
export const clearEmployerWelcomeDraft = (uid?: string | null) => {
  try {
    sessionStorage.removeItem(employerDraftKey(uid));
    // Rensa även äldre, okontoskopade utkast så inget läcker mellan konton.
    localStorage.removeItem(LEGACY_EMPLOYER_WELCOME_DRAFT_KEY);
    console.log('💾 Employer welcome tunnel draft cleared');
  } catch (e) {
    console.warn('Failed to clear employer welcome tunnel draft');
  }
};


interface EmployerWelcomeTunnelProps {
  onComplete: () => void;
}

const EmployerWelcomeTunnel = ({ onComplete }: EmployerWelcomeTunnelProps) => {
  const { profile, updateProfile, user } = useAuth();
  const orgDefaultVideoLink = useOrgDefaultVideoLink();
  const { toast } = useToast();
  const { isEnabled: notificationEnabled, isLoading: notificationsLoading } = useNotificationPreferences();
  const { subscribed: emailSubscribed, isKnown: emailKnown } = useEmailSubscription();
  const isReplay = isTunnelReplayAccount(user?.email);
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [logoProgress, setLogoProgress] = useState(0);
  const [draftRestored, setDraftRestored] = useState(false);
  
  // Image editor states
  const [imageEditorOpen, setImageEditorOpen] = useState(false);
  const [pendingImageSrc, setPendingImageSrc] = useState<string>('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [profileImageSrc, setProfileImageSrc] = useState('');
  const [notificationDraft, setNotificationDraft] = useState<Partial<Record<`${NotificationType}:${NotificationChannel}`, boolean>>>({});


  // Form data
  const [formData, setFormData] = useState({
    companyLogoUrl: (profile as any)?.company_logo_url || '',
    interviewVideoLink: (profile as any)?.interview_video_link || '',
    interviewVideoDefaultMessage: (profile as any)?.interview_video_default_message || '',
    interviewOfficeDefaultMessage: (profile as any)?.interview_default_message || '',
    companyName: profile?.company_name || '',
    industry: profile?.industry || '',
    employeeCount: profile?.employee_count || '',
    address: profile?.address || '',
    website: (profile as any)?.website || '',
    companyDescription: profile?.company_description || '',
    firstName: profile?.first_name || '',
    lastName: profile?.last_name || '',
    profileImageUrl: profile?.profile_image_url || '',
  });
  const existingProfileImage = useMediaUrl(formData.profileImageUrl, 'profile-image');

  const draftKey = employerDraftKey(user?.id);

  // Restore draft on mount (kontoskopad sessionStorage – överlever reload, dör med fliken)
  useEffect(() => {
    if (!draftRestored) {
      try {
        // Migrera/rensa bort äldre okontoskopade utkast i localStorage
        try { localStorage.removeItem(LEGACY_EMPLOYER_WELCOME_DRAFT_KEY); } catch { /* noop */ }
        const saved = sessionStorage.getItem(draftKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.formData) {
            setFormData((prev) => ({ ...prev, ...parsed.formData, companyLogoUrl: isReplay ? prev.companyLogoUrl : parsed.formData.companyLogoUrl ?? prev.companyLogoUrl, profileImageUrl: isReplay ? prev.profileImageUrl : parsed.formData.profileImageUrl ?? prev.profileImageUrl }));
          }
          if (parsed.notificationDraft) setNotificationDraft(parsed.notificationDraft);
          if (typeof parsed.currentStep === 'number') {
            setCurrentStep(Math.min(Math.max(parsed.currentStep, 0), 7));
          }
          console.log('💾 Employer welcome tunnel draft restored');
        }
      } catch (e) {
        console.warn('Failed to restore employer welcome tunnel draft');
      }
      setDraftRestored(true);
    }
  }, [draftRestored, draftKey, isReplay]);

  // Förifyll med uppgifterna från registreringen så fort profilen hinner
  // laddas (den är asynkron och kommer ofta efter första renderingen).
  // Bara tomma fält fylls – användarens egna ändringar och återställt
  // utkast skrivs aldrig över.
  const profilePrefillRef = useRef(false);
  useEffect(() => {
    if (!draftRestored || !profile || profilePrefillRef.current) return;
    profilePrefillRef.current = true;
    const p = profile as any;
    setFormData((prev) => ({
      ...prev,
      companyLogoUrl: prev.companyLogoUrl || p.company_logo_url || '',
      interviewVideoLink: prev.interviewVideoLink || p.interview_video_link || '',
      interviewVideoDefaultMessage: prev.interviewVideoDefaultMessage || p.interview_video_default_message || '',
      interviewOfficeDefaultMessage: prev.interviewOfficeDefaultMessage || p.interview_default_message || '',
      companyName: prev.companyName || p.company_name || '',
      industry: prev.industry || p.industry || '',
      employeeCount: prev.employeeCount || p.employee_count || '',
      address: prev.address || p.address || '',
      website: prev.website || p.website || '',
      companyDescription: prev.companyDescription || p.company_description || '',
      firstName: prev.firstName || p.first_name || '',
      lastName: prev.lastName || p.last_name || '',
      profileImageUrl: prev.profileImageUrl || p.profile_image_url || '',
    }));
  }, [draftRestored, profile]);

  // Ärv organisationens möteslänk – en inbjuden kollega får företagets
  // befintliga standardlänk förifylld (kan alltid ändras).
  const orgLinkAppliedRef = useRef(false);
  useEffect(() => {
    if (!draftRestored || orgLinkAppliedRef.current) return;
    if (!orgDefaultVideoLink) return;
    setFormData((prev) => {
      if (prev.interviewVideoLink) return prev;
      orgLinkAppliedRef.current = true;
      return { ...prev, interviewVideoLink: orgDefaultVideoLink };
    });
  }, [draftRestored, orgDefaultVideoLink]);

  // Auto-save draft
  useEffect(() => {
    if (!draftRestored) return;
    
    // Check if there's any content to save
    const hasContent = formData.companyLogoUrl || formData.interviewVideoLink
      || formData.interviewVideoDefaultMessage || formData.interviewOfficeDefaultMessage
      || formData.companyName || formData.firstName || Object.keys(notificationDraft).length > 0
      || currentStep > 0;
    
    if (hasContent) {
      try {
        sessionStorage.setItem(draftKey, JSON.stringify({
          formData: isReplay ? { ...formData, companyLogoUrl: profile?.company_logo_url || '', profileImageUrl: profile?.profile_image_url || '' } : formData,
          notificationDraft,
          currentStep,
          savedAt: Date.now()
        }));
      } catch (e) {
        console.warn('Failed to save employer welcome tunnel draft');
      }
    }
  }, [formData, notificationDraft, currentStep, draftRestored, draftKey, isReplay, profile?.company_logo_url, profile?.profile_image_url]);

  useEffect(() => () => { if (profileImageSrc.startsWith('blob:')) URL.revokeObjectURL(profileImageSrc); }, [profileImageSrc]);
  useEffect(() => () => { if (formData.companyLogoUrl.startsWith('blob:')) URL.revokeObjectURL(formData.companyLogoUrl); }, [formData.companyLogoUrl]);


  const totalSteps = 8; // Intro, företag, logga, profil, möteslänk, meddelanden, aviseringar, klart

  // Långa steg kan skrollas på mobil. Börja nästa steg från toppen, inte
  // mitt i det nya formuläret där samma skrollposition råkade ligga kvar.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [currentStep]);

  const handleNext = () => {
    if (currentStep === 1 && !formData.companyName.trim()) {
      toast({ title: 'Ange företagets namn', variant: 'destructive' });
      return;
    }
    if (currentStep === 4 && formData.interviewVideoLink.trim() && !isValidMeetingLink(formData.interviewVideoLink)) {
      toast({ title: 'Kontrollera möteslänken eller lämna fältet tomt', variant: 'destructive' });
      return;
    }
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const MAX_LOGO_MB = 10;
  const ALLOWED_LOGO_TYPES = [
    'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
    'image/gif', 'image/heic', 'image/heif', 'image/avif',
  ];

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Tillåt att samma fil väljas igen efter ett fel
    e.target.value = '';
    if (!file) return;

    setUploadError(null);

    if (!file.type.startsWith('image/') || !ALLOWED_LOGO_TYPES.includes(file.type)) {
      setUploadError('Filformatet stöds inte. Använd PNG, JPG, WEBP, GIF eller HEIC.');
      return;
    }

    if (file.size > MAX_LOGO_MB * 1024 * 1024) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
      setUploadError(`Bilden är ${sizeMb} MB – max ${MAX_LOGO_MB} MB. Välj en mindre bild.`);
      return;
    }

    // Städa upp ev. tidigare blob-URL innan en ny skapas
    if (pendingImageSrc) URL.revokeObjectURL(pendingImageSrc);
    const imageUrl = URL.createObjectURL(file);
    setPendingImageSrc(imageUrl);
    setImageEditorOpen(true);
  };

  const handleLogoSave = async (editedBlob: Blob) => {
    // Stäng dialogen direkt så användaren ser loading-state
    setImageEditorOpen(false);
    if (pendingImageSrc) URL.revokeObjectURL(pendingImageSrc);
    setPendingImageSrc('');
    setUploadError(null);
    if (isReplay) {
      setFormData(prev => ({ ...prev, companyLogoUrl: URL.createObjectURL(editedBlob) }));
      return;
    }
    setIsUploadingLogo(true);

    
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) throw new Error('User not authenticated');

      const { compressImageBlob } = await import('@/lib/imageUploadOptimization');
      const { uploadWithRetry } = await import('@/lib/uploadWithProgress');
      const optimizedBlob = await compressImageBlob(editedBlob, { maxDimension: 1024, quality: 0.9 });
      const fileExt = optimizedBlob.type === 'image/webp' ? 'webp' : 'png';
      const fileName = `${user.data.user.id}/${Date.now()}-company-logo.${fileExt}`;

      // 🚀 Resilient upload med retry + exponential backoff + progress
      await uploadWithRetry({
        bucket: 'company-logos',
        path: fileName,
        file: optimizedBlob,
        contentType: optimizedBlob.type,
        cacheControl: '31536000',
        upsert: true,
        onProgress: (p) => setLogoProgress(p.percent),
      });
      setLogoProgress(100);

      // Use public URL for company logos (no expiration)
      const { data: { publicUrl } } = supabase.storage
        .from('company-logos')
        .getPublicUrl(fileName);

      const logoUrl = `${publicUrl}?t=${Date.now()}`;
      
      // Preload i bakgrunden utan att vänta (non-blocking)
      import('@/lib/serviceWorkerManager').then(({ preloadSingleFile }) => {
        preloadSingleFile(logoUrl);
      });
      
      setFormData(prev => ({ ...prev, companyLogoUrl: logoUrl }));
      
      toast({
        title: "Logga uppladdad!",
        description: "Din företagslogga har uppdaterats."
      });
    } catch (error) {
      console.error('Logo upload error:', error);
      setUploadError('Kunde inte ladda upp loggan. Kontrollera din anslutning och försök igen.');
      toast({
        title: "Fel vid uppladdning",
        description: "Kunde inte ladda upp loggan.",
        variant: "destructive"
      });

    } finally {
      setIsUploadingLogo(false);
      setLogoProgress(0);
    }
  };

  const { isOnline, showOfflineToast } = useOnline();

  const handleProfileImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!ALLOWED_LOGO_TYPES.includes(file.type) || file.size > MAX_LOGO_MB * 1024 * 1024) {
      toast({ title: 'Välj en bild under 10 MB i ett format som stöds', variant: 'destructive' });
      return;
    }
    if (isReplay) {
      setProfileImageSrc(URL.createObjectURL(file));
      return;
    }
    setIsUploadingLogo(true);
    try {
      if (!user?.id) throw new Error('Ingen användare');
      const { uploadMedia } = await import('@/lib/mediaManager');
      const { storagePath, error } = await uploadMedia(file, 'profile-image', user.id);
      if (error || !storagePath) throw error || new Error('Uppladdning misslyckades');
      setFormData(prev => ({ ...prev, profileImageUrl: storagePath }));
      const { getMediaUrl } = await import('@/lib/mediaManager');
      setProfileImageSrc((await getMediaUrl(storagePath, 'profile-image')) || '');
    } catch {
      toast({ title: 'Kunde inte ladda upp profilbilden', variant: 'destructive' });
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const notificationValue = (type: NotificationType, channel: NotificationChannel) =>
    notificationDraft[`${type}:${channel}`] ?? notificationEnabled(type, channel);

  const handleSubmit = async () => {
    if (isReplay) {
      clearEmployerWelcomeDraft(user?.id);
      onComplete();
      return;
    }
    setIsSubmitting(true);
    try {
      if (!formData.companyName.trim()) {
        toast({ title: 'Ange företagets namn', variant: 'destructive' });
        setCurrentStep(1);
        return;
      }
      if (formData.interviewVideoLink.trim() && !isValidMeetingLink(formData.interviewVideoLink)) throw new Error('Ogiltig möteslänk');
      const result = await updateProfile({
        ...(formData.companyLogoUrl !== (profile?.company_logo_url || '') ? { company_logo_url: formData.companyLogoUrl } : {}),
        interview_video_link: formData.interviewVideoLink
          ? normalizeMeetingLink(formData.interviewVideoLink)
          : '',
        interview_video_default_message: formData.interviewVideoDefaultMessage.trim(),
        interview_default_message: formData.interviewOfficeDefaultMessage.trim(),
        company_name: formData.companyName.trim(),
        industry: formData.industry.trim(),
        employee_count: formData.employeeCount,
        address: formData.address.trim(),
        website: formData.website.trim(),
        company_description: formData.companyDescription.trim(),
        first_name: formData.firstName.trim(),
        last_name: formData.lastName.trim(),
        ...(formData.profileImageUrl !== (profile?.profile_image_url || '') ? { profile_image_url: formData.profileImageUrl } : {}),
      } as any);

      if (result?.error) {
        throw result.error;
      }

      if (user?.id && Object.keys(notificationDraft).length > 0) {
        const { data: existing, error: readError } = await supabase.from('notification_preferences')
          .select('notification_type, is_enabled, email_enabled, in_app_enabled').eq('user_id', user.id);
        if (readError) throw readError;
        const rows = notificationRows.filter(row => row.type !== 'interview_scheduled' && row.channels.some(channel => `${row.type}:${channel}` in notificationDraft)).map(row => {
          const previous = existing?.find(item => item.notification_type === row.type);
          return {
            user_id: user.id, notification_type: row.type,
            is_enabled: notificationDraft[`${row.type}:push`] ?? previous?.is_enabled ?? notificationEnabled(row.type, 'push'),
            email_enabled: notificationDraft[`${row.type}:email`] ?? previous?.email_enabled ?? notificationEnabled(row.type, 'email'),
            in_app_enabled: notificationDraft[`${row.type}:in_app`] ?? previous?.in_app_enabled ?? notificationEnabled(row.type, 'in_app'),
            updated_at: new Date().toISOString(),
          };
        });
        if (rows.length) {
          const { error: prefsError } = await supabase.from('notification_preferences').upsert(rows, { onConflict: 'user_id,notification_type' });
          if (prefsError) throw prefsError;
        }
      }
      const completion = await updateProfile({ onboarding_completed: true });
      if (completion?.error) throw completion.error;

      // Clear draft after successful submission
      clearEmployerWelcomeDraft(user?.id);

      toast({
        title: "Välkommen till Parium!",
        description: "Din arbetsgivarprofil är nu klar."
      });

      onComplete();
    } catch (error) {
      console.error('Profile update error:', error);
      toast({
        title: "Fel",
        description: "Kunde inte spara allt. Försök igen — guiden finns kvar.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="text-center space-y-8 py-4">
            <div className="space-y-6">
              <div className="bg-white/20 backdrop-blur-sm p-4 rounded-full w-fit mx-auto">
                <Sparkles className="h-10 w-10 text-white" />
              </div>
              <div className="space-y-4">
                <h2 className="text-3xl font-bold text-white">Välkommen till Parium</h2>
                <p className="text-lg text-white max-w-md mx-auto leading-relaxed break-words">
                  Börja med ert företag och er profil. Välj sedan hur ni vill hantera intervjuer och aviseringar. Ni kan alltid ändra era val senare.
                </p>
                {isReplay && <p className="text-sm text-white">Testläge: det du fyller i här ändrar inte ditt riktiga konto.</p>}
              </div>
            </div>

            <div className="max-w-md mx-auto space-y-3 text-left">
              {[
                {
                  title: 'Företaget',
                  desc: 'Namn, bransch och vad ni gör.',
                },
                {
                  title: 'Företagslogga',
                  desc: 'Så kandidater känner igen er direkt.',
                },
                {
                  title: 'Din profil',
                  desc: 'Ditt namn och din profilbild.',
                },
                {
                  title: 'Möteslänk',
                  desc: 'Er fasta länk för videointervjuer. Helt valfritt.',
                },
                {
                  title: 'Standardmeddelanden',
                  desc: 'Fylls i automatiskt när ni bokar intervjuer.',
                },
                {
                  title: 'Aviseringar',
                  desc: 'Välj hur du vill få uppdateringar.',
                },
              ].map((item, index) => (
                <div
                  key={item.title}
                  className="flex items-start gap-4 bg-white/10 backdrop-blur-sm p-4 rounded-xl border border-white/20"
                >
                  <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-semibold text-white">{index + 1}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-white">{item.title}</p>
                    <p className="text-sm text-white break-words">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 1:
        return (
          <div className="space-y-6 max-w-md mx-auto">
            <div className="text-center space-y-3">
              <div className="bg-white/20 p-4 rounded-full w-fit mx-auto"><Building2 className="h-8 w-8 text-white" /></div>
              <h2 className="text-2xl font-bold text-white">Berätta om ert företag</h2>
              <p className="text-white">Uppgifterna hjälper kandidater förstå vilka ni är. Fyll i det ni kan nu och komplettera resten innan första annonsen publiceras.</p>
            </div>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="welcome-company-name" className="text-white">Företagsnamn *</Label>
                <Input id="welcome-company-name" maxLength={120} value={formData.companyName} onChange={e => setFormData(prev => ({ ...prev, companyName: e.target.value }))} className="bg-white/5 border-white/10 text-white text-base" />
              </div>
              <div className="space-y-1.5">
                <AuthSelectField
                  id="welcome-industry"
                  label="Bransch"
                  placeholder="Välj bransch"
                  value={formData.industry}
                  options={SWEDISH_INDUSTRIES}
                  onChange={(v) => setFormData(prev => ({ ...prev, industry: v }))}
                  searchable
                  searchPlaceholder="Sök bransch..."
                  allowCustom
                />
              </div>
              <div className="space-y-1.5">
                <AuthSelectField
                  id="welcome-employees"
                  label="Antal anställda"
                  placeholder="Antal"
                  value={formData.employeeCount}
                  options={EMPLOYEE_COUNT_OPTIONS}
                  onChange={(v) => setFormData(prev => ({ ...prev, employeeCount: v }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="welcome-address" className="text-white">Huvudkontor</Label>
                <Input id="welcome-address" maxLength={TEXT_LIMITS.address} value={formData.address} onChange={e => setFormData(prev => ({ ...prev, address: e.target.value }))} className="bg-white/5 border-white/10 text-white text-base" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="welcome-website" className="text-white">Webbplats</Label>
                <Input id="welcome-website" type="url" inputMode="url" placeholder="https://exempel.se" maxLength={200} value={formData.website} onChange={e => setFormData(prev => ({ ...prev, website: e.target.value }))} className="bg-white/5 border-white/10 text-white text-base placeholder:text-white/40" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="welcome-company-description" className="text-white">Företagsbeskrivning</Label>
                <Textarea id="welcome-company-description" autoResize={false} maxLength={TEXT_LIMITS.companyDescription} value={formData.companyDescription} onChange={e => setFormData(prev => ({ ...prev, companyDescription: e.target.value }))} className="h-[160px] min-h-[160px] max-h-[160px] overflow-y-auto bg-white/5 border-white/10 text-white text-base resize-none" />
              </div>
              <p className="text-sm text-white">Bransch, storlek, huvudkontor och beskrivning behövs innan första annonsen publiceras.</p>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <div className="bg-white/20 backdrop-blur-sm p-4 rounded-full w-fit mx-auto mb-4">
                <Upload className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold mb-2 text-white">Lägg till er företagslogga</h2>
              <p className="text-white">
                En logga hjälper kandidater att känna igen ditt företag och bygger förtroende.
              </p>
            </div>

            <div className="space-y-4 max-w-md mx-auto">
              {formData.companyLogoUrl ? (
                <div className="text-center space-y-4">
                  <div className="relative w-fit mx-auto">
                    {/* Delete button */}
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, companyLogoUrl: '' }))}
                      className="absolute -top-2 -right-2 z-10 rounded-full border border-0 bg-red-500/80 p-2 text-white shadow-lg transition-colors md:hover:!bg-red-500 md:hover:!text-white"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <div className="w-40 h-40 bg-white/20 backdrop-blur-sm rounded-full border-2 border-white/20 flex items-center justify-center overflow-hidden">
                      <img 
                        src={formData.companyLogoUrl} 
                        alt="Företagslogga" 
                        className="w-full h-full object-cover"
                        loading="eager"
                        decoding="sync"
                        {...fetchPriority('high')}
                        draggable={false}
                      />
                    </div>
                  </div>
                  <p className="text-sm text-white">Logga uppladdad!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <Label htmlFor="logo-upload" className="block text-sm font-medium text-white">
                    Företagslogga (valfritt)
                  </Label>
                  <div 
                    className="w-full h-32 border-2 border-dashed border-white/20 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-white/40 hover:border-white/50 hover:bg-white/5 transition-all duration-300"
                    onClick={() => document.getElementById('logo-upload')?.click()}
                  >
                    {isUploadingLogo ? (
                      <div className="text-center w-full px-6">
                        <div className="animate-spin w-6 h-6 border-2 border-white border-t-transparent rounded-full mx-auto mb-2"></div>
                        <p className="text-sm text-white tabular-nums">{logoProgress}% — laddar upp logga</p>
                        <div className="mt-2 h-1 w-full max-w-[200px] mx-auto rounded-full bg-white/10 overflow-hidden">
                          <div className="h-full bg-white transition-all duration-200" style={{ width: `${logoProgress}%` }} />
                        </div>
                      </div>
                    ) : (
                      <>
                        <Upload className="w-8 h-8 text-white mb-2" />
                        <p className="text-sm text-white">Klicka för att ladda upp logga.</p>
                        <p className="text-sm text-white mt-1">PNG, JPG eller GIF (max 10MB)</p>
                      </>
                    )}
                  </div>
                  {uploadError && (
                    <p className="text-sm text-destructive break-words" role="alert">
                      {uploadError}
                    </p>
                  )}
                  <input
                    id="logo-upload"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
                    onChange={handleLogoChange}
                    className="hidden"
                    disabled={isUploadingLogo}
                  />

                </div>
              )}
            </div>
          </div>
        );


      case 3:
        return (
          <div className="space-y-6 max-w-md mx-auto">
            <div className="text-center space-y-3">
              <div className="bg-white/20 p-4 rounded-full w-fit mx-auto"><UserRound className="h-8 w-8 text-white" /></div>
              <h2 className="text-2xl font-bold text-white">Din profil</h2>
              <p className="text-white">Så vet kandidater och kollegor vem de pratar med.</p>
            </div>
            <div className="flex justify-center">
              {(profileImageSrc || existingProfileImage) && <img src={profileImageSrc || existingProfileImage || ''} alt="Din profilbild" className="h-20 w-20 rounded-full object-cover" />}
            </div>
            <Label htmlFor="welcome-profile-image" className="text-white">Profilbild (valfritt)</Label>
            <Input id="welcome-profile-image" type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif" onChange={handleProfileImageChange} disabled={isUploadingLogo} className="text-white text-base" />
            <Label htmlFor="welcome-first-name" className="text-white">Förnamn</Label>
            <Input id="welcome-first-name" maxLength={100} value={formData.firstName} onChange={e => setFormData(prev => ({ ...prev, firstName: e.target.value }))} className="bg-white/5 border-white/10 text-white text-base" />
            <Label htmlFor="welcome-last-name" className="text-white">Efternamn</Label>
            <Input id="welcome-last-name" maxLength={100} value={formData.lastName} onChange={e => setFormData(prev => ({ ...prev, lastName: e.target.value }))} className="bg-white/5 border-white/10 text-white text-base" />
          </div>
        );

      case 4: {
        const link = formData.interviewVideoLink;
        const linkValid = !!link && isValidMeetingLink(link);
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <div className="bg-white/20 backdrop-blur-sm p-4 rounded-full w-fit mx-auto mb-4">
                <Video className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold mb-2 text-white">Er möteslänk för intervjuer</h2>
              <p className="text-white">
                 Ange en standardlänk för Teams, Zoom eller Google Meet. Den föreslås vid videointervjuer och kan bytas för varje bokning. För kontorsmöten används ingen videolänk.
              </p>
            </div>

            <div className="space-y-3 max-w-md mx-auto">
              <Label htmlFor="welcome-video-link" className="block text-sm font-medium text-white">
                Möteslänk (valfritt)
              </Label>
              <Input
                id="welcome-video-link"
                value={link}
                onChange={(e) => setFormData(prev => ({ ...prev, interviewVideoLink: e.target.value }))}
                onBlur={(e) => setFormData(prev => ({ ...prev, interviewVideoLink: normalizeMeetingLink(e.target.value) }))}
                placeholder="https://teams.microsoft.com/... eller https://meet.google.com/..."
                className="bg-white/5 border-white/10 text-white placeholder:text-white/60 h-12 text-base md:hover:border-white/50"
              />

              {link && linkValid && (
                <p className="text-sm text-green-400 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                  Giltig möteslänk — den fylls i automatiskt vid videointervjuer.
                </p>
              )}
              {link && !linkValid && (
                <p className="text-sm text-amber-400 flex items-start gap-1.5">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span className="break-words">
                     Länken ser inte ut som en möteslänk från Teams, Zoom, Google Meet, Webex
                     eller Whereby. Ändra länken eller lämna fältet tomt.
                  </span>
                </p>
              )}

              <div className="bg-white/10 backdrop-blur-sm p-4 rounded-xl border border-white/20">
                <p className="text-sm text-white break-words">
                   <strong>Tips:</strong> Samma länk kan användas vid flera möten. Använd väntrum eller lösenord om ni väljer ett fast mötesrum. Ni kan ändra standardlänken senare under Företag → Företagsprofil → Intervjuinställningar.
                </p>
              </div>
            </div>
          </div>
        );
      }

      case 5:
        return (
          <div className="space-y-8 py-8">
            <div className="text-center space-y-4">
              <div className="bg-white/20 backdrop-blur-sm p-4 rounded-full w-fit mx-auto">
                <MessageSquare className="h-10 w-10 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-white">Standardmeddelanden</h2>
              <p className="text-white max-w-md mx-auto leading-relaxed break-words">
                Texten fylls i automatiskt när ni bokar en intervju. Ni kan ändra den vid varje bokning.
              </p>
            </div>

            <div className="max-w-md mx-auto space-y-6">
              <div className="space-y-2">
                <label htmlFor="welcome-video-message" className="text-white font-medium block">
                  Videointervju
                </label>
                <Textarea
                  id="welcome-video-message"
                  value={formData.interviewVideoDefaultMessage}
                  onChange={(e) => setFormData((prev) => ({ ...prev, interviewVideoDefaultMessage: e.target.value }))}
                  placeholder={'Hej!\n\nTack för din ansökan. Vi vill gärna träffa dig på en videointervju.\n\nVänliga hälsningar'}
                  rows={4}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/70 resize-none"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="welcome-office-message" className="text-white font-medium block">
                  Intervju på kontoret
                </label>
                <Textarea
                  id="welcome-office-message"
                  value={formData.interviewOfficeDefaultMessage}
                  onChange={(e) => setFormData((prev) => ({ ...prev, interviewOfficeDefaultMessage: e.target.value }))}
                  placeholder={'Hej!\n\nTack för din ansökan. Vi vill gärna träffa dig på vårt kontor.\n\nVänliga hälsningar'}
                  rows={4}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/70 resize-none"
                />
              </div>

              <div className="bg-white/10 backdrop-blur-sm p-4 rounded-xl border border-white/20">
                <p className="text-sm text-white break-words">
                  <strong>Tips:</strong> Ni kan hoppa över det här och fylla i senare under
                  Företag → Företagsprofil → Intervjuinställningar.
                </p>
              </div>
            </div>
          </div>
        );

      case 6:
        return (
          <div className="space-y-6 max-w-2xl mx-auto">
            <div className="text-center space-y-3">
              <div className="bg-white/20 p-4 rounded-full w-fit mx-auto"><Bell className="h-8 w-8 text-white" /></div>
              <h2 className="text-2xl font-bold text-white">Dina aviseringar</h2>
              <p className="text-white">Välj vad du vill få i appen, som push eller via mejl. Du kan ändra valen i inställningarna senare.</p>
            </div>
            <NotificationPreferencesPanel rows={notificationRows} isEnabled={notificationValue}
              toggle={(type, enabled, channel) => setNotificationDraft(prev => ({ ...prev, [`${type}:${channel}`]: enabled }))}
              disabled={notificationsLoading} emailBlocked={emailKnown && !emailSubscribed}
              intro={emailKnown && !emailSubscribed ? 'Din adress är avregistrerad från app-mejl. Aktivera mejlutskick igen under Inställningar om du vill få dem.' : undefined} />
          </div>
        );

      case 7:
        return (
          <div className="text-center space-y-8 py-8">
            <div className="space-y-6">
              <div className="bg-white/20 backdrop-blur-sm p-4 rounded-full w-fit mx-auto">
                <CheckCircle className="h-10 w-10 text-white" />
              </div>
              
              <div className="space-y-4">
                <h2 className="text-3xl font-bold text-white">Allt är klart!</h2>
                <p className="text-xl text-white max-w-md mx-auto leading-relaxed">
                   Dina val är klara. Företagsuppgifterna kan kompletteras senare, men måste vara fullständiga innan ni publicerar er första annons.
                </p>
              </div>
            </div>
            
            <div className="bg-white/10 backdrop-blur-sm p-6 rounded-xl border border-white/20 max-w-md mx-auto">
              <p className="text-sm text-white">
                <strong className="text-white">Tips:</strong> Börja med att skapa din första jobbannons för att locka kvalificerade kandidater till ditt företag.
              </p>
            </div>

            {/* Nu kör vi knapp */}
            <div className="pt-4 flex flex-col items-center gap-4">
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="py-4 px-8 bg-primary hover:bg-primary/90 hover:scale-105 transition-transform duration-200 text-white font-semibold text-lg rounded-full focus:outline-none focus:ring-0"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full mr-2"></div>
                    <span>Sparar...</span>
                  </>
                ) : (
                  <>
                     <span>{isReplay ? 'Avsluta testet' : 'Spara och fortsätt'}</span>
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </>
                )}
              </Button>

              <Button
                onClick={handlePrevious}
                className="py-4 px-6 bg-primary hover:bg-primary/90 hover:scale-105 transition-transform duration-200 text-white font-semibold rounded-full focus:outline-none focus:ring-0"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                 Tillbaka – ändra aviseringar
              </Button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div
      data-welcome-tunnel-scroll="true"
      className="fixed inset-0 z-[60] h-[100dvh] bg-gradient-parium flex flex-col overflow-x-hidden overflow-y-auto overscroll-contain"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      {/* Static animated background - identical to AuthMobile */}
      <div className="fixed inset-0 pointer-events-none z-0">
        
        
        {/* Animated floating elements - completely isolated from layout changes */}
        <div className="fixed top-20 left-10 w-4 h-4 bg-secondary/30 rounded-full animate-bounce pointer-events-none z-[1]" style={{ animationDuration: '2s' }}></div>
        <div className="fixed top-32 left-16 w-2 h-2 bg-accent/40 rounded-full animate-bounce pointer-events-none z-[1]" style={{ animationDuration: '2.5s' }}></div>
        <div className="fixed top-24 left-20 w-3 h-3 bg-secondary/20 rounded-full animate-bounce pointer-events-none z-[1]" style={{ animationDuration: '3s' }}></div>
        
        {/* Decorative glow effect in bottom right corner */}
        <div className="fixed -bottom-32 -right-32 w-96 h-96 pointer-events-none z-[1]">
          <div className="absolute inset-0 bg-primary-glow/40 rounded-full blur-[120px]"></div>
          <div className="absolute inset-4 bg-primary-glow/30 rounded-full blur-[100px]"></div>
          <div className="absolute inset-8 bg-primary-glow/25 rounded-full blur-[80px]"></div>
        </div>
        
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
               <span className="text-sm text-white font-medium">Steg {currentStep} av {totalSteps - 2}</span>
               <span className="text-sm text-white font-medium">{Math.round((currentStep / (totalSteps - 2)) * 100)}%</span>
            </div>
            <div className="relative h-2 w-full overflow-hidden rounded-full bg-primary/30">
              <div 
                className="h-full bg-white transition-all duration-300" 
                 style={{ width: `${(currentStep / (totalSteps - 2)) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Main content */}
        <div className="flex-1 flex items-center justify-center px-6 py-8 relative z-10">
          <div className="w-full max-w-2xl">
            {renderStep()}
          </div>
        </div>

        {/* Navigation buttons */}
        {currentStep < totalSteps - 1 && currentStep !== totalSteps - 1 && (
          <div className="w-full max-w-md mx-auto px-6 pb-8 relative z-10">
             <div className="flex gap-3 items-center justify-center">
               {currentStep > 0 && (
                 <Button
                   variant="outline"
                   onMouseDown={(e) => { e.currentTarget.blur(); (document.activeElement as HTMLElement)?.blur?.(); }}
                   onMouseUp={(e) => e.currentTarget.blur()}
                   onClick={(e) => { e.currentTarget.blur(); handlePrevious(); }}
                    className="rounded-full bg-white/5 backdrop-blur-sm border-white/20 text-white px-4 py-2 transition-colors duration-150 hover:bg-white/10 md:hover:bg-white/10 hover:text-white md:hover:text-white disabled:opacity-30 touch-border-white [&_svg]:text-white hover:[&_svg]:text-white md:hover:[&_svg]:text-white focus:outline-none focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                 >
                   <ArrowLeft className="h-4 w-4 mr-2" />
                   Tillbaka
                 </Button>
               )}

              <Button
                onMouseDown={(e) => { e.currentTarget.blur(); (document.activeElement as HTMLElement)?.blur?.(); }}
                onMouseUp={(e) => e.currentTarget.blur()}
                onClick={(e) => { e.currentTarget.blur(); handleNext(); }}
                 disabled={isUploadingLogo}
                 className={`rounded-full bg-primary hover:bg-primary/90 md:hover:bg-primary/90 text-white px-8 py-2 touch-border-white transition-colors duration-150 focus:outline-none focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0 ${currentStep === 0 ? 'flex-1 text-lg font-semibold border border-white/20' : ''}`}
              >
                {currentStep === 0 ? 'Sätt igång' : 'Nästa'}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Image Editor */}
      <ImageEditor
        isOpen={imageEditorOpen}
        onClose={() => {
          setImageEditorOpen(false);
          setPendingImageSrc('');
        }}
        imageSrc={pendingImageSrc}
        onSave={handleLogoSave}
        aspectRatio={1}
      />
    </div>
  );
};

export default EmployerWelcomeTunnel;
