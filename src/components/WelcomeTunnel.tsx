import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import FileUpload from '@/components/FileUpload';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import phoneWithPariumLogo from '@/assets/phone-with-parium-logo.jpg';
import { Heart, Users, Briefcase, Star, User, Camera, FileText, MapPin, ArrowRight, ArrowLeft, Check, Sparkles, Target } from 'lucide-react';
interface WelcomeTunnelProps {
  onComplete: () => void;
}
const WelcomeTunnel = ({
  onComplete
}: WelcomeTunnelProps) => {
  const {
    profile,
    updateProfile,
    user
  } = useAuth();
  const {
    toast
  } = useToast();
  const [currentStep, setCurrentStep] = useState(0);
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
    interests: [] as string[]
  });
  const totalSteps = 7; // Introduktion + 5 profil steg + slutskärm
  const progress = currentStep / (totalSteps - 1) * 100;
  const handleInputChange = (field: string, value: string | string[]) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };
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
  const uploadProfileImage = async (file: File) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user?.id}/profile-image.${fileExt}`;
      await supabase.storage.from('job-applications').remove([fileName]);
      const {
        error: uploadError
      } = await supabase.storage.from('job-applications').upload(fileName, file, {
        upsert: true
      });
      if (uploadError) throw uploadError;
      const {
        data: {
          publicUrl
        }
      } = supabase.storage.from('job-applications').getPublicUrl(fileName);
      const imageUrl = `${publicUrl}?t=${Date.now()}`;
      handleInputChange('profileImageUrl', imageUrl);
      toast({
        title: "Profilbild uppladdad!",
        description: "Din profilbild har uppdaterats."
      });
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Fel vid uppladdning",
        description: "Kunde inte ladda upp profilbilden.",
        variant: "destructive"
      });
    }
  };
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type.startsWith('image/')) {
        uploadProfileImage(file);
      } else {
        toast({
          title: "Fel filtyp",
          description: "Vänligen välj en bildfil.",
          variant: "destructive"
        });
      }
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
        onboarding_completed: true // Mark onboarding as completed
      });
      setCurrentStep(totalSteps - 1); // Go to completion step

      setTimeout(() => {
        toast({
          title: "Välkommen till Parium!",
          description: "Din profil är nu skapad och du kan börja söka jobb."
        });
        onComplete();
      }, 2000);
    } catch (error) {
      toast({
        title: "Ett fel uppstod",
        description: "Kunde inte skapa profilen. Försök igen.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  const isStepValid = () => {
    switch (currentStep) {
      case 0:
        return true;
      // Intro
      case 1:
        return formData.firstName.trim() && formData.lastName.trim();
      case 2:
        return true;
      // Profile image is optional
      case 3:
        return true;
      // CV is optional
      case 4:
        return formData.bio.trim() && formData.location.trim();
      case 5:
        return true;
      // Interests are optional
      default:
        return false;
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
  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return <div className="text-center space-y-8 py-8">
            <div className="space-y-6">
                {/* Removed center icon for cleaner, minimal hero */}
                <div className="h-2" />
              
              <div className="space-y-6">
                <h1 className="md:text-9xl lg:text-[12rem] font-bold text-white animate-fade-in leading-tight text-4xl">Välkommen till    Parium👋</h1>
                
                <div className="space-y-1">
                  <p className="text-xl md:text-2xl text-white max-w-lg mx-auto animate-fade-in leading-relaxed drop-shadow-sm font-semibold">Framtiden börjar med ett swipe

                </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-2xl mx-auto">
              <div className="space-y-3 animate-fade-in transition-all duration-300 hover:scale-105 hover:bg-white/5 p-4 rounded-xl cursor-pointer" style={{
              animationDelay: '0.2s'
            }}>
                <div className="p-4 rounded-full w-16 h-16 mx-auto flex items-center justify-center bg-white/20 backdrop-blur-sm transition-all duration-300 hover:bg-white/30 hover:scale-110">
                  <Sparkles className="h-8 w-8 text-white transition-transform duration-300 hover:rotate-12" />
                </div>
                <h3 className="font-semibold text-white text-center">Nästa generation av jobbsök är här</h3>
              </div>

              <div className="space-y-3 animate-fade-in transition-all duration-300 hover:scale-105 hover:bg-white/5 p-4 rounded-xl cursor-pointer" style={{
              animationDelay: '0.4s'
            }}>
                <div className="p-4 rounded-full w-16 h-16 mx-auto flex items-center justify-center bg-white/20 backdrop-blur-sm transition-all duration-300 hover:bg-white/30 hover:scale-110">
                  <Target className="h-8 w-8 text-white transition-transform duration-300 hover:rotate-12" />
                </div>
                <h3 className="font-semibold text-white text-center">Hitta rätt. Snabbt. Enkelt.</h3>
              </div>

              <div className="space-y-3 animate-fade-in transition-all duration-300 hover:scale-105 hover:bg-white/5 p-4 rounded-xl cursor-pointer" style={{
              animationDelay: '0.6s'
            }}>
                <div className="p-4 rounded-full w-16 h-16 mx-auto flex items-center justify-center bg-white/20 backdrop-blur-sm transition-all duration-300 hover:bg-white/30 hover:scale-110">
                  <Heart className="h-8 w-8 text-white transition-transform duration-300 hover:rotate-12" />
                </div>
                <h3 className="font-semibold text-white text-center">Jobbmatchning på ett helt nytt sätt</h3>
              </div>
            </div>

            <div className="text-center mt-8">
              <p className="text-lg md:text-xl text-white max-w-md mx-auto drop-shadow-sm font-semibold">Låt oss skapa din profil tillsammans.</p>
            </div>
          </div>;
      case 1:
        return <div className="space-y-6">
            <div className="text-center mb-8">
              <div className="bg-white/20 backdrop-blur-sm p-4 rounded-full w-fit mx-auto mb-4">
                <User className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Låt oss lära känna dig</h2>
              <p className="text-muted-foreground">Vad heter du?</p>
            </div>
            
            <div className="space-y-4 max-w-md mx-auto">
              <div>
                <Label htmlFor="firstName">Förnamn</Label>
                <Input id="firstName" value={formData.firstName} onChange={e => handleInputChange('firstName', e.target.value)} placeholder="Ditt förnamn" className="text-lg py-3" />
              </div>
              <div>
                <Label htmlFor="lastName">Efternamn</Label>
                <Input id="lastName" value={formData.lastName} onChange={e => handleInputChange('lastName', e.target.value)} placeholder="Ditt efternamn" className="text-lg py-3" />
              </div>
              <div>
                <Label htmlFor="phone">Telefonnummer (valfritt)</Label>
                <Input id="phone" value={formData.phone} onChange={e => handleInputChange('phone', e.target.value)} placeholder="+46 70 123 45 67" className="text-lg py-3" />
              </div>
            </div>
          </div>;
      case 2:
        return <div className="space-y-6">
            <div className="text-center mb-8">
              <div className="bg-white/20 backdrop-blur-sm p-4 rounded-full w-fit mx-auto mb-4">
                <Camera className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Visa ditt ansikte</h2>
              <p className="text-muted-foreground">En bra profilbild ökar dina chanser med 40%</p>
            </div>

            <div className="max-w-md mx-auto text-center">
              <div className="mb-6">
                <div className="relative inline-block">
                  <Avatar className="h-32 w-32 border-4 border-white shadow-lg">
                    <AvatarImage src={formData.profileImageUrl} />
                    <AvatarFallback className="text-2xl bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                      {formData.firstName[0]}{formData.lastName[0]}
                    </AvatarFallback>
                  </Avatar>
                  <label htmlFor="profile-image" className="absolute bottom-0 right-0 bg-white/20 backdrop-blur-sm text-white rounded-full p-3 cursor-pointer hover:bg-white/30 transition-colors shadow-lg">
                    <Camera className="h-5 w-5" />
                  </label>
                  <input id="profile-image" type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                </div>
                
                {formData.profileImageUrl && <Badge variant="secondary" className="mt-4 bg-white/20 text-white">
                    <Check className="h-3 w-3 mr-1" />
                    Perfekt! Bild uppladdad
                  </Badge>}
              </div>

              <div className="space-y-2 text-sm text-white/70">
                <p>💡 Tips för bästa resultat:</p>
                <ul className="text-left space-y-1 max-w-xs mx-auto">
                  <li>• Använd en bild där ditt ansikte syns tydligt</li>
                  <li>• Le och se vänlig ut</li>
                  <li>• Välj professionell bakgrund</li>
                </ul>
              </div>
            </div>
          </div>;
      case 3:
        return <div className="space-y-6">
            <div className="text-center mb-8">
              <div className="bg-white/20 backdrop-blur-sm p-4 rounded-full w-fit mx-auto mb-4">
                <FileText className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Ditt CV</h2>
              <p className="text-muted-foreground">Visa arbetsgivare vad du kan - detta ökar dina chanser</p>
            </div>

            <div className="max-w-md mx-auto">
              {formData.cvUrl && <div className="text-center mb-6">
                  <Badge variant="secondary" className="bg-white/20 text-white text-lg py-2 px-4">
                    <Check className="h-4 w-4 mr-2" />
                    CV uppladdat!
                  </Badge>
                </div>}

              <FileUpload onFileUploaded={url => handleInputChange('cvUrl', url)} onFileRemoved={() => handleInputChange('cvUrl', '')} acceptedFileTypes={['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']} maxFileSize={10 * 1024 * 1024} currentFile={formData.cvUrl ? {
              url: formData.cvUrl,
              name: 'CV'
            } : undefined} />
              
              <div className="mt-4 p-4 bg-white/10 backdrop-blur-sm rounded-lg">
                <p className="text-sm text-white/80">
                  <span className="font-semibold">Visste du att</span> profiler med CV får 3x fler förfrågningar från arbetsgivare?
                </p>
              </div>
            </div>
          </div>;
      case 4:
        return <div className="space-y-6">
            <div className="text-center mb-8">
              <div className="bg-white/20 backdrop-blur-sm p-4 rounded-full w-fit mx-auto mb-4">
                <MapPin className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Berätta om dig själv</h2>
              <p className="text-muted-foreground">Gör dig intressant för arbetsgivare</p>
            </div>

            <div className="space-y-4 max-w-md mx-auto">
              <div>
                <Label htmlFor="location">Var bor du?</Label>
                <Input id="location" value={formData.location} onChange={e => handleInputChange('location', e.target.value)} placeholder="t.ex. Stockholm, Göteborg" className="text-lg py-3" />
              </div>
              
              <div>
                <Label htmlFor="bio">Presentation</Label>
                <Textarea id="bio" value={formData.bio} onChange={e => handleInputChange('bio', e.target.value)} placeholder="Beskriv dig själv kort - vad gör dig unik? Vilken typ av jobb söker du?" className="min-h-32 text-lg" rows={4} />
                <p className="text-xs text-white/70 mt-1">
                  {formData.bio.length}/500 tecken
                </p>
              </div>
            </div>
          </div>;
      case 5:
        const interests = ['Teknik', 'Design', 'Försäljning', 'Marknadsföring', 'Ekonomi', 'HR', 'Hälsovård', 'Utbildning', 'Bygg', 'Transport', 'Kreativt', 'Ledning'];
        return <div className="space-y-6">
            <div className="text-center mb-8">
              <div className="bg-white/20 backdrop-blur-sm p-4 rounded-full w-fit mx-auto mb-4">
                <Target className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Vad intresserar dig?</h2>
              <p className="text-muted-foreground">Välj områden som intresserar dig (valfritt)</p>
            </div>

            <div className="max-w-md mx-auto">
              <div className="grid grid-cols-2 gap-3">
                {interests.map(interest => <Button key={interest} variant={formData.interests.includes(interest) ? "default" : "outline"} onClick={() => toggleInterest(interest)} className="h-12 text-sm">
                    {formData.interests.includes(interest) && <Check className="h-4 w-4 mr-2" />}
                    {interest}
                  </Button>)}
              </div>
              
              {formData.interests.length > 0 && <div className="mt-4 p-3 bg-white/10 backdrop-blur-sm rounded-lg">
                  <p className="text-sm text-white/80">
                    Vi kommer att visa jobb som matchar dina intressen: {formData.interests.join(', ')}
                  </p>
                </div>}
            </div>
          </div>;
      case 6:
        return <div className="text-center space-y-8 py-8">
            <div className="space-y-6">
              <div className="relative">
                <div className="bg-gradient-to-r from-green-500 to-blue-600 p-6 rounded-full w-20 h-20 mx-auto flex items-center justify-center animate-pulse">
                  <Check className="h-10 w-10 text-white" />
                </div>
              </div>
              
              <div className="space-y-4">
                <h1 className="text-4xl font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
                  Grattis {formData.firstName}!
                </h1>
                <p className="text-xl text-muted-foreground max-w-md mx-auto">
                  Din profil är nu skapad och du kan börja din resa mot drömjobbet.
                </p>
              </div>
            </div>

            <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-6 rounded-lg max-w-md mx-auto">
              <h3 className="font-semibold text-lg mb-2">Nästa steg:</h3>
              <ul className="space-y-2 text-left text-sm">
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  Börja swipa genom jobb som passar dig
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  Ansök på intressanta tjänster
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                  Få matchningar med arbetsgivare
                </li>
              </ul>
            </div>
          </div>;
      default:
        return null;
    }
  };
  return <div className="min-h-screen bg-gradient-parium flex flex-col relative">
      {/* Exact same mobile background as AuthMobile */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/95 to-primary-dark"></div>
        
        {/* Soft fade at bottom to prevent hard edges */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-primary-dark via-primary-dark/80 to-transparent"></div>
        
        {/* Animated floating elements - exactly like AuthMobile */}
        <div className="absolute top-20 left-10 w-4 h-4 bg-secondary/30 rounded-full animate-bounce" style={{
        animationDuration: '2s'
      }}></div>
        <div className="absolute top-32 left-16 w-2 h-2 bg-accent/40 rounded-full animate-bounce" style={{
        animationDuration: '2.5s'
      }}></div>
        <div className="absolute top-24 left-20 w-3 h-3 bg-secondary/20 rounded-full animate-bounce" style={{
        animationDuration: '3s'
      }}></div>
        
        <div className="absolute bottom-40 right-20 w-5 h-5 bg-accent/30 rounded-full animate-bounce" style={{
        animationDuration: '2.2s'
      }}></div>
        <div className="absolute bottom-32 right-16 w-3 h-3 bg-secondary/25 rounded-full animate-bounce" style={{
        animationDuration: '2.8s'
      }}></div>
        <div className="absolute bottom-36 right-24 w-2 h-2 bg-accent/35 rounded-full animate-bounce" style={{
        animationDuration: '2.3s'
      }}></div>
        
        {/* Pulsing lights */}
        <div className="absolute top-10 right-10 w-3 h-3 bg-secondary/40 rounded-full animate-pulse" style={{
        animationDuration: '1.5s'
      }}></div>
        <div className="absolute top-16 right-20 w-2 h-2 bg-accent/30 rounded-full animate-pulse" style={{
        animationDuration: '2s'
      }}></div>
        <div className="absolute top-12 left-8 w-3 h-3 bg-accent/40 rounded-full animate-pulse" style={{
        animationDuration: '1.8s'
      }}></div>
        
        {/* Small stars */}
        <div className="absolute top-1/4 left-1/3 w-1 h-1 bg-accent/60 rounded-full animate-pulse" style={{
        animationDuration: '3s'
      }}>
          <div className="absolute inset-0 bg-accent/40 rounded-full animate-ping" style={{
          animationDuration: '3s'
        }}></div>
        </div>
        <div className="absolute top-1/3 right-1/3 w-1 h-1 bg-secondary/60 rounded-full animate-pulse" style={{
        animationDuration: '2.5s'
      }}>
          <div className="absolute inset-0 bg-secondary/40 rounded-full animate-ping" style={{
          animationDuration: '2.5s'
        }}></div>
        </div>
      </div>
      <div className="min-h-screen flex flex-col relative z-10">
        {/* Header with progress */}
        {currentStep > 0 && currentStep < totalSteps - 1 && <div className="p-6">
            <div className="max-w-2xl mx-auto">
              <div className="flex items-center justify-between mb-4">
                <img src="/lovable-uploads/parium-logo-transparent.png" alt="Parium" className="h-8 w-auto" />
                <span className="text-white/70 text-sm">
                  Steg {currentStep} av {totalSteps - 2}
                </span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          </div>}

        {/* Main content with white text overlay */}
        <div className="flex-1 flex items-center justify-center px-4 pb-6">
          <section className="w-full max-w-3xl px-6 py-10">
            <div className="[&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:text-primary-foreground [&_h1]:mb-2 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:text-primary-foreground [&_h2]:mb-2 [&_h3]:text-primary-foreground [&_h3]:font-medium [&_p]:text-primary-foreground/90 [&_p]:text-base [&_label]:text-primary-foreground [&_label]:font-medium [&_.text-muted-foreground]:text-primary-foreground/75 [&_button]:font-medium">
              {renderStep()}
            </div>
          </section>
        </div>

        {/* Footer navigation */}
        <div className="p-6">
          <div className="max-w-4xl mx-auto flex justify-center items-center px-8">
            {currentStep > 0 && currentStep !== totalSteps - 1 && <Button variant="outline" onClick={handlePrevious} className="absolute left-8">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Tillbaka
              </Button>}

            {currentStep === 0 ? <Button onClick={handleNext} size="lg" className="px-12 py-3 text-lg hover:scale-110 transition-transform duration-200 hover:shadow-2xl -mt-24">
                Kom igång
                <ArrowRight className="h-4 w-4 ml-2 transition-transform duration-200 hover:translate-x-1" />
              </Button> : currentStep === totalSteps - 2 ? <Button onClick={handleSubmit} disabled={!isStepValid() || isSubmitting} className="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white px-8">
                {isSubmitting ? 'Skapar profil...' : 'Skapa profil'}
                <Check className="h-4 w-4 ml-2" />
              </Button> : currentStep === totalSteps - 1 ? <Button onClick={onComplete} className="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white px-8">
                Börja använda Parium
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button> : <Button onClick={handleNext} disabled={!isStepValid()} className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white">
                Nästa
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>}
          </div>
        </div>
      </div>
    </div>;
};
export default WelcomeTunnel;