import { TEXT_LIMITS } from '@/lib/textLimits';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/useAuth';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { useMediaUrl } from '@/hooks/useMediaUrl';
import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from '@/hooks/use-toast';
import { Trash2, Camera, Pencil, RotateCcw, WifiOff } from 'lucide-react';
import { useOnline } from '@/hooks/useOnlineStatus';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import ImageEditor from '@/components/ImageEditor';
import { uploadMedia, getMediaUrl } from '@/lib/mediaManager';

// localStorage key för draft
const DRAFT_KEY = 'parium_draft_employer-profile';

const EmployerProfile = () => {
  const { profile, updateProfile, user, userRole } = useAuth();
  const { hasUnsavedChanges, setHasUnsavedChanges } = useUnsavedChanges();
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
    bio: profile?.bio || '',
    location: profile?.location || '',
    phone: profile?.phone || '',
    profile_image_url: profile?.profile_image_url || '',
  });

  // Konvertera storage path till signerad URL för visning
  const profileImageUrl = useMediaUrl(formData.profile_image_url, 'profile-image');


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
    };

    // If we have a saved draft with different content, use it
    if (savedDraft && !didInitRef.current) {
      const hasDraftContent = Object.keys(savedDraft).some(key => {
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
    if (!originalValues.first_name && !originalValues.last_name && !originalValues.bio && !originalValues.location && !originalValues.phone) return false;
    
    const hasChanges = Object.keys(formData).some(key => {
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
    
    // Priority 1: Use stored original URL from current session
    if (originalProfileImageUrl) {
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
          setOriginalProfileImageUrl(signedUrl);
          setOriginalProfileImageStoragePath(formData.profile_image_url);
          setPendingImageSrc(signedUrl);
          setIsEditingExistingProfileImage(true);
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
        }
      }

      // Uppdatera formData
      setFormData(prev => ({ ...prev, profile_image_url: storagePath }));
      setDeletedProfileImage(null); // Rensa undo-state
      setHasUnsavedChanges(true);
      setProfileImageIsEdited(true); // Mark as edited/cropped
      
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
      toast({
        title: "Bild återställd",
        description: "Originalbilden har återställts",
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
    setOriginalProfileImageUrl('');
    setOriginalProfileImageStoragePath('');
    setProfileImageIsEdited(false);
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

  const { isOnline, showOfflineToast } = useOnline();

  const handleSave = async () => {
    try {
      setLoading(true);
      await updateProfile(formData as any);

      const updatedValues = { ...formData };

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

  return (
     <div className="space-y-8 responsive-container animate-fade-in [padding-bottom:calc(env(safe-area-inset-bottom,0px)+50px)]">
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
                    className="absolute -top-3 -right-3 z-20 pointer-events-auto rounded-full border border-destructive/40 bg-destructive/20 p-2 text-white shadow-lg transition-colors md:hover:!border-destructive/50 md:hover:!bg-destructive/30 md:hover:!text-white"
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

            <div className="space-y-1.5">
              <Label htmlFor="location" className="text-sm text-white">Plats</Label>
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) => setFormData({...formData, location: e.target.value})}
                  placeholder="T.ex. Stockholm, Sverige"
                  className="bg-white/5 border-white/10 hover:border-white/50 text-white placeholder:text-white h-11 !min-h-0 text-sm"
                />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="phone" className="text-sm text-white">Telefonnummer (frivilligt)</Label>
                <Input
                  id="phone"
                  maxLength={TEXT_LIMITS.phone}
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  placeholder="T.ex. 070-123 45 67"
                  className="bg-white/5 border-white/10 hover:border-white/50 text-white placeholder:text-white h-11 !min-h-0 text-sm"
                />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bio" className="text-sm text-white">Om mig</Label>
                <Textarea
                  id="bio"
                  maxLength={TEXT_LIMITS.bio}
                  value={formData.bio}
                  onChange={(e) => setFormData({...formData, bio: e.target.value})}
                  rows={3}
                  className="bg-white/5 border-white/10 hover:border-white/50 text-white placeholder:text-white text-sm"
                />
              <div className="text-right">
                <span className="text-white text-sm">
                  {(() => {
                    const text = formData.bio.replace(/\s+/g, ' ').trim();
                    const words = text ? text.split(/\s+/).length : 0;
                    return `${words} ord · ${text.length} tecken`;
                  })()}
                </span>
              </div>
            </div>

            <div className="flex justify-center pt-1">
              <button
                type="submit"
                disabled={loading || !hasUnsavedChanges}
                className="bg-white/5 backdrop-blur-sm border border-white/10 text-white hover:bg-white/10 hover:border-white/50 px-6 h-11 !min-h-0 text-sm font-medium rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin w-3 h-3 border-2 border-current border-t-transparent rounded-full"></div>
                    Sparar...
                  </>
                ) : (
                  'Spara ändringar'
                )}
              </button>
            </div>
          </form>
      </div>


      {/* Image Editor */}
      <ImageEditor
        isOpen={imageEditorOpen}
        onClose={() => {
          setImageEditorOpen(false);
          setIsEditingExistingProfileImage(false);
          if (pendingImageSrc) {
            URL.revokeObjectURL(pendingImageSrc);
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
