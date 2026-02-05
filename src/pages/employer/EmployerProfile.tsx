import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertDialogContentNoFocus } from "@/components/ui/alert-dialog-no-focus";
import { useAuth } from '@/hooks/useAuth';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { useMediaUrl } from '@/hooks/useMediaUrl';
import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from '@/hooks/use-toast';
import { Linkedin, Twitter, ExternalLink, Instagram, Trash2, Plus, Globe, ChevronDown, AlertTriangle, Camera, Pencil, RotateCcw, WifiOff } from 'lucide-react';
import { useOnline } from '@/hooks/useOnlineStatus';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import ImageEditor from '@/components/ImageEditor';
import { uploadMedia, getMediaUrl } from '@/lib/mediaManager';

// localStorage key för draft
const DRAFT_KEY = 'parium_draft_employer-profile';

interface SocialMediaLink {
  platform: 'linkedin' | 'twitter' | 'instagram' | 'annat';
  url: string;
}

const SOCIAL_PLATFORMS = [
  { value: 'linkedin', label: 'LinkedIn', icon: Linkedin },
  { value: 'twitter', label: 'Twitter/X', icon: Twitter },
  { value: 'instagram', label: 'Instagram', icon: Instagram },
  { value: 'annat', label: 'Annat', icon: Globe },
];

const EmployerProfile = () => {
  const { profile, updateProfile, user, userRole } = useAuth();
  const { hasUnsavedChanges, setHasUnsavedChanges } = useUnsavedChanges();
  const [loading, setLoading] = useState(false);
  const [originalValues, setOriginalValues] = useState<any>({});
  const [linkToDelete, setLinkToDelete] = useState<{ link: SocialMediaLink; index: number } | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  
  // Image editor states
  const [imageEditorOpen, setImageEditorOpen] = useState(false);
  const [pendingImageSrc, setPendingImageSrc] = useState<string>('');
  const [originalProfileImageFile, setOriginalProfileImageFile] = useState<File | null>(null);
  const [originalProfileImageUrl, setOriginalProfileImageUrl] = useState<string>(''); // Storage path för original
  const fileInputRef = useRef<HTMLInputElement>(null);
  const didInitRef = useRef(false);
  
  // Undo state - spara borttagen bild för återställning
  const [deletedProfileImage, setDeletedProfileImage] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    first_name: profile?.first_name || '',
    last_name: profile?.last_name || '',
    bio: profile?.bio || '',
    location: profile?.location || '',
    phone: profile?.phone || '',
    profile_image_url: profile?.profile_image_url || '',
    social_media_links: (profile as any)?.social_media_links || [] as SocialMediaLink[],
  });

  // Konvertera storage path till signerad URL för visning
  const profileImageUrl = useMediaUrl(formData.profile_image_url, 'profile-image');

  const [newSocialLink, setNewSocialLink] = useState({
    platform: '' as SocialMediaLink['platform'] | '',
    url: ''
  });

  const [platformMenuOpen, setPlatformMenuOpen] = useState(false);

  // Update form data when profile changes OR restore from localStorage draft
  useEffect(() => {
    if (!profile) return;

    // Viktigt: skriv inte över lokala (osparade) ändringar, annars "kommer bilden tillbaka"
    // om profilen råkar uppdateras i bakgrunden.
    if (didInitRef.current && hasUnsavedChanges) return;

    // Check for saved draft in localStorage
    let savedDraft = null;
    try {
      const stored = localStorage.getItem(DRAFT_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Handle both old format (direct formData) and new format (with savedAt)
        savedDraft = parsed.formData || parsed;
      }
    } catch (e) {
      console.warn('Failed to load draft:', e);
    }

    const values = {
      first_name: profile.first_name || '',
      last_name: profile.last_name || '',
      bio: profile.bio || '',
      location: profile.location || '',
      phone: profile.phone || '',
      profile_image_url: profile.profile_image_url || '',
      social_media_links: (profile as any)?.social_media_links || [],
    };

    // If we have a saved draft with different content, use it
    if (savedDraft && !didInitRef.current) {
      const hasDraftContent = Object.keys(savedDraft).some(key => {
        if (key === 'social_media_links') {
          return JSON.stringify(savedDraft[key]) !== JSON.stringify(values[key as keyof typeof values]);
        }
        return savedDraft[key] !== values[key as keyof typeof values];
      });

      if (hasDraftContent) {
        setFormData(savedDraft);
        setOriginalValues(values);
        setHasUnsavedChanges(true);
        didInitRef.current = true;
        console.log('📝 Draft restored for employer-profile');
        return;
      }
    }

    setFormData(values);
    setOriginalValues(values);
    setHasUnsavedChanges(false);
    didInitRef.current = true;
  }, [profile, hasUnsavedChanges, setHasUnsavedChanges]);

  const checkForChanges = useCallback(() => {
    if (!originalValues.first_name && !originalValues.last_name && !originalValues.bio && !originalValues.location && !originalValues.phone && !originalValues.social_media_links) return false;
    
    const hasChanges = Object.keys(formData).some(key => {
      if (key === 'social_media_links') {
        return JSON.stringify(formData[key]) !== JSON.stringify(originalValues[key]);
      }
      return formData[key] !== originalValues[key];
    });

    setHasUnsavedChanges(hasChanges);
    return hasChanges;
  }, [originalValues, formData, setHasUnsavedChanges]);

  // Check for changes whenever form values change + auto-save to localStorage
  useEffect(() => {
    const hasChanges = checkForChanges();
    
    // Auto-save draft to localStorage when there are changes
    if (hasChanges) {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({
          formData,
          savedAt: Date.now()
        }));
      } catch (e) {
        console.warn('Failed to save draft:', e);
      }
    }
  }, [checkForChanges, formData]);

  // Prevent leaving page with unsaved changes (browser/tab close)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = 'Du har osparade ändringar. Är du säker på att du vill lämna sidan?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  // Hantera bildval och öppna editor
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith('image/')) {
      // Spara originalfilen för framtida redigeringar
      setOriginalProfileImageFile(file);
      const imageUrl = URL.createObjectURL(file);
      setPendingImageSrc(imageUrl);
      setImageEditorOpen(true);
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
    // 1. Om vi har originalfilen i minnet (just uppladdad), använd den
    if (originalProfileImageFile) {
      const blobUrl = URL.createObjectURL(originalProfileImageFile);
      setPendingImageSrc(blobUrl);
      setImageEditorOpen(true);
      return;
    }

    // 2. Om vi har sparad original i storage, använd den
    if (originalProfileImageUrl) {
      try {
        const signedUrl = await getMediaUrl(originalProfileImageUrl, 'profile-image', 3600);
        if (signedUrl) {
          setPendingImageSrc(signedUrl);
          setImageEditorOpen(true);
          return;
        }
      } catch (error) {
        console.error('Error loading original image:', error);
        // Fallback till beskuren bild
      }
    }

    // 3. Fallback: Hämta den beskurna bilden (om ingen original finns)
    if (formData.profile_image_url) {
      try {
        const signedUrl = await getMediaUrl(formData.profile_image_url, 'profile-image', 3600);
        if (signedUrl) {
          setPendingImageSrc(signedUrl);
          setImageEditorOpen(true);
        }
      } catch (error) {
        console.error('Error loading image for editing:', error);
        toast({
          title: "Kunde inte ladda bilden",
          description: "Försök ladda upp en ny bild istället.",
          variant: "destructive"
        });
      }
    }
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

      // Om vi har originalfilen, spara den också i storage för framtida redigeringar
      if (originalProfileImageFile && !originalProfileImageUrl) {
        try {
          // Skapa en unik fil med "original" prefix för att skilja från den beskurna versionen
          const fileExt = originalProfileImageFile.name.split('.').pop() || 'jpg';
          const timestamp = Date.now();
          const originalFileName = `${user.id}/original-${timestamp}.${fileExt}`;
          
          const { error: origError } = await supabase.storage
            .from('job-applications')
            .upload(originalFileName, originalProfileImageFile);
          
          if (!origError) {
            setOriginalProfileImageUrl(originalFileName);
          }
        } catch (origErr) {
          console.error('Failed to save original image:', origErr);
          // Non-critical, continue
        }
      }

      // Uppdatera formData
      setFormData(prev => ({ ...prev, profile_image_url: storagePath }));
      setDeletedProfileImage(null); // Rensa undo-state
      setHasUnsavedChanges(true);
      
      setImageEditorOpen(false);
      if (pendingImageSrc) {
        URL.revokeObjectURL(pendingImageSrc);
      }
      setPendingImageSrc('');

      toast({
        title: "Profilbild uppladdad!",
        description: "Tryck på \"Spara ändringar\" för att spara din profilbild."
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

  // Ta bort profilbild
  const handleRemoveProfileImage = () => {
    // Spara nuvarande bild för undo
    const currentImage = formData.profile_image_url || originalValues.profile_image_url;
    if (currentImage) {
      setDeletedProfileImage(currentImage);
    }
    
    setFormData(prev => ({ ...prev, profile_image_url: '' }));
    setOriginalProfileImageFile(null);
    setHasUnsavedChanges(true);
    toast({
      title: "Profilbild borttagen",
      description: "Tryck på \"Spara ändringar\" för att bekräfta."
    });
  };

  // Återställ borttagen profilbild
  const restoreProfileImage = () => {
    if (!deletedProfileImage) return;
    
    setFormData(prev => ({ ...prev, profile_image_url: deletedProfileImage }));
    setDeletedProfileImage(null);
    setHasUnsavedChanges(true);
    toast({
      title: "Profilbild återställd",
      description: "Tryck på \"Spara ändringar\" för att bekräfta."
    });
  };

  // Reset form to original values when user confirms leaving without saving
  useEffect(() => {
    const onUnsavedConfirm = () => {
      if (!originalValues) return;
      setFormData({ ...originalValues });
      // IMPORTANT: user chose to discard changes -> clear local draft as well
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {}
      setHasUnsavedChanges(false);
    };
    window.addEventListener('unsaved-confirm', onUnsavedConfirm as EventListener);
    return () => window.removeEventListener('unsaved-confirm', onUnsavedConfirm as EventListener);
  }, [originalValues, setHasUnsavedChanges]);

  const validateUrl = (url: string, platform: string) => {
    if (!url.trim()) return true;
    
    try {
      const validUrl = new URL(url);
      
      if (platform === 'linkedin') {
        return validUrl.hostname === 'www.linkedin.com' || validUrl.hostname === 'linkedin.com';
      }
      
      if (platform === 'twitter') {
        return validUrl.hostname === 'www.twitter.com' || validUrl.hostname === 'twitter.com' || 
               validUrl.hostname === 'www.x.com' || validUrl.hostname === 'x.com';
      }
      
      if (platform === 'instagram') {
        return validUrl.hostname === 'www.instagram.com' || validUrl.hostname === 'instagram.com';
      }
      
      return true; // For "annat" allow any valid URL
    } catch {
      return false;
    }
  };

  const addSocialLink = () => {
    if (!newSocialLink.platform || !newSocialLink.url.trim()) {
      toast({
        title: "Ofullständig information",
        description: "Välj en plattform och ange en URL",
        variant: "destructive"
      });
      return;
    }

    if (!validateUrl(newSocialLink.url, newSocialLink.platform)) {
      toast({
        title: "Ogiltig URL",
        description: `Ange en giltig URL för ${SOCIAL_PLATFORMS.find(p => p.value === newSocialLink.platform)?.label}`,
        variant: "destructive"
      });
      return;
    }

    // Check if platform already exists (except for "annat" which can have multiple entries)
    if (newSocialLink.platform !== 'annat') {
      const existingPlatform = formData.social_media_links.find(link => link.platform === newSocialLink.platform);
      if (existingPlatform) {
        toast({
          title: "Plattform finns redan",
          description: "Du har redan lagt till denna plattform. Ta bort den först om du vill ändra länken.",
          variant: "destructive"
        });
        return;
      }
    }

    const updatedLinks = [...formData.social_media_links, newSocialLink as SocialMediaLink];
    
    // Update local state and mark as unsaved
    setFormData({
      ...formData,
      social_media_links: updatedLinks
    });
    setHasUnsavedChanges(true);
    
    setNewSocialLink({ platform: '', url: '' });
    
    toast({
      title: "Länk tillagd",
      description: `${SOCIAL_PLATFORMS.find(p => p.value === newSocialLink.platform)?.label}-länken har lagts till. Glöm inte att spara!`,
    });
  };

  const handleRemoveLinkClick = (index: number) => {
    const link = formData.social_media_links[index];
    setLinkToDelete({ link, index });
    setDeleteDialogOpen(true);
  };

  const confirmRemoveSocialLink = () => {
    if (!linkToDelete) return;

    const updatedLinks = formData.social_media_links.filter((_, i) => i !== linkToDelete.index);
    
    const updatedFormData = { 
      ...formData, 
      social_media_links: [...updatedLinks]
    };

    // Update local state only - user must save manually
    setFormData(updatedFormData);
    setHasUnsavedChanges(true);

    toast({
      title: "Länk borttagen",
      description: `${getPlatformLabel(linkToDelete.link.platform)}-länken har tagits bort. Klicka på Spara ändringar för att bekräfta.`,
    });

    setDeleteDialogOpen(false);
    setLinkToDelete(null);
  };

  const { isOnline, showOfflineToast } = useOnline();

  const handleSave = async () => {
    // Check if online before saving
    if (!isOnline) {
      showOfflineToast();
      return;
    }

    // Validate all social media URLs
    for (const link of formData.social_media_links) {
      if (!validateUrl(link.url, link.platform)) {
        toast({
          title: "Ogiltig URL",
          description: `Kontrollera URL:en för ${SOCIAL_PLATFORMS.find(p => p.value === link.platform)?.label}`,
          variant: "destructive"
        });
        return;
      }
    }

    try {
      setLoading(true);
      await updateProfile(formData as any);

      // Deep clone to ensure proper comparison
      const updatedValues = {
        ...formData,
        social_media_links: JSON.parse(JSON.stringify(formData.social_media_links)),
      };

      // Sync form with saved values to avoid second click
      setFormData(updatedValues);
      setOriginalValues(updatedValues);
      setHasUnsavedChanges(false);
      
      // Clear localStorage draft after successful save
      try {
        localStorage.removeItem(DRAFT_KEY);
        console.log('🗑️ Draft cleared for employer-profile');
      } catch (e) {
        console.warn('Failed to clear draft:', e);
      }

      toast({
        title: "Profil uppdaterad",
        description: "Din profil har uppdaterats"
      });
    } catch (error) {
      toast({
        title: "Fel",
        description: "Kunde inte uppdatera profilen.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getPlatformIcon = (platform: SocialMediaLink['platform']) => {
    const platformData = SOCIAL_PLATFORMS.find(p => p.value === platform);
    if (!platformData) return Globe;
    return platformData.icon;
  };

  const getPlatformLabel = (platform: SocialMediaLink['platform']) => {
    const platformData = SOCIAL_PLATFORMS.find(p => p.value === platform);
    return platformData?.label || 'Okänd plattform';
  };

  return (
     <div className="space-y-8 max-w-4xl mx-auto px-3 md:px-8 animate-fade-in">
      <div className="text-center mb-6">
        <h1 className="text-xl md:text-2xl font-semibold text-white tracking-tight">Min Profil</h1>
      </div>

      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-6 md:p-4">
        <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-5 md:space-y-3">
            {/* Profilbild-sektion - matchar jobbsökarsidans stil */}
            <div className="flex flex-col items-center gap-4 pb-5 border-b border-white/10">
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
              />
              
              {/* Rubrik */}
              <h3 className="text-base font-semibold text-white text-center">
                Profilbild
              </h3>
              <p className="text-white text-center text-sm -mt-2">
                Ladda upp en profilbild som syns för kandidater
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

                {/* Soptunna/Undo-knapp som på jobbsökarsidan */}
                {deletedProfileImage && !profileImageUrl ? (
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
                ) : profileImageUrl ? (
                  <button
                    type="button"
                    aria-label="Ta bort profilbild"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleRemoveProfileImage();
                    }}
                    className="absolute -top-3 -right-3 z-20 pointer-events-auto bg-white/20 hover:bg-destructive/30 backdrop-blur-sm text-white rounded-full p-2 shadow-lg transition-colors"
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
                  Klicka för att ladda upp • Max 5MB
                </label>
                
                {/* Anpassa din bild-knapp om bild finns */}
                {profileImageUrl && (
                  <div className="flex flex-col items-center space-y-2">
                    <Badge variant="outline" className="bg-white/20 text-white border-white/20 px-3 py-1 rounded-md">
                      Bild uppladdad!
                    </Badge>
                    <button 
                      type="button"
                      onClick={handleEditExistingImage}
                      className="bg-white/5 backdrop-blur-sm border border-white/10 text-white hover:bg-white/10 hover:border-white/50 px-3 py-1 text-sm font-medium rounded-md transition-colors"
                    >
                      Anpassa din bild
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="first_name" className="text-sm text-white">Förnamn</Label>
                <Input
                  id="first_name"
                  value={formData.first_name}
                  onChange={(e) => setFormData({...formData, first_name: e.target.value})}
                  className="bg-white/5 border-white/10 hover:border-white/50 text-white placeholder:text-white h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="last_name" className="text-sm text-white">Efternamn</Label>
                <Input
                  id="last_name"
                  value={formData.last_name}
                  onChange={(e) => setFormData({...formData, last_name: e.target.value})}
                  className="bg-white/5 border-white/10 hover:border-white/50 text-white placeholder:text-white h-9 text-sm"
                />
              </div>
            </div>
            
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm text-white">E-post</Label>
              <Input
                id="email"
                value={user?.email || ''}
                readOnly
                className="bg-white/5 border-white/10 text-white h-9 text-sm cursor-not-allowed"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="role" className="text-sm text-white">Roll</Label>
              <Input
                id="role"
                value={userRole?.role === 'employer' ? 'Admin' : 'Jobbsökare'}
                readOnly
                className="bg-white/5 border-white/10 text-white h-9 text-sm cursor-not-allowed"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="location" className="text-sm text-white">Plats</Label>
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) => setFormData({...formData, location: e.target.value})}
                  placeholder="T.ex. Stockholm, Sverige"
                  className="bg-white/5 border-white/10 hover:border-white/50 text-white placeholder:text-white h-9 text-sm"
                />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="phone" className="text-sm text-white">Telefonnummer (frivilligt)</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  placeholder="T.ex. 070-123 45 67"
                  className="bg-white/5 border-white/10 hover:border-white/50 text-white placeholder:text-white h-9 text-sm"
                />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bio" className="text-sm text-white">Om mig</Label>
                <Textarea
                  id="bio"
                  value={formData.bio}
                  onChange={(e) => setFormData({...formData, bio: e.target.value})}
                  rows={3}
                  className="bg-white/5 border-white/10 hover:border-white/50 text-white placeholder:text-white text-sm"
                />
              <div className="text-right">
                <span className="text-white text-sm">
                  {formData.bio.trim() === '' ? 0 : formData.bio.trim().split(/\s+/).length} ord
                </span>
              </div>
            </div>

            {/* Social Media Links Section */}
            <div className="border-t border-white/10 pt-5 space-y-4">
              <div>
                <h4 className="text-base font-semibold text-white mb-1">Sociala medier</h4>
                <p className="text-sm text-white">Lägg till dina sociala medier-profiler</p>
              </div>

              {/* Existing social media links */}
              {formData.social_media_links.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm text-white">Dina sociala medier</Label>
                  {formData.social_media_links.map((link, index) => {
                    const Icon = getPlatformIcon(link.platform);
                    return (
                      <div key={index} className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-white/5 backdrop-blur-sm border border-white/10 hover:border-white/50 rounded-lg p-2 gap-2">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <Icon className="h-4 w-4 text-white flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="text-white text-sm font-medium">{getPlatformLabel(link.platform)}</div>
                            <a 
                              href={link.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1 break-all max-w-full"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <span className="truncate max-w-xs sm:max-w-sm md:max-w-md">
                                {link.url}
                              </span>
                              <ExternalLink className="h-3 w-3 flex-shrink-0" />
                            </a>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveLinkClick(index);
                          }}
                          className="bg-white/5 border-white/10 text-white transition-all duration-300 md:hover:bg-red-500/20 md:hover:border-red-500/40 md:hover:text-red-300 flex-shrink-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Add new social media link */}
              <div className="space-y-4 md:space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-3">
                  <DropdownMenu modal={false} open={platformMenuOpen} onOpenChange={setPlatformMenuOpen}>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full bg-white/5 border-white/10 text-white text-sm h-9 transition-all duration-300 md:hover:bg-white/10 md:hover:border-white/50 md:hover:text-white [&_svg]:text-white md:hover:[&_svg]:text-white justify-between text-left"
                      >
                        <span className="truncate text-left flex-1 px-1 text-sm">
                          {newSocialLink.platform ? SOCIAL_PLATFORMS.find(p => p.value === newSocialLink.platform)?.label : 'Välj plattform'}
                        </span>
                        <ChevronDown className="h-5 w-5 flex-shrink-0 opacity-50 ml-2" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent 
                      className="w-80 bg-slate-900/85 backdrop-blur-xl border border-white/20 shadow-lg z-50 rounded-md text-white overflow-hidden"
                      side="top"
                      align="center"
                      alignOffset={0}
                      sideOffset={8}
                      avoidCollisions={false}
                      onCloseAutoFocus={(e) => e.preventDefault()}
                    >
                      {/* Platform options */}
                      <div className="p-2">
                        {SOCIAL_PLATFORMS.map((platform) => {
                          // Allow multiple "annat" platforms, but only one of each other platform
                          const isDisabled = platform.value !== 'annat' && formData.social_media_links.some(link => link.platform === platform.value);
                          return (
                            <DropdownMenuItem
                              key={platform.value}
                              onSelect={(e) => e.preventDefault()}
                              className={`cursor-pointer hover:bg-white/10 active:bg-white/15 transition-colors px-3 py-2 focus:bg-white/10 rounded-md ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                              onClick={() => {
                                if (!isDisabled) {
                                  setNewSocialLink({...newSocialLink, platform: platform.value as SocialMediaLink['platform']});
                                  setPlatformMenuOpen(false);
                                }
                              }}
                              disabled={isDisabled}
                            >
                              <div className="flex items-center gap-2 w-full">
                                <platform.icon className="h-4 w-4 flex-shrink-0" />
                                <span className="text-white text-sm">
                                  {platform.label} {isDisabled && '(redan tillagd)'}
                                </span>
                              </div>
                            </DropdownMenuItem>
                          );
                        })}
                      </div>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <Input
                    value={newSocialLink.url}
                    onChange={(e) => setNewSocialLink({...newSocialLink, url: e.target.value})}
                    placeholder="Klistra in din sociala medier länk här"
                    className="bg-white/5 border-white/10 hover:border-white/50 text-white text-sm h-9 placeholder:text-white md:col-span-1"
                  />

                  <Button
                    type="button"
                    onClick={addSocialLink}
                    disabled={!newSocialLink.platform || !newSocialLink.url.trim()}
                    variant="glass"
                    className="h-9 text-sm"
                  >
                    Lägg till
                    <Plus className="h-3 w-3 ml-1.5" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex justify-center pt-1">
              <Button 
                type="submit"
                disabled={loading || !hasUnsavedChanges}
                variant="glass"
                className="h-9 px-6 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <div className="animate-spin w-3 h-3 border-2 border-current border-t-transparent rounded-full mr-2"></div>
                    Sparar...
                  </>
                ) : (
                  'Spara ändringar'
                )}
              </Button>
            </div>
          </form>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContentNoFocus 
          className="border-white/20 text-white w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] sm:max-w-md sm:w-[28rem] p-4 sm:p-6 bg-white/10 backdrop-blur-sm rounded-xl shadow-lg mx-0"
        >
          <AlertDialogHeader className="space-y-4 text-center">
            <div className="flex items-center justify-center gap-2.5">
              <div className="bg-red-500/20 p-2 rounded-full">
                <AlertTriangle className="h-4 w-4 text-red-400" />
              </div>
              <AlertDialogTitle className="text-white text-base md:text-lg font-semibold">
                Ta bort social medier-länk
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-white text-sm leading-relaxed">
              {linkToDelete && (
                <>
                  Är du säker på att du vill ta bort länken till <span className="font-semibold text-white">{getPlatformLabel(linkToDelete.link.platform)}</span>? Denna åtgärd går inte att ångra.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2 mt-4 sm:justify-center">
            <AlertDialogCancel 
              onClick={() => {
                setDeleteDialogOpen(false);
                setLinkToDelete(null);
              }}
              style={{ height: '44px', minHeight: '44px', padding: '0 1rem' }}
              className="flex-1 mt-0 flex items-center justify-center rounded-full bg-white/10 border-white/20 text-white text-sm transition-all duration-300 md:hover:bg-white/20 md:hover:text-white md:hover:border-white/50"
            >
              Avbryt
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRemoveSocialLink}
              variant="destructiveSoft"
              style={{ height: '44px', minHeight: '44px', padding: '0 1rem' }}
              className="flex-1 text-sm flex items-center justify-center rounded-full"
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              Ta bort
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContentNoFocus>
      </AlertDialog>

      {/* Image Editor */}
      <ImageEditor
        isOpen={imageEditorOpen}
        onClose={() => {
          setImageEditorOpen(false);
          if (pendingImageSrc) {
            URL.revokeObjectURL(pendingImageSrc);
          }
          setPendingImageSrc('');
        }}
        imageSrc={pendingImageSrc}
        onSave={handleProfileImageSave}
        isCircular={true}
      />
    </div>
  );
};

export default EmployerProfile;
