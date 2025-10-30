import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from '@/hooks/useAuth';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { useState, useEffect, useCallback } from 'react';
import { toast } from '@/hooks/use-toast';
import ImageEditor from '@/components/ImageEditor';
import { Upload, Building2, Camera, ChevronDown, Search, Check, Trash2, Linkedin, Twitter, Instagram, Globe, ExternalLink, Plus, AlertTriangle } from 'lucide-react';
import { SWEDISH_INDUSTRIES } from '@/lib/industries';
import { supabase } from '@/integrations/supabase/client';
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

const CompanyProfile = () => {
  const { profile, updateProfile } = useAuth();
  const { hasUnsavedChanges, setHasUnsavedChanges } = useUnsavedChanges();
  const [loading, setLoading] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [originalValues, setOriginalValues] = useState<any>({});
  const [linkToDelete, setLinkToDelete] = useState<{ link: SocialMediaLink; index: number } | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [logoDeleteDialogOpen, setLogoDeleteDialogOpen] = useState(false);
  
  // Image editor states
  const [imageEditorOpen, setImageEditorOpen] = useState(false);
  const [pendingImageSrc, setPendingImageSrc] = useState<string>('');
  
  // Industry dropdown states
  const [industryMenuOpen, setIndustryMenuOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    company_name: profile?.company_name || '',
    org_number: profile?.org_number || '',
    industry: profile?.industry || '',
    address: profile?.address || '',
    website: profile?.website || '',
    company_description: profile?.company_description || '',
    employee_count: profile?.employee_count || '',
    company_logo_url: (profile as any)?.company_logo_url || '',
    company_social_media_links: (profile as any)?.company_social_media_links || [] as SocialMediaLink[],
  });

  const [newSocialLink, setNewSocialLink] = useState({
    platform: '' as SocialMediaLink['platform'] | '',
    url: ''
  });

  const [platformMenuOpen, setPlatformMenuOpen] = useState(false);

  // Validation state
  const [orgNumberError, setOrgNumberError] = useState('');

  // Update form data when profile changes
  useEffect(() => {
    if (profile) {
      const values = {
        company_name: profile.company_name || '',
        org_number: profile.org_number || '',
        industry: profile.industry || '',
        address: profile.address || '',
        website: profile.website || '',
        company_description: profile.company_description || '',
        employee_count: profile.employee_count || '',
        company_logo_url: (profile as any)?.company_logo_url || '',
        company_social_media_links: (profile as any)?.company_social_media_links || [],
      };
      
      setFormData(values);
      setOriginalValues(values);
      setHasUnsavedChanges(false);
    }
  }, [profile, setHasUnsavedChanges]);

  const checkForChanges = useCallback(() => {
    if (!originalValues.company_name) return false; // Not loaded yet
    
    const hasChanges = Object.keys(formData).some(key => {
      if (key === 'company_social_media_links') {
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
        .from('company-logos')
        .upload(fileName, editedBlob);

      if (uploadError) throw uploadError;

      // Use public URL for company logos (no expiration)
      const { data: { publicUrl } } = supabase.storage
        .from('company-logos')
        .getPublicUrl(fileName);

      const logoUrl = `${publicUrl}?t=${Date.now()}`;
      
      setFormData(prev => ({ ...prev, company_logo_url: logoUrl }));
      setImageEditorOpen(false);
      setPendingImageSrc('');
      
      // Mark as having unsaved changes
      setHasUnsavedChanges(true);
      
      toast({
        title: "Logga uppladdad!",
        description: "Tryck på \"Spara ändringar\" för att spara din företagslogga."
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

  const handleLogoDelete = () => {
    setLogoDeleteDialogOpen(true);
  };

  const confirmLogoDelete = () => {
    setFormData(prev => ({ ...prev, company_logo_url: '' }));
    setHasUnsavedChanges(true);
    setLogoDeleteDialogOpen(false);
    
    toast({
      title: "Logga borttagen",
      description: "Tryck på \"Spara ändringar\" för att bekräfta borttagningen."
    });
  };

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
      const existingPlatform = formData.company_social_media_links.find(link => link.platform === newSocialLink.platform);
      if (existingPlatform) {
        toast({
          title: "Plattform finns redan",
          description: "Du har redan lagt till denna plattform. Ta bort den först om du vill ändra länken.",
          variant: "destructive"
        });
        return;
      }
    }

    const updatedLinks = [...formData.company_social_media_links, newSocialLink as SocialMediaLink];
    
    // Update local state and mark as unsaved
    setFormData({
      ...formData,
      company_social_media_links: updatedLinks
    });
    setHasUnsavedChanges(true);
    
    setNewSocialLink({ platform: '', url: '' });
    
    toast({
      title: "Länk tillagd",
      description: `${SOCIAL_PLATFORMS.find(p => p.value === newSocialLink.platform)?.label}-länken har lagts till. Glöm inte att spara!`,
    });
  };

  const handleRemoveLinkClick = (index: number) => {
    const link = formData.company_social_media_links[index];
    setLinkToDelete({ link, index });
    setDeleteDialogOpen(true);
  };

  const confirmRemoveSocialLink = () => {
    if (!linkToDelete) return;

    const updatedLinks = formData.company_social_media_links.filter((_, i) => i !== linkToDelete.index);
    
    const updatedFormData = { 
      ...formData, 
      company_social_media_links: [...updatedLinks]
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

  const handleSave = async () => {
    // Validate organization number before saving
    if (formData.org_number && formData.org_number.replace(/-/g, '').length !== 10) {
      toast({
        title: "Valideringsfel",
        description: "Organisationsnummer måste vara exakt 10 siffror eller lämnas tomt.",
        variant: "destructive"
      });
      return;
    }

    // Validate all social media URLs
    for (const link of formData.company_social_media_links) {
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
        company_social_media_links: JSON.parse(JSON.stringify(formData.company_social_media_links)),
      };

      // Sync form with saved values to avoid second click
      setFormData(updatedValues);
      setOriginalValues(updatedValues);
      setHasUnsavedChanges(false);

      toast({
        title: "Företagsprofil uppdaterad",
        description: "Din företagsprofil har uppdaterats"
      });
    } catch (error) {
      toast({
        title: "Fel",
        description: "Kunde inte uppdatera företagsprofilen.",
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
        <h1 className="text-xl md:text-2xl font-semibold text-white mb-1">Företagslogga</h1>
        <p className="text-white">Ladda upp din företagslogga för att bygga kännedom och förtroende</p>
      </div>

      {/* Företagslogga sektion - Minimalistisk */}
      <div className="flex flex-col items-center space-y-4 py-6">
        <div className="relative">
          {formData.company_logo_url ? (
            <div className="w-32 h-32 rounded-full overflow-hidden bg-white/5 border border-white/10 flex items-center justify-center">
              <img 
                src={formData.company_logo_url} 
                alt="Företagslogga" 
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="w-32 h-32 rounded-full bg-white/5 border border-dashed border-white/20 flex items-center justify-center">
              <div className="text-center">
                <div className="text-2xl font-semibold text-white/60 mb-1">
                  {formData.company_name ? 
                    formData.company_name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2) : 
                    'HM'
                  }
                </div>
                <Building2 className="h-5 w-5 text-white/40 mx-auto" />
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Button 
            type="button"
            variant="outline" 
            size="sm"
            onClick={() => document.getElementById('logo-upload')?.click()}
            disabled={isUploadingLogo}
            className="bg-white/5 border-white/10 text-white transition-all duration-300 md:hover:bg-white/10 md:hover:border-white/50 md:hover:text-white [&_svg]:text-white md:hover:[&_svg]:text-white"
          >
            {isUploadingLogo ? (
              <>
                <div className="animate-spin w-3 h-3 border-2 border-current border-t-transparent rounded-full mr-2"></div>
                Laddar upp...
              </>
            ) : (
              <>
                <Camera className="h-3 w-3 mr-2" />
                {formData.company_logo_url ? 'Byt logga' : 'Ladda upp'}
              </>
            )}
          </Button>

          {formData.company_logo_url && (
            <Button 
              type="button"
              variant="outline" 
              size="sm"
              onClick={handleLogoDelete}
              disabled={isUploadingLogo}
              className="bg-white/5 border-white/10 text-white transition-all duration-300 md:hover:bg-red-500/20 md:hover:border-red-500/40 md:hover:text-red-300"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
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

      {/* Företagsinformation - Minimalistisk */}
      <div className="mt-8">
        <div className="text-center mb-6">
          <h2 className="text-xl md:text-2xl font-semibold text-white mb-1">Företagsinformation</h2>
          <p className="text-white">Uppdatera företagsprofil för att synas bättre för kandidater</p>
        </div>

        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-6 md:p-4">
          <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-5 md:space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="company_name" className="text-white">Företagsnamn</Label>
                <Input
                  id="company_name"
                  value={formData.company_name}
                  onChange={(e) => setFormData({...formData, company_name: e.target.value})}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/40 h-9"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="org_number" className="text-white">Organisationsnummer (frivillig)</Label>
                <Input
                  id="org_number"
                  value={formData.org_number}
                  onChange={(e) => {
                    let value = e.target.value.replace(/[^0-9]/g, '');
                    if (value.length > 6) {
                      value = value.slice(0, 6) + '-' + value.slice(6, 10);
                    }
                    setFormData({...formData, org_number: value});
                    const digitsOnly = value.replace(/-/g, '');
                    if (value && digitsOnly.length !== 10) {
                      setOrgNumberError('Organisationsnummer måste vara exakt 10 siffror');
                    } else {
                      setOrgNumberError('');
                    }
                  }}
                  placeholder="XXXXXX-XXXX"
                  inputMode="numeric"
                  maxLength={11}
                  className={`bg-white/5 border-white/10 text-white placeholder:text-white/40 h-9 ${orgNumberError ? 'border-red-500/50' : ''}`}
                />
                {orgNumberError && (
                  <p className="text-red-400/80 text-sm mt-1">{orgNumberError}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="industry" className="text-white">Bransch</Label>
                <DropdownMenu modal={false} open={industryMenuOpen} onOpenChange={setIndustryMenuOpen}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full bg-white/5 border-white/10 text-white transition-all duration-300 md:hover:bg-white/10 md:hover:border-white/50 justify-between h-9 font-normal"
                    >
                      <span className="truncate text-left flex-1 px-1 text-white/90">
                        {formData.industry || 'Välj bransch'}
                      </span>
                      <ChevronDown className="h-4 w-4 flex-shrink-0 opacity-50 ml-2" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent 
                    className="w-80 bg-slate-800/95 backdrop-blur-md border-slate-600/30 shadow-xl z-50 rounded-lg text-white overflow-hidden max-h-96"
                    side="bottom"
                    align="center"
                    alignOffset={0}
                    sideOffset={8}
                    avoidCollisions={false}
                    onCloseAutoFocus={(e) => e.preventDefault()}
                  >
                    <div className="p-3 border-b border-slate-600/30 sticky top-0 bg-slate-700/95 backdrop-blur-md">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/60" />
                        <Input
                          placeholder="Sök bransch..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-10 pr-4 h-10 bg-white/5 border-white/20 text-white placeholder:text-white/60 focus:border-white/40 rounded-lg"
                          autoComplete="off"
                          autoCapitalize="none"
                          autoCorrect="off"
                          onKeyDownCapture={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        />
                      </div>
                    </div>
                   
                    <div className="overflow-y-auto max-h-80 overscroll-contain">
                      {SWEDISH_INDUSTRIES
                        .filter(industryOption => 
                          searchTerm.trim().length >= 2 ? industryOption.toLowerCase().includes(searchTerm.toLowerCase()) : true
                        )
                        .map((industryOption) => (
                          <DropdownMenuItem
                            key={industryOption}
                            onSelect={(e) => e.preventDefault()}
                            onClick={() => {
                              setFormData(prev => ({ ...prev, industry: industryOption }));
                              setSearchTerm('');
                              setIndustryMenuOpen(false);
                            }}
                            className="cursor-pointer hover:bg-slate-700/70 focus:bg-slate-700/70 py-2 px-3 text-white flex items-center justify-between transition-colors touch-manipulation"
                          >
                            <span className="flex-1 pr-2">{industryOption}</span>
                            {formData.industry === industryOption && (
                              <Check className="h-4 w-4 text-green-400 flex-shrink-0" />
                            )}
                          </DropdownMenuItem>
                        ))}
                      
                      {searchTerm.trim().length >= 2 &&
                        !SWEDISH_INDUSTRIES.some(industryOption => 
                          industryOption.toLowerCase().includes(searchTerm.toLowerCase())
                        ) && (
                        <DropdownMenuItem
                          onSelect={(e) => e.preventDefault()}
                          onClick={() => {
                            setFormData(prev => ({ ...prev, industry: searchTerm }));
                            setSearchTerm('');
                            setIndustryMenuOpen(false);
                          }}
                          className="cursor-pointer hover:bg-slate-700/70 focus:bg-slate-700/70 py-2 px-3 text-white border-t border-slate-600/30 transition-colors touch-manipulation"
                        >
                          <span className="flex-1">Använd "{searchTerm}"</span>
                        </DropdownMenuItem>
                      )}
                      
                      {searchTerm.trim().length >= 3 && 
                        SWEDISH_INDUSTRIES.filter(industryOption => 
                          industryOption.toLowerCase().includes(searchTerm.toLowerCase())
                        ).length === 0 && (
                        <div className="py-4 px-3 text-center text-white/60 italic">
                          Inga resultat hittades för "{searchTerm}"
                        </div>
                      )}
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="employee_count" className="text-white">Antal anställda</Label>
                <Select
                  value={formData.employee_count}
                  onValueChange={(value) => setFormData({...formData, employee_count: value})}
                >
                  <SelectTrigger className="bg-white/5 border-white/10 text-white h-9">
                    <SelectValue placeholder="Välj antal" className="text-white/90" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800/95 backdrop-blur-md border-slate-600/30 text-white z-50">
                    <SelectItem value="1-10 anställda">1-10 anställda</SelectItem>
                    <SelectItem value="11-50 anställda">11-50 anställda</SelectItem>
                    <SelectItem value="51-200 anställda">51-200 anställda</SelectItem>
                    <SelectItem value="201-1000 anställda">201-1000 anställda</SelectItem>
                    <SelectItem value="1000+ anställda">1000+ anställda</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="address" className="text-white">Huvudkontor</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                  placeholder="Hammarby Backen 89555"
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/40 h-9"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="website" className="text-white">Webbsida</Label>
                <Input
                  id="website"
                  value={formData.website}
                  onChange={(e) => setFormData({...formData, website: e.target.value})}
                  placeholder="https://din-webbsida.se"
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/40 h-9"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="company_description" className="text-white">Företagsbeskrivning</Label>
              <Textarea
                id="company_description"
                value={formData.company_description}
                onChange={(e) => setFormData({...formData, company_description: e.target.value})}
                placeholder="Vi säljer bilar"
                rows={4}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/40 resize-none"
              />
            </div>

            {/* Social Media Links Section */}
            <div className="border-t border-white/10 pt-5 space-y-4">
              <div>
                <h4 className="text-base font-semibold text-white mb-1">Sociala medier</h4>
                <p className="text-sm text-white">Lägg till företagets sociala medier-profiler</p>
              </div>

              {/* Existing social media links */}
              {formData.company_social_media_links.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm text-white">Företagets sociala medier</Label>
                  {formData.company_social_media_links.map((link, index) => {
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
                        variant="outline"
                        className="w-full bg-white/5 border-white/10 text-white transition-all duration-300 md:hover:bg-white/10 md:hover:border-white/50 md:hover:text-white [&_svg]:text-white md:hover:[&_svg]:text-white h-9 text-sm justify-between font-normal"
                      >
                        <span className="truncate text-left flex-1 px-1">
                          {newSocialLink.platform ? SOCIAL_PLATFORMS.find(p => p.value === newSocialLink.platform)?.label : 'Välj plattform'}
                        </span>
                        <ChevronDown className="h-4 w-4 flex-shrink-0 opacity-50 ml-2" />
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
                          const Icon = platform.icon;
                          return (
                            <DropdownMenuItem
                              key={platform.value}
                              onSelect={(e) => e.preventDefault()}
                              onClick={() => {
                                setNewSocialLink(prev => ({ ...prev, platform: platform.value as SocialMediaLink['platform'] }));
                                setPlatformMenuOpen(false);
                              }}
                              className="cursor-pointer hover:bg-slate-700/70 focus:bg-slate-700/70 py-2 px-3 text-white flex items-center gap-3 transition-colors touch-manipulation rounded-md"
                            >
                              <Icon className="h-4 w-4 flex-shrink-0" />
                              <span className="flex-1">{platform.label}</span>
                              {newSocialLink.platform === platform.value && (
                                <Check className="h-4 w-4 text-green-400 flex-shrink-0" />
                              )}
                            </DropdownMenuItem>
                          );
                        })}
                      </div>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <Input
                    placeholder="Klistra in din sociala medier länk här"
                    value={newSocialLink.url}
                    onChange={(e) => setNewSocialLink(prev => ({ ...prev, url: e.target.value }))}
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/40 h-9 text-sm"
                  />

                  <Button
                    type="button"
                    onClick={addSocialLink}
                    disabled={!newSocialLink.platform || !newSocialLink.url.trim()}
                    className={cn(
                      "w-full bg-white/5 border border-white/10 text-white h-9 text-sm transition-all duration-300 md:hover:bg-white/10 md:hover:border-white/50 md:hover:text-white [&_svg]:text-white md:hover:[&_svg]:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    )}
                  >
                    Lägg till
                    <Plus className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex justify-center pt-6">
              <Button 
                type="submit" 
                disabled={loading || !hasUnsavedChanges}
                className="disabled:opacity-50 disabled:cursor-not-allowed disabled:border-0 border border-white/30 text-white font-medium h-9 px-6 transition-all duration-300 md:hover:bg-white/10 md:hover:border-white/50"
              >
                {loading ? 'Sparar...' : 'Spara ändringar'}
              </Button>
            </div>
          </form>
        </div>
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
        isCircular={false}
      />

      {/* Delete Social Link Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="border-white/20 text-white w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] sm:max-w-md sm:w-[28rem] p-4 sm:p-6 bg-white/10 backdrop-blur-sm rounded-xl shadow-lg mx-0">
          <AlertDialogHeader className="space-y-4 text-center">
            <div className="flex items-center justify-center gap-2.5">
              <div className="bg-red-500/20 p-2 rounded-full">
                <AlertTriangle className="h-4 w-4 text-red-400" />
              </div>
              <AlertDialogTitle className="text-white text-base md:text-lg font-semibold">
                Ta bort social medier-länk
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-white text-sm leading-relaxed break-words">
              {linkToDelete && (
                <>
                  Är du säker på att du vill ta bort länken till <span className="font-semibold text-white break-words">{getPlatformLabel(linkToDelete.link.platform)}</span>? Denna åtgärd går inte att ångra.
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
              className="flex-[0.6] h-11 min-h-11 flex items-center justify-center bg-white/10 border-white/20 text-white text-sm transition-all duration-300 md:hover:bg-white/20 md:hover:text-white md:hover:border-white/50"
            >
              Avbryt
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRemoveSocialLink}
              variant="destructiveSoft"
              className="flex-[0.4] h-11 min-h-11 text-sm flex items-center justify-center"
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              Ta bort
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Logo Confirmation Dialog */}
      <AlertDialog open={logoDeleteDialogOpen} onOpenChange={setLogoDeleteDialogOpen}>
        <AlertDialogContent className="border-white/20 text-white w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] sm:max-w-md sm:w-[28rem] p-4 sm:p-6 bg-white/10 backdrop-blur-sm rounded-xl shadow-lg mx-0">
          <AlertDialogHeader className="space-y-4 text-center">
            <div className="flex items-center justify-center gap-2.5">
              <div className="bg-red-500/20 p-2 rounded-full">
                <AlertTriangle className="h-4 w-4 text-red-400" />
              </div>
              <AlertDialogTitle className="text-white text-base md:text-lg font-semibold">
                Ta bort företagslogga
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-white text-sm leading-relaxed break-words">
              Är du säker på att du vill ta bort företagsloggan? (Glöm inte att spara åtgärden.)
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2 mt-4 sm:justify-center">
            <AlertDialogCancel 
              onClick={() => setLogoDeleteDialogOpen(false)}
              className="flex-[0.6] h-11 min-h-11 flex items-center justify-center bg-white/10 border-white/20 text-white text-sm transition-all duration-300 md:hover:bg-white/20 md:hover:text-white md:hover:border-white/50"
            >
              Avbryt
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmLogoDelete}
              variant="destructiveSoft"
              className="flex-[0.4] h-11 min-h-11 text-sm flex items-center justify-center"
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              Ta bort
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CompanyProfile;