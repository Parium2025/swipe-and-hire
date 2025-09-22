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
          <div className="text-center space-y-6">
            <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center mx-auto">
              <Building2 className="w-10 h-10 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-2">
                Välkommen till Parium!
              </h2>
              <p className="text-muted-foreground">
                Låt oss sätta upp din arbetsgivarprofil så att du kan börja hitta de bästa talangerna.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 text-left">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center">
                  <Briefcase className="w-4 h-4 text-green-600" />
                </div>
                <span className="text-sm text-muted-foreground">Skapa och hantera jobbannonser</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center">
                  <Users className="w-4 h-4 text-blue-600" />
                </div>
                <span className="text-sm text-muted-foreground">Få ansökningar från kvalificerade kandidater</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-purple-500/20 rounded-full flex items-center justify-center">
                  <Target className="w-4 h-4 text-purple-600" />
                </div>
                <span className="text-sm text-muted-foreground">Enkelt och effektivt rekryteringsverktyg</span>
              </div>
            </div>
          </div>
        );

      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Upload className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-2">
                Lägg till din företagslogga
              </h2>
              <p className="text-muted-foreground">
                En logga hjälper kandidater att känna igen ditt företag och bygger förtroende.
              </p>
            </div>

            <div className="space-y-4">
              {formData.companyLogoUrl ? (
                <div className="text-center space-y-4">
                  <div className="w-32 h-32 mx-auto bg-card rounded-lg border-2 border-dashed border-border flex items-center justify-center overflow-hidden">
                    <img 
                      src={formData.companyLogoUrl} 
                      alt="Företagslogga" 
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">Logga uppladdad!</p>
                  <Button 
                    variant="outline" 
                    onClick={() => document.getElementById('logo-upload')?.click()}
                    disabled={isUploadingLogo}
                  >
                    Byt logga
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <Label htmlFor="logo-upload" className="block text-sm font-medium">
                    Företagslogga (valfritt)
                  </Label>
                  <div 
                    className="w-full h-32 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => document.getElementById('logo-upload')?.click()}
                  >
                    {isUploadingLogo ? (
                      <div className="text-center">
                        <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
                        <p className="text-sm text-muted-foreground">Laddar upp...</p>
                      </div>
                    ) : (
                      <>
                        <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">Klicka för att ladda upp logga</p>
                        <p className="text-xs text-muted-foreground mt-1">PNG, JPG eller GIF (max 10MB)</p>
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
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-teal-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-2">
                Så här fungerar Parium
              </h2>
              <p className="text-muted-foreground">
                Här är en snabb guide för att komma igång:
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex items-start space-x-4 p-4 bg-card rounded-lg border">
                <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                  1
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Skapa jobbannonser</h3>
                  <p className="text-sm text-muted-foreground">
                    Använd vårt enkla formulär för att skapa attraktiva jobbannonser som når rätt kandidater.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-4 p-4 bg-card rounded-lg border">
                <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                  2
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Ta emot ansökningar</h3>
                  <p className="text-sm text-muted-foreground">
                    Kandidater kan enkelt ansöka till dina jobb. Du får alla ansökningar samlat på ett ställe.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-4 p-4 bg-card rounded-lg border">
                <div className="w-8 h-8 bg-purple-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                  3
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Hitta rätt talang</h3>
                  <p className="text-sm text-muted-foreground">
                    Granska kandidatprofiler, CV:n och videoansökningar för att hitta den perfekta matchen.
                  </p>
                </div>
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="text-center space-y-6">
            <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-10 h-10 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-2">
                Allt är klart!
              </h2>
              <p className="text-muted-foreground">
                Din arbetsgivarprofil är nu komplett. Du kan nu börja skapa jobbannonser och hitta fantastiska kandidater.
              </p>
            </div>
            
            <div className="bg-gradient-to-r from-primary/10 to-secondary/10 p-4 rounded-lg border">
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">Tips:</strong> Börja med att skapa din första jobbannons för att locka kvalificerade kandidater till ditt företag.
              </p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg border shadow-lg">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Välkomsttunnel</CardTitle>
            <span className="text-sm text-muted-foreground">
              {currentStep + 1} av {totalSteps}
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </CardHeader>
        
        <CardContent className="space-y-6">
          {renderStep()}
          
          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentStep === 0}
              className="flex items-center space-x-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Tillbaka</span>
            </Button>
            
            {currentStep === totalSteps - 1 ? (
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex items-center space-x-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full"></div>
                    <span>Sparar...</span>
                  </>
                ) : (
                  <>
                    <span>Slutför</span>
                    <CheckCircle className="w-4 h-4" />
                  </>
                )}
              </Button>
            ) : (
              <Button
                onClick={handleNext}
                className="flex items-center space-x-2"
              >
                <span>Nästa</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

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