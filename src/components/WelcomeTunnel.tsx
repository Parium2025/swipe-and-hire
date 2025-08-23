import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import FileUpload from '@/components/FileUpload';
import ImageEditor from '@/components/ImageEditor';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import phoneWithPariumLogo from '@/assets/phone-with-parium-logo.jpg';
import { Heart, Users, Briefcase, Star, User, Camera, FileText, MapPin, ArrowRight, ArrowLeft, Check, Sparkles, Target, Phone, Play, Video, Trash2 } from 'lucide-react';
import ProfileVideo from '@/components/ProfileVideo';
import SwipeIntro from '@/components/SwipeIntro';

interface WelcomeTunnelProps {
  onComplete: () => void;
}

const WelcomeTunnel = ({ onComplete }: WelcomeTunnelProps) => {
  const { profile, updateProfile, user } = useAuth();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(-1); // Start with SwipeIntro (-1)
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  
  // Image editor states
  const [imageEditorOpen, setImageEditorOpen] = useState(false);
  const [coverEditorOpen, setCoverEditorOpen] = useState(false);
  const [pendingImageSrc, setPendingImageSrc] = useState<string>('');
  const [pendingCoverSrc, setPendingCoverSrc] = useState<string>('');

  // Form data
  const [formData, setFormData] = useState({
    firstName: profile?.first_name || '',
    lastName: profile?.last_name || '',
    email: user?.email || '',
    bio: profile?.bio || '',
    location: profile?.location || '',
    phone: profile?.phone || '',
    birthDate: '',
    homeLocation: '',
    employmentStatus: '',
    workingHours: '', // Arbetstid/Omfattning
    availability: '', // Tillgänglighet
    profileImageUrl: profile?.profile_image_url || '',
    profileMediaType: 'image', // 'image' or 'video'
    coverImageUrl: '', // Cover image for videos
    cvUrl: '',
    interests: [] as string[]
  });
  const [inputType, setInputType] = useState('text');
  const [phoneError, setPhoneError] = useState('');

  // Smart phone validation for Swedish numbers - requires complete number
  const validatePhoneNumber = (phoneNumber: string) => {
    if (!phoneNumber.trim()) return { isValid: false, error: 'Telefonnummer är obligatoriskt' };
    
    const cleaned = phoneNumber.replace(/[^\d+]/g, '');
    
    // Check different Swedish number formats
    if (cleaned.startsWith('+46')) {
      const digitsAfterPrefix = cleaned.substring(3);
      
      // Need exactly 9 digits after +46 (total 12 characters: +46xxxxxxxxx)
      if (digitsAfterPrefix.length !== 9) {
        return {
          isValid: false,
          error: `+46-nummer behöver 9 siffror efter +46 (du har ${digitsAfterPrefix.length})`
        };
      }
      
      // Check if it starts with valid Swedish mobile prefixes (70-76)
      if (!digitsAfterPrefix.match(/^7[0-6]/)) {
        return {
          isValid: false,
          error: 'Ange ett giltigt svenskt mobilnummer (ex: +46 70, +46 73, +46 76)'
        };
      }
      
      return { isValid: true, error: '' };
      
    } else if (cleaned.startsWith('0046')) {
      const digitsAfterPrefix = cleaned.substring(4);
      
      if (digitsAfterPrefix.length !== 9) {
        return {
          isValid: false,
          error: `0046-nummer behöver 9 siffror efter 0046 (du har ${digitsAfterPrefix.length})`
        };
      }
      
      if (!digitsAfterPrefix.match(/^7[0-6]/)) {
        return {
          isValid: false,
          error: 'Ange ett giltigt svenskt mobilnummer (ex: 0046 70, 0046 73)'
        };
      }
      
      return { isValid: true, error: '' };
      
    } else if (cleaned.startsWith('0') && cleaned.length === 10) {
      const digitsAfterZero = cleaned.substring(1);
      
      if (!digitsAfterZero.match(/^7[0-6]/)) {
        return {
          isValid: false,
          error: 'Ange ett giltigt svenskt mobilnummer (ex: 070, 073, 076)'
        };
      }
      
      return { isValid: true, error: '' };
      
    } else if (cleaned.match(/^\d{9}$/)) {
      // Just 9 digits, check if it's a valid mobile number
      if (!cleaned.match(/^7[0-6]/)) {
        return {
          isValid: false,
          error: 'Mobilnummer måste börja med 70-76'
        };
      }
      
      return { isValid: true, error: '' };
    }
    
    return {
      isValid: false,
      error: 'Ange ett giltigt svenskt telefonnummer (ex: 070-123 45 67 eller +46 70 123 45 67)'
    };
  };

  const handlePhoneChange = (value: string) => {
    handleInputChange('phone', value);
    const validation = validatePhoneNumber(value);
    setPhoneError(validation.error);
  };

  const totalSteps = 7; // Introduktion + 5 profil steg + slutskärm
  const progress = currentStep / (totalSteps - 1) * 100;

  const countWords = (text: string) => {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  };

  const handleInputChange = (field: string, value: string | string[]) => {
    if (field === 'bio' && typeof value === 'string') {
      const wordCount = countWords(value);
      if (wordCount <= 100) {
        setFormData(prev => ({ ...prev, [field]: value }));
      }
      return;
    }
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleNext = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    } else if (currentStep === 1) {
      setCurrentStep(-1); // Go back to SwipeIntro instead of the removed welcome slide
    }
  };

  const uploadProfileMedia = async (file: File) => {
    const isVideo = file.type.startsWith('video/');
    if (isVideo) setIsUploadingVideo(true);
    
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user?.id}/profile-media.${fileExt}`;
      
      await supabase.storage.from('job-applications').remove([fileName]);
      
      const { error: uploadError } = await supabase.storage
        .from('job-applications')
        .upload(fileName, file, { upsert: true });
      
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage
        .from('job-applications')
        .getPublicUrl(fileName);
      
      const mediaUrl = `${publicUrl}?t=${Date.now()}`;
      const mediaType = file.type.startsWith('video/') ? 'video' : 'image';
      
      handleInputChange('profileImageUrl', mediaUrl);
      handleInputChange('profileMediaType', mediaType);
      
      toast({
        title: `Profil${mediaType === 'video' ? 'video' : 'bild'} uppladdad!`,
        description: `Din profil${mediaType === 'video' ? 'video' : 'bild'} har uppdaterats.`
      });
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Fel vid uppladdning",
        description: "Kunde inte ladda upp filen.",
        variant: "destructive"
      });
    } finally {
      if (isVideo) setIsUploadingVideo(false);
    }
  };

  const uploadCoverImage = async (file: File) => {
    setIsUploadingCover(true);
    
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user?.id}/cover-image.${fileExt}`;
      
      await supabase.storage.from('job-applications').remove([fileName]);
      
      const { error: uploadError } = await supabase.storage
        .from('job-applications')
        .upload(fileName, file, { upsert: true });
      
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage
        .from('job-applications')
        .getPublicUrl(fileName);
      
      const coverUrl = `${publicUrl}?t=${Date.now()}`;
      
      handleInputChange('coverImageUrl', coverUrl);
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
      // Handle video upload (existing logic)
      const video = document.createElement('video');
      video.preload = 'metadata';
      
      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(video.src);
        if (video.duration <= 30) { // Max 30 seconds
          uploadProfileMedia(file);
        } else {
          toast({
            title: "Video för lång",
            description: "Videon får vara max 30 sekunder lång.",
            variant: "destructive"
          });
        }
      };
      
      video.src = URL.createObjectURL(file);
    } else if (file.type.startsWith('image/')) {
      // Handle image - open editor
      const imageUrl = URL.createObjectURL(file);
      setPendingImageSrc(imageUrl);
      setImageEditorOpen(true);
    }
  };

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;

    const imageUrl = URL.createObjectURL(file);
    setPendingCoverSrc(imageUrl);
    setCoverEditorOpen(true);
  };

  const handleProfileImageSave = async (editedBlob: Blob) => {
    try {
      setIsUploadingVideo(true);
      
      const user = await supabase.auth.getUser();
      if (!user.data.user) throw new Error('User not authenticated');

      const fileExt = 'png';
      const fileName = `${user.data.user.id}/${Date.now()}-profile.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('job-applications')
        .upload(fileName, editedBlob);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('job-applications')
        .getPublicUrl(fileName);

      const imageUrl = `${publicUrl}?t=${Date.now()}`;
      
      handleInputChange('profileImageUrl', imageUrl);
      handleInputChange('profileMediaType', 'image');
      
      setImageEditorOpen(false);
      setPendingImageSrc('');
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Fel vid uppladdning",
        description: "Kunde inte ladda upp bilden.",
        variant: "destructive"
      });
    } finally {
      setIsUploadingVideo(false);
    }
  };

  const handleCoverImageSave = async (editedBlob: Blob) => {
    try {
      setIsUploadingCover(true);
      
      const user = await supabase.auth.getUser();
      if (!user.data.user) throw new Error('User not authenticated');

      const fileExt = 'png';
      const fileName = `${user.data.user.id}/${Date.now()}-cover.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('job-applications')
        .upload(fileName, editedBlob);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('job-applications')
        .getPublicUrl(fileName);

      const coverUrl = `${publicUrl}?t=${Date.now()}`;
      
      handleInputChange('coverImageUrl', coverUrl);
      
      setCoverEditorOpen(false);
      setPendingCoverSrc('');
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

  const deleteProfileMedia = () => {
    handleInputChange('profileImageUrl', '');
    handleInputChange('profileMediaType', 'image');
    
    // Reset the file input to allow new uploads
    const fileInput = document.getElementById('profileMedia') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
    
    toast({
      title: "Media borttagen",
      description: "Din profilbild/video har tagits bort."
    });
  };

  const deleteCoverImage = () => {
    handleInputChange('coverImageUrl', '');
    toast({
      title: "Cover-bild borttagen", 
      description: "Din cover-bild har tagits bort."
    });
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
        birth_date: formData.birthDate || null,
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
      case 0: return true; // Intro
      case 1: 
        const requiredFields = !!(formData.firstName.trim() && formData.lastName.trim() && formData.email.trim() && formData.phone.trim() && formData.birthDate.trim() && formData.homeLocation.trim() && formData.employmentStatus.trim());
        const phoneValid = validatePhoneNumber(formData.phone).isValid;
        // Only require workingHours if NOT arbetssokande AND employment status is selected
        const workingHoursValid = formData.employmentStatus === 'arbetssokande' || !formData.employmentStatus || formData.workingHours.trim();
        // Only require availability if employment status is selected
        const availabilityValid = !formData.employmentStatus || formData.availability.trim();
        return requiredFields && phoneValid && workingHoursValid && availabilityValid;
      case 2: return true; // Profile image is optional
      case 3: return !!formData.cvUrl.trim(); // CV is now required
      case 4: return true; // Bio is optional
      case 5: return true; // Interests are optional
      default: return false;
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

  // Render SwipeIntro fullscreen
  if (currentStep === -1) {
    return <SwipeIntro onComplete={() => setCurrentStep(1)} />;
  }

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="text-center space-y-8 py-8">
            <div className="space-y-6">
              {/* Removed center icon for cleaner, minimal hero */}
              <div className="h-2" />
              
              <div className="space-y-6">
                <h1 className="text-4xl font-bold text-white animate-fade-in leading-tight">Välkommen till Parium</h1>
                
                <div className="space-y-1">
                  <p className="text-xl md:text-2xl text-white animate-fade-in leading-relaxed drop-shadow-sm font-semibold">Framtiden börjar med ett swipe</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-2xl mx-auto">
              <div className="space-y-3 animate-fade-in transition-all duration-300 hover:scale-105 hover:bg-white/5 p-4 rounded-xl cursor-pointer" style={{animationDelay: '0.2s'}}>
                <div className="p-4 rounded-full w-16 h-16 mx-auto flex items-center justify-center bg-white/20 backdrop-blur-sm transition-all duration-300 hover:bg-white/30 hover:scale-110">
                  <Sparkles className="h-8 w-8 text-white transition-transform duration-300 hover:rotate-12" />
                </div>
                <h3 className="text-white text-center font-semibold">Nästa generation av jobbsök är här</h3>
              </div>

              <div className="space-y-3 animate-fade-in transition-all duration-300 hover:scale-105 hover:bg-white/5 p-4 rounded-xl cursor-pointer" style={{animationDelay: '0.4s'}}>
                <div className="p-4 rounded-full w-16 h-16 mx-auto flex items-center justify-center bg-white/20 backdrop-blur-sm transition-all duration-300 hover:bg-white/30 hover:scale-110">
                  <Target className="h-8 w-8 text-white transition-transform duration-300 hover:rotate-12" />
                </div>
                <h3 className="text-white text-center font-semibold">Hitta rätt. Snabbt. Enkelt.</h3>
              </div>

              <div className="space-y-3 animate-fade-in transition-all duration-300 hover:scale-105 hover:bg-white/5 p-4 rounded-xl cursor-pointer" style={{animationDelay: '0.6s'}}>
                <div className="p-4 rounded-full w-16 h-16 mx-auto flex items-center justify-center bg-white/20 backdrop-blur-sm transition-all duration-300 hover:bg-white/30 hover:scale-110">
                  <Heart className="h-8 w-8 text-white transition-transform duration-300 hover:rotate-12" />
                </div>
                <h3 className="text-white text-center font-semibold">Jobbmatchning på ett helt nytt sätt</h3>
              </div>
            </div>

            <div className="text-center mt-8">
              <p className="text-lg md:text-xl text-white max-w-md mx-auto drop-shadow-sm font-semibold">Låt oss skapa din profil tillsammans</p>
            </div>
          </div>
        );

      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <div className="bg-white/20 backdrop-blur-sm p-4 rounded-full w-fit mx-auto mb-4">
                <User className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold mb-2 text-white">Låt oss lära känna dig</h2>
            </div>
            
            <div className="space-y-4 max-w-md mx-auto">
              <div>
                <Label htmlFor="firstName" className="text-white">Förnamn</Label>
                <Input 
                  id="firstName" 
                  value={formData.firstName} 
                  onChange={(e) => handleInputChange('firstName', e.target.value)} 
                  placeholder="Ditt förnamn" 
                  className="text-base" 
                />
              </div>
              <div>
                <Label htmlFor="lastName" className="text-white">Efternamn</Label>
                <Input 
                  id="lastName" 
                  value={formData.lastName} 
                  onChange={(e) => handleInputChange('lastName', e.target.value)} 
                  placeholder="Ditt efternamn" 
                  className="text-base" 
                />
              </div>
              <div>
                <Label htmlFor="email" className="text-white">E-post</Label>
                <Input 
                  id="email" 
                  type="email"
                  value={formData.email} 
                  onChange={(e) => handleInputChange('email', e.target.value)} 
                  placeholder="Din e-postadress" 
                  className="text-base" 
                />
              </div>
              <div>
                <Label htmlFor="birthDate" className="text-white">Födelsedatum</Label>
                <Input 
                  id="birthDate" 
                  type={inputType}
                  value={formData.birthDate} 
                  onChange={(e) => handleInputChange('birthDate', e.target.value)} 
                  onFocus={() => setInputType('date')}
                  onBlur={() => {
                    if (!formData.birthDate) {
                      setInputType('text');
                    }
                  }}
                  className="text-base custom-date-input" 
                  max={new Date().toISOString().split('T')[0]}
                  min="1920-01-01"
                  placeholder="åååå-mm-dd"
                />
              </div>
              <div>
                <Label htmlFor="homeLocation" className="text-white">Var bor du?</Label>
                <Input 
                  id="homeLocation" 
                  value={formData.homeLocation} 
                  onChange={(e) => handleInputChange('homeLocation', e.target.value)} 
                  placeholder="Din bostadsort" 
                  className="text-base" 
                />
              </div>
              <div>
                <Label htmlFor="phone" className="text-white">
                  <Phone className="h-4 w-4 inline mr-2" />
                  Telefonnummer
                </Label>
                <Input 
                  id="phone" 
                  type="tel" 
                  required
                  value={formData.phone} 
                  onChange={(e) => handlePhoneChange(e.target.value)} 
                  className="text-base" 
                  placeholder="070-123 45 67" 
                />
                {phoneError && <p className="text-destructive text-xs mt-1">{phoneError}</p>}
              </div>
              <div>
                <Label htmlFor="employmentStatus" className="text-white text-sm font-medium">Vad gör du i dagsläget?</Label>
                <Select 
                  value={formData.employmentStatus} 
                  onValueChange={(value) => handleInputChange('employmentStatus', value)}
                >
                  <SelectTrigger className="text-base focus:ring-0 focus:ring-offset-0 focus:border-input">
                    <SelectValue placeholder="Välj din nuvarande situation" />
                  </SelectTrigger>
                  <SelectContent className="w-full min-w-[var(--radix-select-trigger-width)] max-h-[200px] overflow-y-auto bg-background border border-border shadow-xl rounded-lg z-50">
                    <SelectItem value="tillsvidareanställning" className="h-11 text-sm px-3 hover:bg-accent/30 focus:bg-accent/40 cursor-pointer transition-colors">
                      Fast anställning
                    </SelectItem>
                    <SelectItem value="visstidsanställning" className="h-11 text-sm px-3 hover:bg-accent/30 focus:bg-accent/40 cursor-pointer transition-colors">
                      Visstidsanställning
                    </SelectItem>
                    <SelectItem value="provanställning" className="h-11 text-sm px-3 hover:bg-accent/30 focus:bg-accent/40 cursor-pointer transition-colors">
                      Provanställning
                    </SelectItem>
                    <SelectItem value="interim" className="h-11 text-sm px-3 hover:bg-accent/30 focus:bg-accent/40 cursor-pointer transition-colors">
                      Interim anställning
                    </SelectItem>
                    <SelectItem value="bemanningsanställning" className="h-11 text-sm px-3 hover:bg-accent/30 focus:bg-accent/40 cursor-pointer transition-colors">
                      Bemanningsanställning
                    </SelectItem>
                    <SelectItem value="egenforetagare" className="h-11 text-sm px-3 hover:bg-accent/30 focus:bg-accent/40 cursor-pointer transition-colors">
                      Egenföretagare / Frilans
                    </SelectItem>
                    <SelectItem value="arbetssokande" className="h-11 text-sm px-3 hover:bg-accent/30 focus:bg-accent/40 cursor-pointer transition-colors">
                      Arbetssökande
                    </SelectItem>
                    <SelectItem value="annat" className="h-11 text-sm px-3 hover:bg-accent/30 focus:bg-accent/40 cursor-pointer transition-colors">
                      Annat
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {/* Visa arbetstid-frågan endast om användaren har valt något OCH det inte är arbetssökande */}
              {formData.employmentStatus && formData.employmentStatus !== 'arbetssokande' && (
                <div>
                  <Label htmlFor="workingHours" className="text-white text-sm font-medium">Hur mycket jobbar du idag?</Label>
                  <Select 
                    value={formData.workingHours} 
                    onValueChange={(value) => handleInputChange('workingHours', value)}
                  >
                    <SelectTrigger className="text-base focus:ring-0 focus:ring-offset-0 focus:border-input">
                      <SelectValue placeholder="Välj arbetstid/omfattning" />
                    </SelectTrigger>
                    <SelectContent className="w-full min-w-[var(--radix-select-trigger-width)] max-h-[200px] overflow-y-auto bg-background border border-border shadow-xl rounded-lg z-50">
                      <SelectItem value="heltid" className="h-11 text-sm px-3 hover:bg-accent/30 focus:bg-accent/40 cursor-pointer transition-colors">
                        Heltid
                      </SelectItem>
                      <SelectItem value="deltid" className="h-11 text-sm px-3 hover:bg-accent/30 focus:bg-accent/40 cursor-pointer transition-colors">
                        Deltid
                      </SelectItem>
                      <SelectItem value="varierande" className="h-11 text-sm px-3 hover:bg-accent/30 focus:bg-accent/40 cursor-pointer transition-colors">
                        Varierande / Flexibelt
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              {/* Visa tillgänglighet-frågan endast om användaren har valt något i employment status */}
              {formData.employmentStatus && (
                <div>
                  <Label htmlFor="availability" className="text-white text-sm font-medium">När kan du börja nytt jobb?</Label>
                  <Select 
                    value={formData.availability} 
                    onValueChange={(value) => handleInputChange('availability', value)}
                  >
                    <SelectTrigger className="text-base focus:ring-0 focus:ring-offset-0 focus:border-input">
                      <SelectValue placeholder="Välj din tillgänglighet" />
                    </SelectTrigger>
                    <SelectContent className="w-full min-w-[var(--radix-select-trigger-width)] max-h-[200px] overflow-y-auto bg-background border border-border shadow-xl rounded-lg z-50">
                      <SelectItem value="omgaende" className="h-11 text-sm px-3 hover:bg-accent/30 focus:bg-accent/40 cursor-pointer transition-colors">
                        Omgående
                      </SelectItem>
                      <SelectItem value="inom-1-manad" className="h-11 text-sm px-3 hover:bg-accent/30 focus:bg-accent/40 cursor-pointer transition-colors">
                        Inom 1 månad
                      </SelectItem>
                      <SelectItem value="inom-3-manader" className="h-11 text-sm px-3 hover:bg-accent/30 focus:bg-accent/40 cursor-pointer transition-colors">
                        Inom 3 månader
                      </SelectItem>
                      <SelectItem value="osaker" className="h-11 text-sm px-3 hover:bg-accent/30 focus:bg-accent/40 cursor-pointer transition-colors">
                        Osäker
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold mb-4 text-white">Profilbild/Profilvideo</h2>
              <p className="text-white mb-6">Ladda upp en kort profilvideo eller en bild och gör ditt första intryck minnesvärt.</p>
              
              {/* Video and Camera Icons */}
              <div className="flex items-center justify-center space-x-4 mb-4">
                {/* Video option */}
                <div className="relative">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-4 border-white/20 p-2 bg-gradient-to-b from-white/10 to-white/5 backdrop-blur-sm">
                    <div className="relative w-full h-full rounded-full bg-gradient-to-b from-primary/30 to-primary/50 overflow-hidden flex items-center justify-center">
                      <Video className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
                    </div>
                  </div>
                  <div className="absolute -top-1 -right-1 bg-white rounded-full p-1.5 shadow-lg">
                    <Play className="h-3 w-3 text-primary animate-pulse" />
                  </div>
                </div>

                {/* "eller" text */}
                <div className="text-white/80 text-sm font-medium flex-shrink-0">
                  eller
                </div>

                {/* Image option */}
                <div className="relative">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-4 border-white/20 p-2 bg-gradient-to-b from-white/10 to-white/5 backdrop-blur-sm">
                    <div className="relative w-full h-full rounded-full bg-gradient-to-b from-primary/30 to-primary/50 overflow-hidden flex items-center justify-center">
                      <Camera className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
                    </div>
                  </div>
                  <div className="absolute -top-1 -right-1 bg-white rounded-full p-1.5 shadow-lg">
                    <Camera className="h-2 w-2 text-primary" />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-center space-y-4">
              <div className="relative">
                {formData.profileImageUrl && formData.profileMediaType === 'video' ? (
                  <ProfileVideo
                    videoUrl={formData.profileImageUrl}
                    coverImageUrl={formData.coverImageUrl}
                    alt="Profile video"
                    className="w-32 h-32 cursor-pointer border-4 border-white/20 hover:border-white/40 transition-all rounded-full overflow-hidden"
                  />
                ) : (
                  <Avatar className="w-32 h-32 cursor-pointer border-4 border-white/20 hover:border-white/40 transition-all" onClick={() => document.getElementById('profileMedia')?.click()}>
                    {formData.profileImageUrl ? (
                      <AvatarImage src={formData.profileImageUrl} alt="Profile picture" />
                    ) : (
                      <AvatarFallback className="text-2xl bg-white/20 text-white">{formData.firstName?.[0]}{formData.lastName?.[0]}</AvatarFallback>
                    )}
                  </Avatar>
                )}
                
                {/* Delete icon for profile media */}
                {formData.profileImageUrl && (
                  <button
                    onClick={deleteProfileMedia}
                    className="absolute -top-2 -right-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white rounded-full p-2 shadow-lg transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="space-y-2 text-center">
                <Label htmlFor="profileMedia" className="text-white cursor-pointer hover:text-white/80 transition-colors">
                  Klicka för att välja en bild eller video (max 30 sek)
                </Label>
                <Input type="file" id="profileMedia" accept="image/*,video/*" className="hidden" onChange={handleMediaChange} disabled={isUploadingVideo} />
                
                {isUploadingVideo && (
                  <Badge variant="secondary" className="bg-blue-500/20 text-blue-100 animate-pulse">
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-100 mr-2"></div>
                    Laddar upp video...
                  </Badge>
                )}
                
                {formData.profileImageUrl && !isUploadingVideo && (
                  <Badge variant="secondary" className="bg-white/20 text-white mt-12">
                    <Check className="h-3 w-3 mr-1" />
                    {formData.profileMediaType === 'video' ? 'Video' : 'Bild'} uppladdad!
                  </Badge>
                )}
              </div>

              {/* Cover image upload for videos */}
              {formData.profileMediaType === 'video' && formData.profileImageUrl && (
                <div className="space-y-2 text-center mt-4 p-4 bg-white/10 rounded-lg backdrop-blur-sm relative">
                  <Label htmlFor="coverImage" className="text-white text-sm">
                    Cover-bild för video (valfritt)
                  </Label>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => document.getElementById('coverImage')?.click()}
                    disabled={isUploadingCover}
                    className="bg-white/20 border-white/30 text-white hover:bg-white/30 disabled:opacity-50"
                  >
                    {formData.coverImageUrl ? 'Ändra cover-bild' : 'Lägg till cover-bild'}
                  </Button>
                  <Input type="file" id="coverImage" accept="image/*" className="hidden" onChange={handleCoverChange} disabled={isUploadingCover} />
                  
                  {isUploadingCover && (
                    <Badge variant="secondary" className="bg-blue-500/20 text-blue-100 text-xs animate-pulse">
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-100 mr-1"></div>
                      Laddar upp cover-bild...
                    </Badge>
                  )}
                  
                  {formData.coverImageUrl && !isUploadingCover && (
                    <div className="flex items-center justify-center gap-2">
                      <Badge variant="secondary" className="bg-white/20 text-white text-xs">
                        <Check className="h-3 w-3 mr-1" />
                        Cover-bild uppladdad!
                      </Badge>
                      <button
                        onClick={deleteCoverImage}
                        className="bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white rounded-full p-1.5 shadow-lg transition-colors"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <div className="bg-white/20 backdrop-blur-sm p-4 rounded-full w-fit mx-auto mb-4">
                <FileText className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold mb-2 text-white">CV</h2>
              <p className="text-white">Ladda upp ditt CV för att visa din erfarenhet</p>
            </div>

            <div className="flex flex-col items-center space-y-4">
              <FileUpload onFileUploaded={(url) => handleInputChange('cvUrl', url)} onFileRemoved={() => handleInputChange('cvUrl', '')} acceptedFileTypes={['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']} maxFileSize={10 * 1024 * 1024} currentFile={formData.cvUrl ? { url: formData.cvUrl, name: 'CV' } : undefined} />
              {formData.cvUrl && (
                <Badge variant="secondary" className="bg-white/20 text-white">
                  <Check className="h-3 w-3 mr-1" />
                  CV uppladdat!
                </Badge>
              )}
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <div className="bg-white/20 backdrop-blur-sm p-4 rounded-full w-fit mx-auto mb-4">
                <Briefcase className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold mb-2 text-white">Din profil</h2>
              <p className="text-white">Ge en kortare beskrivning om dig själv?</p>
            </div>

            <div className="space-y-4 max-w-md mx-auto">
              <div>
                <Label htmlFor="bio" className="text-white">Frivilligt</Label>
                <Textarea
                  id="bio"
                  className="text-base" 
                  value={formData.bio}
                  onChange={(e) => handleInputChange('bio', e.target.value)}
                  placeholder="Berätta kort om dig själv..."
                />
                <div className="flex justify-end mt-1">
                  <span className="text-xs text-white/70">
                    {countWords(formData.bio)}/100 ord
                  </span>
                </div>
              </div>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <div className="bg-white/20 backdrop-blur-sm p-4 rounded-full w-fit mx-auto mb-4">
                <Star className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold mb-2 text-white">Intressen (valfritt)</h2>
              <p className="text-white">Välj några intressen som matchar dina mål</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-md mx-auto">
              {['Frontend', 'Backend', 'Design', 'Marknadsföring', 'Sälj', 'HR'].map(interest => (
                <Button
                  key={interest}
                  variant={formData.interests.includes(interest) ? 'default' : 'outline'}
                  className="w-full"
                  onClick={() => toggleInterest(interest)}
                >
                  {interest}
                </Button>
              ))}
            </div>
          </div>
        );

      case 6:
        return (
          <div className="text-center space-y-6">
            <div className="bg-white/20 backdrop-blur-sm p-4 rounded-full w-fit mx-auto mb-4">
              <Check className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-white">Profil skapad!</h2>
            <p className="text-lg text-white/80">
              Välkommen till Parium! Din profil är nu skapad och du kan börja söka jobb.
            </p>
            <img src={phoneWithPariumLogo} alt="Parium på en mobiltelefon" className="max-w-sm mx-auto rounded-xl shadow-lg" />
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
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/95 to-primary-dark"></div>
        
        {/* Soft fade at bottom to prevent hard edges */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-primary-dark via-primary-dark/80 to-transparent"></div>
        
        {/* Animated floating elements - completely isolated from layout changes */}
        <div className="fixed top-20 left-10 w-4 h-4 bg-secondary/30 rounded-full animate-bounce pointer-events-none z-[1]" style={{ animationDuration: '2s' }}></div>
        <div className="fixed top-32 left-16 w-2 h-2 bg-accent/40 rounded-full animate-bounce pointer-events-none z-[1]" style={{ animationDuration: '2.5s' }}></div>
        <div className="fixed top-24 left-20 w-3 h-3 bg-secondary/20 rounded-full animate-bounce pointer-events-none z-[1]" style={{ animationDuration: '3s' }}></div>
        
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
            
            {currentStep === totalSteps - 2 ? (
              <Button
                onClick={handleSubmit}
                disabled={!isStepValid() || isSubmitting}
                className="flex-1 py-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 hover:scale-105 transition-transform duration-200 text-white font-semibold text-lg"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Skapar profil...
                  </>
                ) : (
                  <>
                    Skapa profil
                    <Check className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            ) : (
              <Button
                onClick={handleNext}
                disabled={!isStepValid()}
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
      
      {/* Image Editors */}
      <ImageEditor
        isOpen={imageEditorOpen}
        onClose={() => {
          setImageEditorOpen(false);
          setPendingImageSrc('');
        }}
        imageSrc={pendingImageSrc}
        onSave={handleProfileImageSave}
        isCircular={true}
      />
      
      <ImageEditor
        isOpen={coverEditorOpen}
        onClose={() => {
          setCoverEditorOpen(false);
          setPendingCoverSrc('');
        }}
        imageSrc={pendingCoverSrc}
        onSave={handleCoverImageSave}
        isCircular={false}
        aspectRatio={16/9}
      />
    </div>
  );
};

export default WelcomeTunnel;
