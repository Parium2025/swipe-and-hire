import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/hooks/useAuth';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { useState, useEffect, useCallback } from 'react';
import { toast } from '@/hooks/use-toast';
import { Linkedin, Twitter, ExternalLink, Instagram, Trash2, Plus, Globe, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

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

  const [formData, setFormData] = useState({
    first_name: profile?.first_name || '',
    last_name: profile?.last_name || '',
    bio: profile?.bio || '',
    location: profile?.location || '',
    phone: profile?.phone || '',
    social_media_links: (profile as any)?.social_media_links || [] as SocialMediaLink[],
  });

  const [newSocialLink, setNewSocialLink] = useState({
    platform: '' as SocialMediaLink['platform'] | '',
    url: ''
  });

  const [platformMenuOpen, setPlatformMenuOpen] = useState(false);

  // Update form data when profile changes
  useEffect(() => {
    if (profile) {
      const values = {
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
        bio: profile.bio || '',
        location: profile.location || '',
        phone: profile.phone || '',
        social_media_links: (profile as any)?.social_media_links || [],
      };
      
      setFormData(values);
      setOriginalValues(values);
      setHasUnsavedChanges(false);
    }
  }, [profile, setHasUnsavedChanges]);

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

  // Check for changes whenever form values change
  useEffect(() => {
    checkForChanges();
  }, [checkForChanges]);

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

  // Reset form to original values when user confirms leaving without saving
  useEffect(() => {
    const onUnsavedConfirm = () => {
      if (!originalValues) return;
      setFormData({ ...originalValues });
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

  const removeSocialLink = (index: number) => {
    const linkToRemove = formData.social_media_links[index];
    const updatedLinks = formData.social_media_links.filter((_, i) => i !== index);
    
    // Update local state and mark as unsaved
    setFormData({ 
      ...formData, 
      social_media_links: updatedLinks 
    });
    setHasUnsavedChanges(true);
    
    toast({
      title: "Länk borttagen",
      description: `${getPlatformLabel(linkToRemove.platform)}-länken har tagits bort. Glöm inte att spara!`,
    });
  };

  const handleSave = async () => {
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
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="text-center mb-6">
        <h1 className="text-xl md:text-2xl font-semibold text-white mb-1">Min Profil</h1>
      </div>

      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-6 md:p-4">
        <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-5 md:space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="first_name" className="text-sm text-white">Förnamn</Label>
                <Input
                  id="first_name"
                  value={formData.first_name}
                  onChange={(e) => setFormData({...formData, first_name: e.target.value})}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/40 h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="last_name" className="text-sm text-white">Efternamn</Label>
                <Input
                  id="last_name"
                  value={formData.last_name}
                  onChange={(e) => setFormData({...formData, last_name: e.target.value})}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/40 h-9 text-sm"
                />
              </div>
            </div>
            
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm text-white">E-post</Label>
              <Input
                id="email"
                value={user?.email || ''}
                readOnly
                className="bg-white/5 border-white/10 text-white/70 h-9 text-sm cursor-not-allowed"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="role" className="text-sm text-white">Roll</Label>
              <Input
                id="role"
                value={userRole?.role === 'employer' ? 'Admin' : userRole?.role === 'recruiter' ? 'Rekryteringsadmin' : userRole?.role || 'Användare'}
                readOnly
                className="bg-white/5 border-white/10 text-white/70 h-9 text-sm cursor-not-allowed"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="location" className="text-sm text-white">Plats</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => setFormData({...formData, location: e.target.value})}
                placeholder="T.ex. Stockholm, Sverige"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/40 h-9 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="phone" className="text-sm text-white">Telefonnummer (frivilligt)</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                placeholder="T.ex. 070-123 45 67"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/40 h-9 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bio" className="text-sm text-white">Om mig</Label>
              <Textarea
                id="bio"
                value={formData.bio}
                onChange={(e) => setFormData({...formData, bio: e.target.value})}
                rows={3}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/40 text-sm"
              />
              <div className="text-right">
                <span className="text-white/50 text-sm">
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
                      <div key={index} className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-2 gap-2">
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
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeSocialLink(index);
                          }}
                          className="bg-red-500/20 border-red-400/40 text-red-300 hover:bg-red-500/30 flex-shrink-0"
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
                      className="w-80 bg-slate-800/95 backdrop-blur-md border-slate-600/30 shadow-xl z-50 rounded-lg text-white overflow-hidden"
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
                    className="bg-white/5 border-white/10 text-white text-sm h-9 placeholder:text-white/40 md:col-span-1"
                  />

                  <Button
                    type="button"
                    onClick={addSocialLink}
                    disabled={!newSocialLink.platform || !newSocialLink.url.trim()}
                    className="bg-white/5 border border-white/10 text-white h-9 text-sm transition-all duration-300 md:hover:bg-white/10 md:hover:border-white/50 md:hover:text-white [&_svg]:text-white md:hover:[&_svg]:text-white disabled:opacity-50 disabled:cursor-not-allowed"
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
                className="disabled:opacity-50 disabled:cursor-not-allowed disabled:border-0 border border-white/30 text-white font-medium h-9 px-6 text-sm transition-all duration-300 md:hover:bg-white/10 md:hover:border-white/50"
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
    </div>
  );
};

export default EmployerProfile;
