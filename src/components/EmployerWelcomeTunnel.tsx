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
import { Building2, Upload, CheckCircle, ArrowRight, ArrowLeft, Briefcase, Users, Target, Sparkles } from 'lucide-react';
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
    try {
      setIsUploadingLogo(true);
      
      const user = await supabase.auth.getUser();
      if (!user.data.user) throw new Error('User not authenticated');

      const fileExt = 'png';
      const fileName = `${user.data.user.id}/${Date.now()}-company-logo.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('job-applications')
        .upload(fileName, editedBlob);

      if (uploadError) throw uploadError;

      // Use signed URL for secure access
      const signedUrl = await createSignedUrl('job-applications', fileName, 86400); // 24 hours
      if (!signedUrl) {
        throw new Error('Could not create secure access URL');
      }

      const logoUrl = `${signedUrl}&t=${Date.now()}`;
      
      setFormData(prev => ({ ...prev, companyLogoUrl: logoUrl }));
      setImageEditorOpen(false);
      setPendingImageSrc('');
      
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
              <div className="space-y-3 animate-fade-in transition-all duration-300 hover:scale-105 hover:bg-white/5 p-4 rounded-xl cursor-pointer" style={{animationDelay: '0.2s'}}>
                <div className="p-4 rounded-full w-16 h-16 mx-auto flex items-center justify-center bg-white/20 backdrop-blur-sm transition-all duration-300 hover:bg-white/30 hover:scale-110">
                  <Briefcase className="h-8 w-8 text-white transition-transform duration-300 hover:rotate-12" />
                </div>
                <h3 className="text-white text-center font-semibold">Skapa och hantera jobbannonser</h3>
              </div>

              <div className="space-y-3 animate-fade-in transition-all duration-300 hover:scale-105 hover:bg-white/5 p-4 rounded-xl cursor-pointer" style={{animationDelay: '0.4s'}}>
                <div className="p-4 rounded-full w-16 h-16 mx-auto flex items-center justify-center bg-white/20 backdrop-blur-sm transition-all duration-300 hover:bg-white/30 hover:scale-110">
                  <Users className="h-8 w-8 text-white transition-transform duration-300 hover:rotate-12" />
                </div>
                <h3 className="text-white text-center font-semibold">Få ansökningar från kvalificerade kandidater</h3>
              </div>

              <div className="space-y-3 animate-fade-in transition-all duration-300 hover:scale-105 hover:bg-white/5 p-4 rounded-xl cursor-pointer" style={{animationDelay: '0.6s'}}>
                <div className="p-4 rounded-full w-16 h-16 mx-auto flex items-center justify-center bg-white/20 backdrop-blur-sm transition-all duration-300 hover:bg-white/30 hover:scale-110">
                  <Target className="h-8 w-8 text-white transition-transform duration-300 hover:rotate-12" />
                </div>
                <h3 className="text-white text-center font-semibold">Hitta rätt talang snabbt och enkelt</h3>
              </div>
            </div>

            <div className="text-center mt-8">
              <p className="text-lg md:text-xl text-white max-w-md mx-auto drop-shadow-sm font-semibold">Kom igång på några minuter</p>
            </div>
          </div>
        );

      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <div className="bg-white/20 backdrop-blur-sm p-4 rounded-full w-fit mx-auto mb-4">
                <Upload className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold mb-2 text-white">Lägg till din företagslogga</h2>
              <p className="text-white">
                En logga hjälper kandidater att känna igen ditt företag och bygger förtroende.
              </p>
            </div>

            <div className="space-y-4 max-w-md mx-auto">
              {formData.companyLogoUrl ? (
                <div className="text-center space-y-4">
                  <div className="w-32 h-32 mx-auto bg-white/20 backdrop-blur-sm rounded-lg border-2 border-white/20 flex items-center justify-center overflow-hidden">
                    <img 
                      src={formData.companyLogoUrl} 
                      alt="Företagslogga" 
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                  <p className="text-sm text-white">Logga uppladdad!</p>
                  <Button 
                    variant="outline" 
                    onClick={() => document.getElementById('logo-upload')?.click()}
                    disabled={isUploadingLogo}
                    className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:scale-105 transition-transform duration-200"
                  >
                    Byt logga
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <Label htmlFor="logo-upload" className="block text-sm font-medium text-white">
                    Företagslogga (valfritt)
                  </Label>
                  <div 
                    className="w-full h-32 border-2 border-dashed border-white/20 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-white/40 hover:bg-white/5 transition-all duration-300"
                    onClick={() => document.getElementById('logo-upload')?.click()}
                  >
                    {isUploadingLogo ? (
                      <div className="text-center">
                        <div className="animate-spin w-6 h-6 border-2 border-white border-t-transparent rounded-full mx-auto mb-2"></div>
                        <p className="text-sm text-white">Laddar upp...</p>
                      </div>
                    ) : (
                      <>
                        <Upload className="w-8 h-8 text-white mb-2" />
                        <p className="text-sm text-white">Klicka för att ladda upp logga</p>
                        <p className="text-xs text-white/60 mt-1">PNG, JPG eller GIF (max 10MB)</p>
                      </>
                    )}
                  </div>
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

      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <div className="bg-white/20 backdrop-blur-sm p-4 rounded-full w-fit mx-auto mb-4">
                <Sparkles className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold mb-2 text-white">Så här fungerar Parium</h2>
              <p className="text-white">
                Här är en snabb guide för att komma igång:
              </p>
            </div>

            <div className="space-y-4 max-w-md mx-auto">
              <div className="flex items-start space-x-4 p-4 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20 transition-all duration-300 hover:bg-white/15 hover:scale-105">
                <div className="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center text-sm font-bold">
                  1
                </div>
                <div>
                  <h3 className="font-semibold text-white">Skapa jobbannonser</h3>
                  <p className="text-sm text-white/80">
                    Använd vårt enkla formulär för att skapa attraktiva jobbannonser som når rätt kandidater.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-4 p-4 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20 transition-all duration-300 hover:bg-white/15 hover:scale-105">
                <div className="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center text-sm font-bold">
                  2
                </div>
                <div>
                  <h3 className="font-semibold text-white">Ta emot ansökningar</h3>
                  <p className="text-sm text-white/80">
                    Kandidater kan enkelt ansöka till dina jobb. Du får alla ansökningar samlat på ett ställe.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-4 p-4 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20 transition-all duration-300 hover:bg-white/15 hover:scale-105">
                <div className="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center text-sm font-bold">
                  3
                </div>
                <div>
                  <h3 className="font-semibold text-white">Hitta rätt talang</h3>
                  <p className="text-sm text-white/80">
                    Granska kandidatprofiler, CV:n och videoansökningar för att hitta den perfekta matchen.
                  </p>
                </div>
              </div>
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
            
            <div className="bg-white/10 backdrop-blur-sm p-6 rounded-xl border border-white/20 transition-all duration-300 hover:bg-white/15 hover:scale-105 max-w-md mx-auto">
              <p className="text-sm text-white/90">
                <strong className="text-white">Tips:</strong> Börja med att skapa din första jobbannons för att locka kvalificerade kandidater till ditt företag.
              </p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary via-background to-secondary relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-b from-background/20 via-transparent to-background/20 pointer-events-none" />
      <div className="absolute top-0 left-0 w-96 h-96 bg-primary/20 rounded-full blur-3xl transform -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-secondary/20 rounded-full blur-3xl transform translate-x-1/2 translate-y-1/2" />

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
        {currentStep < totalSteps - 1 && (
          <div className="w-full max-w-md mx-auto px-6 pb-8 relative z-10">
            <div className="flex gap-4">
              {currentStep > 0 && (
                <Button
                  variant="outline"
                  onClick={handlePrevious}
                  className="py-3 bg-white/10 border-white/20 text-white hover:bg-white/20 hover:scale-105 transition-transform duration-200 text-sm px-4"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Tillbaka
                </Button>
              )}
              
              {currentStep === totalSteps - 1 ? (
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="flex-1 py-4 bg-primary hover:bg-primary/90 hover:scale-105 transition-transform duration-200 text-white font-semibold text-lg rounded-lg focus:outline-none focus:ring-0"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full mr-2"></div>
                      <span>Sparar...</span>
                    </>
                  ) : (
                    <>
                      <span>Slutför</span>
                      <CheckCircle className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  onClick={handleNext}
                  className="flex-1 py-4 bg-primary hover:bg-primary/90 hover:scale-105 transition-transform duration-200 text-white font-semibold text-lg rounded-lg focus:outline-none focus:ring-0"
                >
                  {currentStep === 0 ? 'Kom igång' : 'Nästa'}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              )}
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