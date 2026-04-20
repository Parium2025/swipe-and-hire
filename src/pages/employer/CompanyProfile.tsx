import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

import { useAuth } from '@/hooks/useAuth';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from '@/hooks/use-toast';
import ImageEditor from '@/components/ImageEditor';
import { ChevronDown, Search, Check } from 'lucide-react';
import { useOnline } from '@/hooks/useOnlineStatus';
import { SWEDISH_INDUSTRIES } from '@/lib/industries';
import { normalizeMeetingLink } from '@/lib/meetingLink';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

// Extracted sub-components
import { CompanyLogoSection } from './companyProfile/CompanyLogoSection';
import { CompanySocialMediaSection, getPlatformLabel, validateUrl } from './companyProfile/CompanySocialMediaSection';
import { CompanyInterviewSettings } from './companyProfile/CompanyInterviewSettings';
import { DeleteSocialLinkDialog, DeleteLogoDialog } from './companyProfile/CompanyProfileDialogs';
import { EMPLOYEE_COUNT_OPTIONS } from './companyProfile/types';
import type { SocialMediaLink, CompanyFormData } from './companyProfile/types';

const CompanyProfile = () => {
  const { profile, updateProfile, user } = useAuth();
  const { hasUnsavedChanges, setHasUnsavedChanges } = useUnsavedChanges();
  const { isOnline, showOfflineToast } = useOnline();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [originalValues, setOriginalValues] = useState<any>({});
  const [linkToDelete, setLinkToDelete] = useState<{ link: SocialMediaLink; index: number } | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [logoDeleteDialogOpen, setLogoDeleteDialogOpen] = useState(false);
  
  // Image editor states
  const [imageEditorOpen, setImageEditorOpen] = useState(false);
  const [pendingImageSrc, setPendingImageSrc] = useState<string>('');
  const [originalLogoFile, setOriginalLogoFile] = useState<File | null>(null);
  const [originalLogoUrl, setOriginalLogoUrl] = useState<string>('');
  const [originalLogoStoragePath, setOriginalLogoStoragePath] = useState<string>('');
  const [logoIsEdited, setLogoIsEdited] = useState(false);

  // Initialize originalLogoStoragePath from database when profile loads
  useEffect(() => {
    if (profile) {
      const originalUrl = (profile as any)?.company_logo_original_url;
      if (originalUrl) {
        const match = originalUrl.match(/company-logos\/(.+?)(?:\?|$)/);
        if (match && match[1]) {
          setOriginalLogoStoragePath(match[1]);
        }
      }
    }
  }, [profile]);

  // Industry dropdown states
  const [industryMenuOpen, setIndustryMenuOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Employee count dropdown state
  const [employeeCountOpen, setEmployeeCountOpen] = useState(false);
  
  // Refs for click-outside detection
  const employeeCountRef = useRef<HTMLDivElement>(null);
  const industryRef = useRef<HTMLDivElement>(null);
  
  // localStorage key for persisting unsaved state
  const DRAFT_STORAGE_KEY = 'parium_draft_company-profile';

  const getInitialFormData = (): CompanyFormData => {
    try {
      const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        console.log('💾 Company profile draft restored');
        return parsed.formData || parsed;
      }
    } catch (e) {
      console.warn('Failed to restore company profile state from localStorage');
    }
    
    return {
      company_name: profile?.company_name || '',
      org_number: profile?.org_number || '',
      industry: profile?.industry || '',
      address: profile?.address || '',
      website: profile?.website || '',
      company_description: profile?.company_description || '',
      employee_count: profile?.employee_count || '',
      company_logo_url: (profile as any)?.company_logo_url || '',
      company_logo_original_url: (profile as any)?.company_logo_original_url || '',
      social_media_links: ((profile as any)?.social_media_links || []) as SocialMediaLink[],
      interview_default_message: (profile as any)?.interview_default_message || '',
      interview_video_default_message: (profile as any)?.interview_video_default_message || '',
      interview_video_link: normalizeMeetingLink((profile as any)?.interview_video_link || ''),
      interview_office_address: (profile as any)?.interview_office_address || '',
      interview_office_instructions: (profile as any)?.interview_office_instructions || '',
    };
  };

  const [formData, setFormData] = useState(getInitialFormData);

  // Validation state
  const [orgNumberError, setOrgNumberError] = useState('');

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (employeeCountRef.current && !employeeCountRef.current.contains(event.target as Node)) {
        setEmployeeCountOpen(false);
      }
      if (industryRef.current && !industryRef.current.contains(event.target as Node)) {
        setIndustryMenuOpen(false);
      }
    };
    
    if (employeeCountOpen || industryMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [employeeCountOpen, industryMenuOpen]);

  // Save unsaved state to localStorage when formData changes
  useEffect(() => {
    if (hasUnsavedChanges) {
      try {
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({
          formData,
          savedAt: Date.now()
        }));
        console.log('💾 Company profile draft saved');
      } catch (e) {
        console.warn('Failed to save company profile state to localStorage');
      }
    }
  }, [formData, hasUnsavedChanges]);

  // Update form data when profile changes
  useEffect(() => {
    if (profile) {
      const values: CompanyFormData = {
        company_name: profile.company_name || '',
        org_number: profile.org_number || '',
        industry: profile.industry || '',
        address: profile.address || '',
        website: profile.website || '',
        company_description: profile.company_description || '',
        employee_count: profile.employee_count || '',
        company_logo_url: (profile as any)?.company_logo_url || '',
        company_logo_original_url: (profile as any)?.company_logo_original_url || '',
        social_media_links: ((profile as any)?.social_media_links || []) as SocialMediaLink[],
        interview_default_message: (profile as any)?.interview_default_message || '',
        interview_video_default_message: (profile as any)?.interview_video_default_message || '',
        interview_video_link: normalizeMeetingLink((profile as any)?.interview_video_link || ''),
        interview_office_address: (profile as any)?.interview_office_address || '',
        interview_office_instructions: (profile as any)?.interview_office_instructions || '',
      };
      
      const savedState = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (!savedState) {
        setFormData(values);
      }
      setOriginalValues(values);
    }
  }, [profile]);

  const checkForChanges = useCallback(() => {
    if (!originalValues.company_name) return false;
    
    const hasChanges = Object.keys(formData).some(key => {
      if (key === 'social_media_links') {
        return JSON.stringify(formData[key as keyof CompanyFormData]) !== JSON.stringify(originalValues[key]);
      }
      return formData[key as keyof CompanyFormData] !== originalValues[key];
    });

    setHasUnsavedChanges(hasChanges);
    return hasChanges;
  }, [originalValues, formData, setHasUnsavedChanges]);

  useEffect(() => {
    checkForChanges();
  }, [checkForChanges]);

  // Prevent leaving page with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = 'Du har osparade ändringar. Är du säker på att du vill lämna sidan?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Reset form to original values when user confirms leaving without saving
  useEffect(() => {
    const onUnsavedConfirm = () => {
      if (!originalValues) return;
      setFormData({ ...originalValues });
      setHasUnsavedChanges(false);
      try {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
        console.log('💾 Company profile draft cleared (discarded)');
      } catch (e) {
        console.warn('Failed to clear company profile draft');
      }
    };
    window.addEventListener('unsaved-confirm', onUnsavedConfirm as EventListener);
    return () => window.removeEventListener('unsaved-confirm', onUnsavedConfirm as EventListener);
  }, [originalValues, setHasUnsavedChanges]);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;

    setOriginalLogoFile(file);
    
    const imageUrl = URL.createObjectURL(file);
    setOriginalLogoUrl(imageUrl);
    setOriginalLogoStoragePath('');
    setPendingImageSrc(imageUrl);
    setImageEditorOpen(true);
    setLogoIsEdited(false);
    e.target.value = '';
  };

  const handleLogoSave = async (editedBlob: Blob) => {
    try {
      setIsUploadingLogo(true);
      
      const user = await supabase.auth.getUser();
      if (!user.data.user) throw new Error('User not authenticated');

      const timestamp = Date.now();
      const fileExt = 'webp';
      
      const croppedFileName = `${user.data.user.id}/${timestamp}-company-logo.${fileExt}`;
      const { compressImageBlob, LONG_CACHE_UPLOAD_OPTIONS } = await import('@/lib/imageUploadOptimization');
      const optimizedBlob = await compressImageBlob(editedBlob, { maxDimension: 1024, quality: 0.9 });
      const { error: uploadError } = await supabase.storage
        .from('company-logos')
        .upload(croppedFileName, optimizedBlob, LONG_CACHE_UPLOAD_OPTIONS);

      if (uploadError) throw uploadError;

      let originalUrl = formData.company_logo_original_url;
      let newOriginalStoragePath = originalLogoStoragePath;
      
      if (originalLogoFile && !originalLogoStoragePath) {
        const origExt = originalLogoFile.name.split('.').pop() || 'jpg';
        const originalFileName = `${user.data.user.id}/${timestamp}-company-logo-original.${origExt}`;
        const { error: originalUploadError } = await supabase.storage
          .from('company-logos')
          .upload(originalFileName, originalLogoFile, LONG_CACHE_UPLOAD_OPTIONS);

        if (!originalUploadError) {
          const { data: { publicUrl: originalPublicUrl } } = supabase.storage
            .from('company-logos')
            .getPublicUrl(originalFileName);
          originalUrl = `${originalPublicUrl}?t=${timestamp}`;
          newOriginalStoragePath = originalFileName;
          setOriginalLogoStoragePath(originalFileName);
        }
      }

      const { data: { publicUrl } } = supabase.storage
        .from('company-logos')
        .getPublicUrl(croppedFileName);

      const logoUrl = `${publicUrl}?t=${timestamp}`;
      
      import('@/lib/serviceWorkerManager').then(({ preloadSingleFile }) => {
        preloadSingleFile(logoUrl).catch(() => {});
      }).catch(() => {});
      
      setFormData(prev => ({ 
        ...prev, 
        company_logo_url: logoUrl,
        company_logo_original_url: originalUrl
      }));
      setImageEditorOpen(false);
      setPendingImageSrc('');
      setLogoIsEdited(true);
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

  const handleEditExistingLogo = async () => {
    if (originalLogoUrl) {
      setPendingImageSrc(originalLogoUrl);
      setImageEditorOpen(true);
      return;
    }
    
    if (formData.company_logo_original_url) {
      try {
        const response = await fetch(formData.company_logo_original_url);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        setOriginalLogoUrl(blobUrl);
        const match = formData.company_logo_original_url.match(/company-logos\/(.+?)(?:\?|$)/);
        if (match) {
          setOriginalLogoStoragePath(match[1]);
        }
        setPendingImageSrc(blobUrl);
        setImageEditorOpen(true);
        return;
      } catch (error) {
        console.error('Error loading original logo:', error);
      }
    }
    
    if (!formData.company_logo_url) return;
    
    try {
      const response = await fetch(formData.company_logo_url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      setOriginalLogoUrl(blobUrl);
      const match = formData.company_logo_url.match(/company-logos\/(.+?)(?:\?|$)/);
      if (match) {
        setOriginalLogoStoragePath(match[1]);
      }
      setPendingImageSrc(blobUrl);
      setImageEditorOpen(true);
    } catch (error) {
      console.error('Error loading logo for editing:', error);
      toast({
        title: "Fel",
        description: "Kunde inte ladda bilden för redigering.",
        variant: "destructive"
      });
    }
  };

  const handleRestoreOriginal = () => {
    if (originalLogoUrl && (formData.company_logo_original_url || originalLogoStoragePath)) {
      const originalPublicUrl = formData.company_logo_original_url || 
        (originalLogoStoragePath ? 
          supabase.storage.from('company-logos').getPublicUrl(originalLogoStoragePath).data.publicUrl 
          : '');
      
      setFormData(prev => ({
        ...prev,
        company_logo_url: originalPublicUrl,
      }));
      setLogoIsEdited(false);
      toast({
        title: "Bild återställd",
        description: "Originalbilden har återställts",
      });
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

  const handleRemoveLinkClick = (index: number) => {
    const link = formData.social_media_links[index];
    setLinkToDelete({ link, index });
    setDeleteDialogOpen(true);
  };

  const confirmRemoveSocialLink = () => {
    if (!linkToDelete) return;

    const updatedLinks = formData.social_media_links.filter((_, i) => i !== linkToDelete.index);
    
    setFormData(prev => ({ 
      ...prev, 
      social_media_links: [...updatedLinks]
    }));
    setHasUnsavedChanges(true);

    toast({
      title: "Länk borttagen",
      description: `${getPlatformLabel(linkToDelete.link.platform)}-länken har tagits bort. Klicka på Spara ändringar för att bekräfta.`,
    });

    setDeleteDialogOpen(false);
    setLinkToDelete(null);
  };

  const handleSave = async () => {
    const sanitizedFormData: CompanyFormData = {
      ...formData,
      interview_video_link: normalizeMeetingLink(formData.interview_video_link || ''),
    };

    if (formData.org_number && formData.org_number.replace(/-/g, '').length !== 10) {
      toast({
        title: "Valideringsfel",
        description: "Organisationsnummer måste vara exakt 10 siffror eller lämnas tomt.",
        variant: "destructive"
      });
      return;
    }

    for (const link of sanitizedFormData.social_media_links) {
      if (!validateUrl(link.url, link.platform)) {
        toast({
          title: "Ogiltig URL",
          description: `Kontrollera URL:en för ${getPlatformLabel(link.platform)}`,
          variant: "destructive"
        });
        return;
      }
    }

    try {
      setLoading(true);
      await updateProfile(sanitizedFormData as any);

      if (user) {
        // Rensa bild-cache för denna användares loggor (alla versioner)
        try {
          const { imageCache } = await import('@/lib/imageCache');
          imageCache.evictByPattern(`/company-logos/${user.id}/`);
        } catch {}

        // Rensa Service Worker cache för loggor
        try {
          if ('caches' in window) {
            const keys = await caches.keys();
            await Promise.all(keys.map(async (k) => {
              const cache = await caches.open(k);
              const reqs = await cache.keys();
              await Promise.all(
                reqs
                  .filter((r) => r.url.includes(`/company-logos/${user.id}/`))
                  .map((r) => cache.delete(r))
              );
            }));
          }
        } catch {}

        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['jobs'] }),
          queryClient.invalidateQueries({ queryKey: ['optimized-job-search'] }),
          queryClient.invalidateQueries({ queryKey: ['saved-jobs'] }),
          queryClient.invalidateQueries({ queryKey: ['skipped-jobs'] }),
          queryClient.invalidateQueries({ queryKey: ['available-jobs'] }),
          queryClient.invalidateQueries({ queryKey: ['my-applications', user.id] }),
          queryClient.invalidateQueries({ queryKey: ['profile'] }),
          queryClient.invalidateQueries({ queryKey: ['company-profile'] }),
        ]);
      }

      const updatedValues = {
        ...sanitizedFormData,
        social_media_links: JSON.parse(JSON.stringify(sanitizedFormData.social_media_links)),
      };

      setFormData(updatedValues);
      setOriginalValues(updatedValues);
      setHasUnsavedChanges(false);
      
      try {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
        console.log('💾 Company profile draft cleared (saved)');
      } catch (e) {
        console.warn('Failed to clear company profile draft');
      }

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

  const handleFormDataChange = (updates: Partial<CompanyFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  return (
     <div className="space-y-8 responsive-container animate-fade-in">
      {/* Logo Section */}
      <CompanyLogoSection
        companyLogoUrl={formData.company_logo_url}
        companyName={formData.company_name}
        isUploadingLogo={isUploadingLogo}
        onUploadClick={() => document.getElementById('logo-upload')?.click()}
        onEditExistingLogo={handleEditExistingLogo}
        onLogoDelete={handleLogoDelete}
        onFileChange={handleLogoChange}
      />

      {/* Företagsinformation */}
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
                  className="bg-white/5 border-white/10 hover:border-white/50 text-white placeholder:text-white h-11 !min-h-0 [&]:text-white"
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
                  className={`bg-white/5 border-white/10 hover:border-white/50 text-white placeholder:text-white h-11 !min-h-0 [&]:text-white ${orgNumberError ? 'border-red-500/50' : ''}`}
                />
                {orgNumberError && (
                  <p className="text-red-400/80 text-sm mt-1">{orgNumberError}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="industry" className="text-white">Bransch</Label>
                <div className="relative" ref={industryRef}>
                  <div
                    onClick={() => {
                      setIndustryMenuOpen(!industryMenuOpen);
                      setEmployeeCountOpen(false);
                    }}
                    className={`flex items-center justify-between bg-white/10 border border-white/20 rounded-md px-3 py-2 h-11 cursor-pointer hover:border-white/40 transition-colors ${industryMenuOpen ? 'border-white/50' : ''}`}
                  >
                    <span className="text-sm text-white truncate">
                      {formData.industry || 'Välj bransch'}
                    </span>
                    <ChevronDown className="h-4 w-4 text-white flex-shrink-0" />
                  </div>
                  
                  {industryMenuOpen && (
                    <div className="absolute top-full left-0 right-0 z-50 glass-panel rounded-md mt-1 max-h-80 overflow-hidden">
                      <div className="p-2 border-b border-white/10 sticky top-0 bg-slate-900/95">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white" />
                          <Input
                            placeholder="Sök bransch..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 h-9 bg-white/10 border-white/20 text-white placeholder:text-white focus:border-white/40 text-sm"
                            autoComplete="off"
                            autoCapitalize="none"
                            autoCorrect="off"
                          />
                        </div>
                      </div>
                      
                      <div className="overflow-y-auto max-h-60">
                        {SWEDISH_INDUSTRIES
                          .filter(industryOption => 
                            searchTerm.trim().length >= 2 ? industryOption.toLowerCase().includes(searchTerm.toLowerCase()) : true
                          )
                          .map((industryOption) => (
                            <button
                              key={industryOption}
                              type="button"
                              onClick={() => {
                                setFormData(prev => ({ ...prev, industry: industryOption }));
                                setSearchTerm('');
                                setIndustryMenuOpen(false);
                              }}
                              className="w-full px-3 py-2 text-left hover:bg-white/20 text-white text-sm border-b border-white/10 last:border-b-0 transition-colors flex items-center justify-between"
                            >
                              <span className="font-medium">{industryOption}</span>
                              {formData.industry === industryOption && (
                                <Check className="h-4 w-4 text-green-400 flex-shrink-0" />
                              )}
                            </button>
                          ))}
                        
                        {searchTerm.trim().length >= 2 &&
                          !SWEDISH_INDUSTRIES.some(industryOption => 
                            industryOption.toLowerCase().includes(searchTerm.toLowerCase())
                          ) && (
                          <button
                            type="button"
                            onClick={() => {
                              setFormData(prev => ({ ...prev, industry: searchTerm }));
                              setSearchTerm('');
                              setIndustryMenuOpen(false);
                            }}
                            className="w-full px-3 py-2 text-left hover:bg-white/20 text-white text-sm border-t border-white/10 transition-colors"
                          >
                            <span className="font-medium">Använd "{searchTerm}"</span>
                          </button>
                        )}
                        
                        {searchTerm.trim().length >= 3 && 
                          SWEDISH_INDUSTRIES.filter(industryOption => 
                            industryOption.toLowerCase().includes(searchTerm.toLowerCase())
                          ).length === 0 && (
                          <div className="py-3 px-3 text-center text-white text-sm">
                            Inga resultat hittades för "{searchTerm}"
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="employee_count" className="text-white">Antal anställda</Label>
                <div className="relative" ref={employeeCountRef}>
                  <div
                    onClick={() => {
                      setEmployeeCountOpen(!employeeCountOpen);
                      setIndustryMenuOpen(false);
                    }}
                    className={`flex items-center justify-between bg-white/10 border border-white/20 rounded-md px-3 py-2 h-11 cursor-pointer hover:border-white/40 transition-colors ${employeeCountOpen ? 'border-white/50' : ''}`}
                  >
                    <span className="text-sm text-white">
                      {formData.employee_count || 'Välj antal'}
                    </span>
                    <ChevronDown className="h-4 w-4 text-white" />
                  </div>
                  
                  {employeeCountOpen && (
                    <div className="absolute top-full left-0 right-0 z-50 glass-panel rounded-md mt-1">
                      {EMPLOYEE_COUNT_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            setFormData({...formData, employee_count: option.value});
                            setEmployeeCountOpen(false);
                          }}
                          className="w-full px-3 py-2 text-left hover:bg-white/20 text-white text-sm border-b border-white/10 last:border-b-0 transition-colors flex items-center justify-between"
                        >
                          <span className="font-medium">{option.label}</span>
                          {formData.employee_count === option.value && (
                            <Check className="h-4 w-4 text-green-400 flex-shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="address" className="text-white">Huvudkontor</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                  placeholder="Hammarby Backen 89555"
                  className="bg-white/5 border-white/10 hover:border-white/50 text-white placeholder:text-white h-11 !min-h-0 [&]:text-white"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="website" className="text-white">Webbsida</Label>
                <Input
                  id="website"
                  value={formData.website}
                  onChange={(e) => setFormData({...formData, website: e.target.value})}
                  placeholder="https://din-webbsida.se"
                  className="bg-white/5 border-white/10 hover:border-white/50 text-white placeholder:text-white h-11 !min-h-0 [&]:text-white"
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
                className="bg-white/5 border-white/10 hover:border-white/50 text-white placeholder:text-white resize-none [&]:text-white"
              />
            </div>

            {/* Social Media Links */}
            <CompanySocialMediaSection
              links={formData.social_media_links}
              onLinksChange={(links) => {
                setFormData(prev => ({ ...prev, social_media_links: links }));
                setHasUnsavedChanges(true);
              }}
              onRemoveLinkClick={handleRemoveLinkClick}
            />

            {/* Interview Settings */}
            <CompanyInterviewSettings
              formData={formData}
              onFormDataChange={handleFormDataChange}
            />

            <div className="flex justify-center pt-6">
              <Button 
                type="submit" 
                disabled={loading || !hasUnsavedChanges}
                variant="glass"
                className="h-9 px-6 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
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
        // Endast tillåt "återställ original" när vi redigerar en redan sparad/redigerad logga.
        // Vid första uppladdning av en ny bild ska den nya bilden alltid sparas, även om
        // användaren inte zoomar/flyttar (annars triggas felaktigt "Bild återställd").
        onRestoreOriginal={
          (logoIsEdited || (formData.company_logo_url && !originalLogoFile))
            ? handleRestoreOriginal
            : undefined
        }
        aspectRatio={1}
        isCircular={true}
      />

      {/* Delete Social Link Dialog */}
      <DeleteSocialLinkDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        linkToDelete={linkToDelete}
        onConfirm={confirmRemoveSocialLink}
        onCancel={() => {
          setDeleteDialogOpen(false);
          setLinkToDelete(null);
        }}
      />

      {/* Delete Logo Dialog */}
      <DeleteLogoDialog
        open={logoDeleteDialogOpen}
        onOpenChange={setLogoDeleteDialogOpen}
        onConfirm={confirmLogoDelete}
        onCancel={() => setLogoDeleteDialogOpen(false)}
      />
    </div>
  );
};

export default CompanyProfile;
