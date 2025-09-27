import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import FileUpload from '@/components/FileUpload';
import { Progress } from '@/components/ui/progress';
import { 
  User, 
  Upload, 
  Video, 
  Camera, 
  FileText, 
  MapPin, 
  Phone,
  ArrowRight,
  ArrowLeft,
  Check
} from 'lucide-react';
import { toast } from 'sonner';

interface ProfileBuilderProps {
  onProfileCompleted: () => void;
}

const ProfileBuilder = ({ onProfileCompleted }: ProfileBuilderProps) => {
  const { profile, updateProfile } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form data
  const [formData, setFormData] = useState({
    firstName: profile?.first_name || '',
    lastName: profile?.last_name || '',
    bio: profile?.bio || '',
    location: profile?.location || '',
    phone: profile?.phone || '',
    profileImageUrl: profile?.profile_image_url || '',
    cvUrl: '',
    videoUrl: profile?.video_url || ''
  });

  const totalSteps = 4;
  const progress = (currentStep / totalSteps) * 100;

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await updateProfile({
        first_name: formData.firstName,
        last_name: formData.lastName,
        bio: formData.bio,
        location: formData.location,
        phone: formData.phone,
        profile_image_url: formData.profileImageUrl,
        
        video_url: formData.videoUrl
      });
      toast.success('Profil skapad! Välkommen till Parium!');
      onProfileCompleted();
    } catch (error) {
      toast.error('Något gick fel. Försök igen.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isStepValid = () => {
    switch (currentStep) {
      case 1:
        return formData.firstName.trim() && formData.lastName.trim();
      case 2:
        return formData.profileImageUrl || true; // Optional but encouraged
      case 3:
        return formData.cvUrl || true; // Optional but encouraged
      case 4:
        return formData.bio.trim() && formData.location.trim();
      default:
        return false;
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <div className="bg-primary/10 p-4 rounded-full w-fit mx-auto mb-4">
                <User className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold text-primary mb-2">Vad heter du?</h2>
              <p className="text-muted-foreground">Låt oss börja med grunderna</p>
            </div>
            
            <div className="space-y-4 max-w-md mx-auto">
              <div>
                <Label htmlFor="firstName">Förnamn</Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) => handleInputChange('firstName', e.target.value)}
                  placeholder="Ditt förnamn"
                  className="text-lg py-3"
                />
              </div>
              <div>
                <Label htmlFor="lastName">Efternamn</Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) => handleInputChange('lastName', e.target.value)}
                  placeholder="Ditt efternamn"
                  className="text-lg py-3"
                />
              </div>
              <div>
                <Label htmlFor="phone">Telefonnummer (valfritt)</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  placeholder="+46 70 123 45 67"
                  className="text-lg py-3"
                />
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <div className="bg-primary/10 p-4 rounded-full w-fit mx-auto mb-4">
                <Camera className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold text-primary mb-2">Visa ditt ansikte</h2>
              <p className="text-muted-foreground">En bra profilbild ökar dina chanser att bli sedd</p>
            </div>

            <div className="max-w-md mx-auto">
              <div className="text-center mb-6">
                <Avatar className="h-32 w-32 mx-auto mb-4">
                  <AvatarImage src={formData.profileImageUrl} />
                  <AvatarFallback className="text-2xl">
                    {formData.firstName[0]}{formData.lastName[0]}
                  </AvatarFallback>
                </Avatar>
                
                {formData.profileImageUrl && (
                  <Badge variant="secondary" className="mt-2">
                    <Check className="h-3 w-3 mr-1" />
                    Bild uppladdad!
                  </Badge>
                )}
              </div>

              <FileUpload
                onFileUploaded={(url) => handleInputChange('profileImageUrl', url)}
                onFileRemoved={() => handleInputChange('profileImageUrl', '')}
                acceptedFileTypes={['image/*']}
                maxFileSize={5 * 1024 * 1024} // 5MB
                currentFile={formData.profileImageUrl ? { url: formData.profileImageUrl, name: 'Profilbild' } : undefined}
              />
              
              <p className="text-sm text-muted-foreground text-center mt-4">
                Tips: Använd en bild där ditt ansikte syns tydligt
              </p>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <div className="bg-primary/10 p-4 rounded-full w-fit mx-auto mb-4">
                <FileText className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold text-primary mb-2">Ladda upp ditt CV</h2>
              <p className="text-muted-foreground">Visa arbetsgivare vad du kan</p>
            </div>

            <div className="max-w-md mx-auto">
              {formData.cvUrl && (
                <div className="text-center mb-6">
                  <Badge variant="secondary" className="text-lg py-2 px-4">
                    <Check className="h-4 w-4 mr-2" />
                    CV uppladdat!
                  </Badge>
                </div>
              )}

              <FileUpload
                onFileUploaded={(url) => handleInputChange('cvUrl', url)}
                onFileRemoved={() => handleInputChange('cvUrl', '')}
                acceptedFileTypes={['application/pdf']}
                maxFileSize={10 * 1024 * 1024} // 10MB
                currentFile={formData.cvUrl ? { url: formData.cvUrl, name: 'CV' } : undefined}
              />
              
              <p className="text-sm text-muted-foreground text-center mt-4">
                Accepterat format: PDF (max 10MB)
              </p>
            </div>

            {/* Video upload section */}
            <div className="mt-8 pt-8 border-t">
              <div className="text-center mb-6">
                <Video className="h-6 w-6 text-primary mx-auto mb-2" />
                <h3 className="font-semibold">Kort presentation (valfritt)</h3>
                <p className="text-sm text-muted-foreground">Spela in en kort video och presentera dig själv</p>
              </div>

              {formData.videoUrl ? (
                <div className="text-center">
                  <Badge variant="secondary">
                    <Check className="h-3 w-3 mr-1" />
                    Video uppladdad!
                  </Badge>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="ml-2"
                    onClick={() => handleInputChange('videoUrl', '')}
                  >
                    Ta bort
                  </Button>
                </div>
              ) : (
                <FileUpload
                  onFileUploaded={(url) => handleInputChange('videoUrl', url)}
                  onFileRemoved={() => handleInputChange('videoUrl', '')}
                  acceptedFileTypes={['video/*']}
                  maxFileSize={50 * 1024 * 1024} // 50MB
                />
              )}
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <div className="bg-primary/10 p-4 rounded-full w-fit mx-auto mb-4">
                <MapPin className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold text-primary mb-2">Berätta om dig själv</h2>
              <p className="text-muted-foreground">Gör dig intressant för arbetsgivare</p>
            </div>

            <div className="space-y-4 max-w-md mx-auto">
              <div>
                <Label htmlFor="location">Var bor du?</Label>
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) => handleInputChange('location', e.target.value)}
                  placeholder="t.ex. Stockholm, Göteborg"
                  className="text-lg py-3"
                />
              </div>
              
              <div>
                <Label htmlFor="bio">Presentation</Label>
                <Textarea
                  id="bio"
                  value={formData.bio}
                  onChange={(e) => handleInputChange('bio', e.target.value)}
                  placeholder="Beskriv dig själv, dina intressen och vad du söker för jobb..."
                  className="min-h-32 text-lg"
                  rows={4}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {formData.bio.length}/500 tecken
                </p>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-primary relative overflow-hidden">
      <div className="absolute inset-0 bg-primary/95"></div>
      
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header with progress */}
        <div className="p-6">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <img 
                src="/lovable-uploads/3e52da4e-167e-4ebf-acfb-6a70a68cfaef.png" 
                alt="Parium" 
                className="h-8 w-auto"
              />
              <span className="text-primary-foreground/80 text-sm">
                Steg {currentStep} av {totalSteps}
              </span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 flex items-center justify-center px-4 pb-6">
          <Card className="w-full max-w-2xl bg-background/95 border-2 border-primary-foreground/20">
            <CardContent className="p-8">
              {renderStep()}
            </CardContent>
          </Card>
        </div>

        {/* Footer navigation */}
        <div className="p-6">
          <div className="max-w-2xl mx-auto flex justify-between">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentStep === 1}
              className="bg-background/80 border-primary-foreground/30"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Tillbaka
            </Button>

            {currentStep === totalSteps ? (
              <Button
                onClick={handleSubmit}
                disabled={!isStepValid() || isSubmitting}
                className="bg-secondary hover:bg-secondary/90 text-secondary-foreground px-8"
              >
                {isSubmitting ? 'Skapar profil...' : 'Skapa profil'}
                <Check className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button
                onClick={handleNext}
                disabled={!isStepValid()}
                className="bg-primary hover:bg-primary/90 text-white"
              >
                Nästa
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileBuilder;