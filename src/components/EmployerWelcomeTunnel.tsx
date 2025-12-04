import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import FileUpload from '@/components/FileUpload';
import ImageEditor from '@/components/ImageEditor';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Building2, Upload, CheckCircle, ArrowRight, ArrowLeft, Briefcase, Users, Target, Sparkles, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { createSignedUrl } from '@/utils/storageUtils';

interface EmployerWelcomeTunnelProps {
  onComplete: () => void;
}

const EmployerWelcomeTunnel = ({ onComplete }: EmployerWelcomeTunnelProps) => {
  const { profile, updateProfile, user } = useAuth();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  
  // Image editor states
  const [imageEditorOpen, setImageEditorOpen] = useState(false);
  const [pendingImageSrc, setPendingImageSrc] = useState<string>('');

  // Form data
  const [formData, setFormData] = useState({
    companyLogoUrl: (profile as any)?.company_logo_url || '',
  });

  const totalSteps = 4; // Välkomst, Logo, Instruktioner, Slutför
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

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;

    const imageUrl = URL.createObjectURL(file);
    setPendingImageSrc(imageUrl);
    setImageEditorOpen(true);
  };

  const handleLogoSave = async (editedBlob: Blob) => {
    // Stäng dialogen direkt så användaren ser loading-state
    setImageEditorOpen(false);
    setPendingImageSrc('');
    setIsUploadingLogo(true);
    
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) throw new Error('User not authenticated');

      const fileExt = 'png';
      const fileName = `${user.data.user.id}/${Date.now()}-company-logo.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('company-logos')
        .upload(fileName, editedBlob, { upsert: true });

      if (uploadError) throw uploadError;

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
      toast({
        title: "Fel vid uppladdning",
        description: "Kunde inte ladda upp loggan.",
        variant: "destructive"
      });
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await updateProfile({
        company_logo_url: formData.companyLogoUrl,
        onboarding_completed: true
      } as any);

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
          <div className="text-center space-y-8 py-8">
            <div className="space-y-6">
              <div className="h-2" />
              
              <div className="space-y-6">
                <h1 className="text-4xl font-bold text-white animate-fade-in leading-tight">Välkommen till Parium</h1>
                
                <div className="space-y-1">
                  <p className="text-xl md:text-2xl text-white animate-fade-in leading-relaxed drop-shadow-sm font-semibold">Låt oss sätta upp din arbetsgivarprofil</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 max-w-2xl mx-auto">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 100, damping: 20, delay: 0.2 }}
                className="space-y-3 p-4 rounded-xl cursor-pointer hover:bg-white/5"
              >
                <div className="p-4 rounded-full w-16 h-16 mx-auto flex items-center justify-center bg-white/20 backdrop-blur-sm">
                  <Briefcase className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-white text-center font-semibold">Skapa och hantera jobbannonser</h3>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 100, damping: 20, delay: 0.4 }}
                className="space-y-3 p-4 rounded-xl cursor-pointer hover:bg-white/5"
              >
                <div className="p-4 rounded-full w-16 h-16 mx-auto flex items-center justify-center bg-white/20 backdrop-blur-sm">
                  <Users className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-white text-center font-semibold">Få ansökningar från kvalificerade kandidater</h3>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 100, damping: 20, delay: 0.6 }}
                className="space-y-3 p-4 rounded-xl cursor-pointer hover:bg-white/5"
              >
                <div className="p-4 rounded-full w-16 h-16 mx-auto flex items-center justify-center bg-white/20 backdrop-blur-sm">
                  <Target className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-white text-center font-semibold">Hitta rätt talang snabbt och enkelt</h3>
              </motion.div>
            </div>
          </div>
        );

      case 1:
        return (
          <div className="max-w-md mx-auto space-y-6">
            {/* Logo Upload Card - samma stil som profilbild i jobbsökarsidan */}
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg">
              <div className="p-6 space-y-2">
                <h3 className="text-base font-semibold text-white text-center">
                  Företagslogga
                </h3>
                <p className="text-white text-center text-sm">
                  En logga hjälper kandidater att känna igen ditt företag och bygger förtroende
                </p>
                
                {/* Logo Icon */}
                <div className="flex items-center justify-center">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full border-4 border-white/10 p-2 bg-gradient-to-b from-white/5 to-white/5 backdrop-blur-sm">
                      <div className="relative w-full h-full rounded-full bg-gradient-to-b from-primary/30 to-primary/50 overflow-hidden flex items-center justify-center">
                        <Building2 className="h-5 w-5 text-white" />
                      </div>
                    </div>
                    <div className="absolute -top-1 -right-1 bg-white rounded-full p-1 shadow-lg">
                      <Upload className="h-2 w-2 text-primary" />
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="p-4 flex flex-col items-center space-y-4">
                <div className="relative">
                  {formData.companyLogoUrl ? (
                    <>
                      <div 
                        className="cursor-pointer" 
                        onClick={() => document.getElementById('logo-upload')?.click()}
                      >
                        <div className="h-32 w-32 border-4 border-white/10 rounded-full overflow-hidden">
                          <img 
                            src={formData.companyLogoUrl} 
                            alt="Företagslogga" 
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </div>
                      {/* Delete button */}
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, companyLogoUrl: '' }))}
                        className="absolute -top-3 -right-3 bg-white/20 hover:bg-destructive/30 backdrop-blur-sm text-white rounded-full p-2 shadow-lg transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  ) : (
                    <div 
                      className="cursor-pointer" 
                      onClick={() => document.getElementById('logo-upload')?.click()}
                    >
                      <div className="h-32 w-32 border-4 border-white/10 rounded-full flex items-center justify-center bg-white/20">
                        <Building2 className="h-12 w-12 text-white/60" />
                      </div>
                    </div>
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

                <div className="space-y-2 text-center">
                  <Label 
                    htmlFor="logo-upload" 
                    className="text-white cursor-pointer hover:text-white/90 transition-colors text-center text-sm"
                  >
                    Klicka här för att välja en bild (valfritt)
                  </Label>
                  
                  {isUploadingLogo && (
                    <div className="bg-white/10 text-white border border-white/20 animate-pulse rounded-md px-3 py-1.5 text-sm">
                      Laddar upp...
                    </div>
                  )}
                  
                  {formData.companyLogoUrl && !isUploadingLogo && (
                    <div className="bg-white/20 text-white border border-white/20 px-3 py-1 rounded-md text-sm">
                      Logga uppladdad!
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="text-center space-y-8 py-8">
            <div className="space-y-6">
              <div className="h-2" />
              
              <div className="space-y-6">
                <h1 className="text-4xl font-bold text-white animate-fade-in leading-tight">Så här fungerar Parium</h1>
                
                <div className="space-y-1">
                  <p className="text-xl md:text-2xl text-white animate-fade-in leading-relaxed drop-shadow-sm font-semibold">Här är en snabb guide för att komma igång</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 max-w-2xl mx-auto">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 100, damping: 20, delay: 0.2 }}
                className="space-y-3 p-4 rounded-xl cursor-pointer hover:bg-white/5"
              >
                <div className="p-4 rounded-full w-16 h-16 mx-auto flex items-center justify-center bg-white/20 backdrop-blur-sm">
                  <Briefcase className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-white text-center font-semibold">Skapa jobbannonser</h3>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 100, damping: 20, delay: 0.4 }}
                className="space-y-3 p-4 rounded-xl cursor-pointer hover:bg-white/5"
              >
                <div className="p-4 rounded-full w-16 h-16 mx-auto flex items-center justify-center bg-white/20 backdrop-blur-sm">
                  <Users className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-white text-center font-semibold">Ta emot ansökningar</h3>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 100, damping: 20, delay: 0.6 }}
                className="space-y-3 p-4 rounded-xl cursor-pointer hover:bg-white/5"
              >
                <div className="p-4 rounded-full w-16 h-16 mx-auto flex items-center justify-center bg-white/20 backdrop-blur-sm">
                  <Target className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-white text-center font-semibold">Hitta rätt talang</h3>
              </motion.div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="text-center space-y-8 py-8">
            <div className="space-y-6">
              <div className="bg-white/20 backdrop-blur-sm p-4 rounded-full w-fit mx-auto">
                <CheckCircle className="h-10 w-10 text-white" />
              </div>
              
              <div className="space-y-4">
                <h2 className="text-3xl font-bold text-white animate-fade-in">Allt är klart!</h2>
                <p className="text-xl text-white/90 max-w-md mx-auto leading-relaxed">
                  Din arbetsgivarprofil är nu komplett. Du kan nu börja skapa jobbannonser och hitta fantastiska kandidater.
                </p>
              </div>
            </div>
            
            <div className="bg-white/10 backdrop-blur-sm p-6 rounded-xl border border-white/20 hover:border-white/50 transition-all duration-300 hover:bg-white/15 hover:scale-105 max-w-md mx-auto">
              <p className="text-sm text-white/90">
                <strong className="text-white">Tips:</strong> Börja med att skapa din första jobbannons för att locka kvalificerade kandidater till ditt företag.
              </p>
            </div>

            {/* Nu kör vi knapp */}
            <div className="pt-4">
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="py-4 px-8 bg-primary hover:bg-primary/90 hover:scale-105 transition-transform duration-200 text-white font-semibold text-lg rounded-lg focus:outline-none focus:ring-0"
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
              <span className="text-sm text-white font-medium">Steg {currentStep} av {totalSteps - 2}</span>
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
                  className="py-3 bg-white/5 border-white/10 text-white transition-all duration-300 md:hover:bg-white/10 md:hover:text-white md:hover:border-white/50 text-sm px-4"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Tillbaka
                </Button>
              )}
              
              <Button
                onClick={handleNext}
                className="flex-1 py-4 bg-primary hover:bg-primary/90 hover:scale-105 transition-transform duration-200 text-white font-semibold text-lg rounded-lg focus:outline-none focus:ring-0"
              >
                {currentStep === 0 ? 'Kom igång' : 'Nästa'}
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