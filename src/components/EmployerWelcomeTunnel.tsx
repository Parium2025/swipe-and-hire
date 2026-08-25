import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useOrgDefaultVideoLink } from '@/hooks/useOrgDefaultVideoLink';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import ImageEditor from '@/components/ImageEditor';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Upload, CheckCircle, ArrowRight, ArrowLeft, Trash2, Video, AlertCircle, CheckCircle2 } from 'lucide-react';
import { createSignedUrl } from '@/utils/storageUtils';
import { useOnline } from '@/hooks/useOnlineStatus';
import { normalizeMeetingLink } from '@/lib/meetingLink';
import { isValidMeetingLink } from '@/pages/employer/companyProfile/meetingLinkValidation';

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
  /** Developer-only: jump directly to a given step on mount */
  initialStep?: number;
  /** Developer-only: when true, no data is written to the database (Spara is mocked) */
  previewMode?: boolean;
}

const EmployerWelcomeTunnel = ({ onComplete, initialStep, previewMode = false }: EmployerWelcomeTunnelProps) => {
  const { profile, updateProfile, user } = useAuth();
  const orgDefaultVideoLink = useOrgDefaultVideoLink();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(
    typeof initialStep === 'number' ? Math.min(Math.max(initialStep, 0), 2) : 0
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [logoProgress, setLogoProgress] = useState(0);
  const [draftRestored, setDraftRestored] = useState(false);
  
  // Image editor states
  const [imageEditorOpen, setImageEditorOpen] = useState(false);
  const [pendingImageSrc, setPendingImageSrc] = useState<string>('');
  const [uploadError, setUploadError] = useState<string | null>(null);


  // Form data
  const [formData, setFormData] = useState({
    companyLogoUrl: (profile as any)?.company_logo_url || '',
    interviewVideoLink: (profile as any)?.interview_video_link || '',
  });

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
            setFormData((prev) => ({ ...prev, ...parsed.formData }));
          }
          if (typeof parsed.currentStep === 'number') {
            setCurrentStep(Math.min(Math.max(parsed.currentStep, 0), 2));
          }
          console.log('💾 Employer welcome tunnel draft restored');
        }
      } catch (e) {
        console.warn('Failed to restore employer welcome tunnel draft');
      }
      setDraftRestored(true);
    }
  }, [draftRestored, draftKey]);

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
    const hasContent = formData.companyLogoUrl || formData.interviewVideoLink || currentStep > 0;
    
    if (hasContent) {
      try {
        sessionStorage.setItem(draftKey, JSON.stringify({
          formData,
          currentStep,
          savedAt: Date.now()
        }));
      } catch (e) {
        console.warn('Failed to save employer welcome tunnel draft');
      }
    }
  }, [formData, currentStep, draftRestored, draftKey]);


  const totalSteps = 3; // Logga, Möteslänk, Slutför
  const progress = (currentStep / (totalSteps - 1)) * 100;

  const handleNext = () => {
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

  const handleSubmit = async () => {

    setIsSubmitting(true);
    try {
      // 🛠️ Preview mode (DeveloperControls) – do NOT touch the database
      if (previewMode) {
        toast({
          title: "Förhandsgranskning",
          description: "Sparat (preview) – ingen data skrevs till databasen."
        });
        onComplete();
        return;
      }

      const result = await updateProfile({
        company_logo_url: formData.companyLogoUrl,
        interview_video_link: formData.interviewVideoLink
          ? normalizeMeetingLink(formData.interviewVideoLink)
          : '',
        onboarding_completed: true
      } as any);

      if (result?.error) {
        throw result.error;
      }

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
        description: "Kunde inte spara profilen.",
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
                      className="absolute -top-2 -right-2 z-10 rounded-full border border-destructive/40 bg-destructive/20 p-2 text-white shadow-lg transition-colors md:hover:!border-destructive/50 md:hover:!bg-destructive/30 md:hover:!text-white"
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
                        fetchPriority="high"
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
                        <p className="text-sm text-white">Klicka för att ladda upp logga</p>
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
                    accept="image/*"
                    onChange={handleLogoChange}
                    className="hidden"
                    disabled={isUploadingLogo}
                  />

                </div>
              )}
            </div>
          </div>
        );


      case 1: {
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
                Klistra in er fasta Teams-, Zoom- eller Google Meet-länk en gång. Sedan fylls den i
                automatiskt varje gång ni bjuder in en kandidat till videointervju.
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
                    Länken ser inte ut som en möteslänk från Teams, Zoom, Google Meet, Webex,
                    Whereby eller liknande. Ni kan spara ändå och ändra senare.
                  </span>
                </p>
              )}

              <div className="bg-white/10 backdrop-blur-sm p-4 rounded-xl border border-white/20">
                <p className="text-sm text-white break-words">
                  <strong>Tips:</strong> Använd er personliga möteslänk (Teams: Kalender → Nytt möte,
                  Google Meet: ”Skapa ett möte för senare”, Zoom: Personal Meeting ID). Ni kan alltid
                  ändra den under Företag → Företagsprofil → Intervjuinställningar.
                </p>
              </div>
            </div>
          </div>
        );
      }

      case 2:
        return (
          <div className="text-center space-y-8 py-8">
            <div className="space-y-6">
              <div className="bg-white/20 backdrop-blur-sm p-4 rounded-full w-fit mx-auto">
                <CheckCircle className="h-10 w-10 text-white" />
              </div>
              
              <div className="space-y-4">
                <h2 className="text-3xl font-bold text-white">Allt är klart!</h2>
                <p className="text-xl text-white max-w-md mx-auto leading-relaxed">
                  Din arbetsgivarprofil är nu komplett. Du kan nu börja skapa jobbannonser och hitta fantastiska kandidater.
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
                    <span>Nu kör vi!</span>
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </>
                )}
              </Button>

              <Button
                variant="outline"
                onClick={handlePrevious}
                className="py-3 rounded-full bg-white/5 border-white/10 text-white transition-all duration-300 md:hover:bg-white/10 md:hover:text-white md:hover:border-white/50 text-sm px-6"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Tillbaka – ändra möteslänk
              </Button>
            </div>
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
              <span className="text-sm text-white font-medium">Steg {currentStep + 1} av {totalSteps - 1}</span>
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
            {renderStep()}
          </div>
        </div>

        {/* Navigation buttons */}
        {currentStep < totalSteps - 1 && currentStep !== totalSteps - 1 && (
          <div className="w-full max-w-md mx-auto px-6 pb-8 relative z-10">
            <div className="flex gap-4">
              {currentStep > 0 && (
                <Button
                  variant="outline"
                  onClick={handlePrevious}
                  className="py-3 rounded-full bg-white/5 border-white/10 text-white transition-all duration-300 md:hover:bg-white/10 md:hover:text-white md:hover:border-white/50 text-sm px-4"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Tillbaka
                </Button>
              )}
              
              <Button
                onClick={handleNext}
                className="flex-1 py-4 bg-primary hover:bg-primary/90 hover:scale-105 transition-transform duration-200 text-white font-semibold text-lg rounded-full focus:outline-none focus:ring-0"
              >
                Nästa
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