import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { motion } from 'framer-motion';

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
import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from '@/hooks/use-toast';
import ImageEditor from '@/components/ImageEditor';
import { Upload, Building2, Camera, ChevronDown, Search, Check, Trash2, Linkedin, Twitter, Instagram, Globe, ExternalLink, Plus, AlertTriangle, CalendarDays, MapPin, MessageSquare, Video, HelpCircle, AlertCircle, CheckCircle2, WifiOff } from 'lucide-react';
import { useOnline } from '@/hooks/useOnlineStatus';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { SWEDISH_INDUSTRIES } from '@/lib/industries';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

// Video meeting link validation
const VALID_MEETING_PATTERNS = [
  // Google Meet
  /^https?:\/\/(meet\.google\.com|hangouts\.google\.com)\/.+/i,
  // Microsoft Teams
  /^https?:\/\/teams\.microsoft\.com\/.+/i,
  // Zoom
  /^https?:\/\/([\w-]+\.)?zoom\.us\/.+/i,
  // Webex
  /^https?:\/\/([\w-]+\.)?webex\.com\/.+/i,
  // Whereby
  /^https?:\/\/whereby\.com\/.+/i,
  // Jitsi
  /^https?:\/\/meet\.jit\.si\/.+/i,
  // Skype
  /^https?:\/\/join\.skype\.com\/.+/i,
  // GoToMeeting
  /^https?:\/\/(gotomeet\.me|gotomeeting\.com)\/.+/i,
  // BlueJeans
  /^https?:\/\/([\w-]+\.)?bluejeans\.com\/.+/i,
  // Around
  /^https?:\/\/around\.co\/.+/i,
  // Daily.co
  /^https?:\/\/([\w-]+\.)?daily\.co\/.+/i,
  // Huddle
  /^https?:\/\/([\w-]+\.)?huddle\.team\/.+/i,
];

const isValidMeetingLink = (url: string): boolean => {
  if (!url || url.trim() === '') return true; // Empty is valid (optional field)
  return VALID_MEETING_PATTERNS.some(pattern => pattern.test(url.trim()));
};

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

// Interview Type Tabs Component
type InterviewType = 'video' | 'kontor';

interface InterviewTypeTabsProps {
  activeType: InterviewType;
  onTypeChange: (type: InterviewType) => void;
}

const InterviewTypeTabs = ({ activeType, onTypeChange }: InterviewTypeTabsProps) => {
  return (
    <div className="relative flex bg-white/5 rounded-lg p-1 border border-white/10 w-fit">
      <motion.div
        className="absolute top-1 bottom-1 bg-white/20 rounded-md"
        initial={false}
        animate={{
          left: activeType === 'video' ? '4px' : '50%',
          width: 'calc(50% - 4px)',
        }}
        transition={{
          type: "spring",
          stiffness: 300,
          damping: 35,
          mass: 0.8,
        }}
      />
      <button
        type="button"
        onClick={() => onTypeChange('video')}
        className="relative z-10 flex items-center gap-1.5 py-1.5 px-4 rounded-md text-sm font-medium text-white transition-colors"
      >
        <Video className="h-3.5 w-3.5" />
        <span>Video</span>
      </button>
      <button
        type="button"
        onClick={() => onTypeChange('kontor')}
        className="relative z-10 flex items-center gap-1.5 py-1.5 px-4 rounded-md text-sm font-medium text-white transition-colors"
      >
        <Building2 className="h-3.5 w-3.5" />
        <span>Kontor</span>
      </button>
    </div>
  );
};

const CompanyProfile = () => {
  const { profile, updateProfile } = useAuth();
  const { hasUnsavedChanges, setHasUnsavedChanges } = useUnsavedChanges();
  const { isOnline, showOfflineToast } = useOnline();
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
  const [logoIsEdited, setLogoIsEdited] = useState(false);
  
  // Industry dropdown states
  const [industryMenuOpen, setIndustryMenuOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Employee count dropdown state
  const [employeeCountOpen, setEmployeeCountOpen] = useState(false);
  
  // Employee count options matching MobileJobWizard style
  const employeeCountOptions = [
    { value: '1-10 anställda', label: '1-10 anställda' },
    { value: '11-50 anställda', label: '11-50 anställda' },
    { value: '51-200 anställda', label: '51-200 anställda' },
    { value: '201-1000 anställda', label: '201-1000 anställda' },
    { value: '1000+ anställda', label: '1000+ anställda' },
  ];
  
  // Refs for click-outside detection
  const employeeCountRef = useRef<HTMLDivElement>(null);
  const industryRef = useRef<HTMLDivElement>(null);
  const platformRef = useRef<HTMLDivElement>(null);
  
  // localStorage key for persisting unsaved state (survives refresh/offline)
  const DRAFT_STORAGE_KEY = 'parium_draft_company-profile';

  const getInitialFormData = () => {
    // Try to restore from localStorage first (survives refresh/offline)
    try {
      const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        console.log('💾 Company profile draft restored');
        // Handle both old format (direct formData) and new format (with savedAt)
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
      // Interview settings
      interview_default_message: (profile as any)?.interview_default_message || '',
      interview_video_default_message: (profile as any)?.interview_video_default_message || '',
      interview_video_link: (profile as any)?.interview_video_link || '',
      interview_office_address: (profile as any)?.interview_office_address || '',
      interview_office_instructions: (profile as any)?.interview_office_instructions || '',
    };
  };

  const [formData, setFormData] = useState(getInitialFormData);

  const [newSocialLink, setNewSocialLink] = useState({
    platform: '' as SocialMediaLink['platform'] | '',
    url: ''
  });

  const [platformMenuOpen, setPlatformMenuOpen] = useState(false);
  const [interviewType, setInterviewType] = useState<'video' | 'kontor'>('video');

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (employeeCountRef.current && !employeeCountRef.current.contains(event.target as Node)) {
        setEmployeeCountOpen(false);
      }
      if (industryRef.current && !industryRef.current.contains(event.target as Node)) {
        setIndustryMenuOpen(false);
      }
      if (platformRef.current && !platformRef.current.contains(event.target as Node)) {
        setPlatformMenuOpen(false);
      }
    };
    
    if (employeeCountOpen || industryMenuOpen || platformMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [employeeCountOpen, industryMenuOpen, platformMenuOpen]);

  // Validation state
  const [orgNumberError, setOrgNumberError] = useState('');

  // Save unsaved state to localStorage when formData changes (survives refresh/offline)
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

  // Update form data when profile changes (only if no unsaved changes from sessionStorage)
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
        social_media_links: ((profile as any)?.social_media_links || []) as SocialMediaLink[],
        // Interview settings
        interview_default_message: (profile as any)?.interview_default_message || '',
        interview_office_address: (profile as any)?.interview_office_address || '',
        interview_office_instructions: (profile as any)?.interview_office_instructions || '',
      };
      
      // Only reset form if there's no saved draft state
      const savedState = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (!savedState) {
        setFormData(values);
      }
      setOriginalValues(values);
    }
  }, [profile]);

  const checkForChanges = useCallback(() => {
    if (!originalValues.company_name) return false; // Not loaded yet
    
    const hasChanges = Object.keys(formData).some(key => {
      if (key === 'social_media_links') {
        return JSON.stringify(formData[key]) !== JSON.stringify(originalValues[key]);
      }
      return formData[key as keyof typeof formData] !== originalValues[key];
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

  // Reset form to original values and clear draft when user confirms leaving without saving
  useEffect(() => {
    const onUnsavedConfirm = () => {
      if (!originalValues) return;
      setFormData({ ...originalValues });
      setHasUnsavedChanges(false);
      // Clear draft when user discards changes
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

    // Store original file for future edits
    setOriginalLogoFile(file);
    
    const imageUrl = URL.createObjectURL(file);
    // Store the original blob URL - this will be our original for this new image
    setOriginalLogoUrl(imageUrl);
    setPendingImageSrc(imageUrl);
    setImageEditorOpen(true);
    // Reset the file input so the same file can be selected again
    e.target.value = '';
  };

  const handleLogoSave = async (editedBlob: Blob) => {
    try {
      setIsUploadingLogo(true);
      
      const user = await supabase.auth.getUser();
      if (!user.data.user) throw new Error('User not authenticated');

      const timestamp = Date.now();
      const fileExt = 'webp';
      
      // Upload cropped version (WebP format from ImageEditor)
      const croppedFileName = `${user.data.user.id}/${timestamp}-company-logo.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('company-logos')
        .upload(croppedFileName, editedBlob);

      if (uploadError) throw uploadError;

      // Upload original version if we have it
      let originalUrl = formData.company_logo_original_url;
      if (originalLogoFile) {
        const originalFileName = `${user.data.user.id}/${timestamp}-company-logo-original.${fileExt}`;
        const { error: originalUploadError } = await supabase.storage
          .from('company-logos')
          .upload(originalFileName, originalLogoFile);

        if (!originalUploadError) {
          const { data: { publicUrl: originalPublicUrl } } = supabase.storage
            .from('company-logos')
            .getPublicUrl(originalFileName);
          originalUrl = `${originalPublicUrl}?t=${timestamp}`;
        }
      }

      // Use public URL for company logos (no expiration)
      const { data: { publicUrl } } = supabase.storage
        .from('company-logos')
        .getPublicUrl(croppedFileName);

      const logoUrl = `${publicUrl}?t=${timestamp}`;
      
      // Preload logo in background (non-blocking)
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

  const handleEditExistingLogo = async () => {
    // Priority 1: Use stored original URL (same session - always edit from original, like job wizard)
    if (originalLogoUrl) {
      setPendingImageSrc(originalLogoUrl);
      setImageEditorOpen(true);
      return;
    }
    
    // Priority 2: Use stored original URL from database (company_logo_original_url)
    if (formData.company_logo_original_url) {
      try {
        const response = await fetch(formData.company_logo_original_url);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        // Cache this for future edits in the same session
        setOriginalLogoUrl(blobUrl);
        setPendingImageSrc(blobUrl);
        setImageEditorOpen(true);
        return;
      } catch (error) {
        console.error('Error loading original logo:', error);
      }
    }
    
    // Fallback: fetch current cropped logo
    if (!formData.company_logo_url) return;
    
    try {
      const response = await fetch(formData.company_logo_url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      // This becomes our "original" if we don't have a better one
      setOriginalLogoUrl(blobUrl);
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

  // Restore original logo (used when user clicks save without making changes - passes through to original)
  const handleRestoreOriginal = () => {
    // If we have original URL stored, restore it
    if (originalLogoUrl && formData.company_logo_original_url) {
      setFormData(prev => ({
        ...prev,
        company_logo_url: formData.company_logo_original_url,
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

  const handleSave = async () => {
    if (!isOnline) {
      showOfflineToast();
      return;
    }
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
      
      // Clear draft after successful save
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
        <h1 className="text-xl md:text-2xl font-semibold text-white tracking-tight">Företagslogga</h1>
        <p className="text-sm text-white mt-1">Ladda upp din företagslogga för att bygga kännedom och förtroende</p>
      </div>

      {/* Företagslogga sektion - Minimalistisk */}
      <div className="flex flex-col items-center space-y-4 py-6">
        <div className="relative">
          {formData.company_logo_url ? (
            <div className="w-32 h-32 md:w-44 md:h-44 rounded-full overflow-hidden bg-white/5 border border-white/10 flex items-center justify-center">
              <img 
                src={formData.company_logo_url} 
                alt="Företagslogga" 
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="w-32 h-32 md:w-44 md:h-44 rounded-full bg-white/5 border border-dashed border-white flex items-center justify-center">
              <div className="text-2xl md:text-3xl font-semibold text-white">
                {formData.company_name ? 
                  formData.company_name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2) : 
                  'HM'
                }
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-center gap-2 -ml-1">
          {/* Invisible spacer for visual balance when trash icon is shown */}
          {formData.company_logo_url && (
            <div className="w-7 h-9 invisible" aria-hidden="true" />
          )}
          
          {isUploadingLogo ? (
            <Button 
              type="button"
              variant="outline" 
              size="sm"
              disabled
              className="bg-white/5 backdrop-blur-sm border-white/10 !text-white hover:bg-white/10 hover:!text-white hover:border-white/50"
            >
              <div className="animate-spin w-3 h-3 border-2 border-current border-t-transparent rounded-full mr-2"></div>
              Laddar upp...
            </Button>
          ) : formData.company_logo_url ? (
            <Button 
              type="button"
              variant="outline" 
              size="sm"
              onClick={handleEditExistingLogo}
              className="bg-white/5 backdrop-blur-sm border-white/10 !text-white hover:bg-white/10 hover:!text-white hover:border-white/50 md:hover:bg-white/10 md:hover:!text-white md:hover:border-white/50"
            >
              Justera bild
            </Button>
          ) : (
            <Button 
              type="button"
              variant="outline" 
              size="sm"
              onClick={() => document.getElementById('logo-upload')?.click()}
              className="bg-white/5 backdrop-blur-sm border-white/10 !text-white hover:bg-white/10 hover:!text-white hover:border-white/50 md:hover:bg-white/10 md:hover:!text-white md:hover:border-white/50"
            >
              <Camera className="h-3 w-3 mr-2" />
              Ladda upp
            </Button>
          )}

          {formData.company_logo_url && (
            <Button 
              type="button"
              variant="outline" 
              size="sm"
              onClick={handleLogoDelete}
              disabled={isUploadingLogo}
              className="bg-white/5 backdrop-blur-sm border-white/10 !text-white transition-all duration-300 md:hover:bg-destructive/20 md:hover:border-destructive/40 md:hover:!text-white p-2"
            >
              <Trash2 className="h-4 w-4" />
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
                  className="bg-white/5 border-white/10 hover:border-white/50 text-white placeholder:text-white h-9 [&]:text-white"
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
                  className={`bg-white/5 border-white/10 hover:border-white/50 text-white placeholder:text-white h-9 [&]:text-white ${orgNumberError ? 'border-red-500/50' : ''}`}
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
                      setPlatformMenuOpen(false);
                    }}
                    className={`flex items-center justify-between bg-white/10 border border-white/20 rounded-md px-3 py-2 h-11 cursor-pointer hover:border-white/40 transition-colors ${industryMenuOpen ? 'border-white/50' : ''}`}
                  >
                    <span className="text-sm text-white truncate">
                      {formData.industry || 'Välj bransch'}
                    </span>
                    <ChevronDown className="h-4 w-4 text-white flex-shrink-0" />
                  </div>
                  
                  {industryMenuOpen && (
                    <div className="absolute top-full left-0 right-0 z-50 bg-slate-900/85 backdrop-blur-xl border border-white/20 rounded-md mt-1 shadow-lg max-h-80 overflow-hidden">
                      {/* Search input */}
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
                      
                      {/* Options list */}
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
                        
                        {/* Custom value option */}
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
                        
                        {/* No results message */}
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
                      setPlatformMenuOpen(false);
                    }}
                    className={`flex items-center justify-between bg-white/10 border border-white/20 rounded-md px-3 py-2 h-11 cursor-pointer hover:border-white/40 transition-colors ${employeeCountOpen ? 'border-white/50' : ''}`}
                  >
                    <span className="text-sm text-white">
                      {formData.employee_count || 'Välj antal'}
                    </span>
                    <ChevronDown className="h-4 w-4 text-white" />
                  </div>
                  
                  {employeeCountOpen && (
                    <div className="absolute top-full left-0 right-0 z-50 bg-slate-900/85 backdrop-blur-xl border border-white/20 rounded-md mt-1 shadow-lg">
                      {employeeCountOptions.map((option) => (
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
                  className="bg-white/5 border-white/10 hover:border-white/50 text-white placeholder:text-white h-9 [&]:text-white"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="website" className="text-white">Webbsida</Label>
                <Input
                  id="website"
                  value={formData.website}
                  onChange={(e) => setFormData({...formData, website: e.target.value})}
                  placeholder="https://din-webbsida.se"
                  className="bg-white/5 border-white/10 hover:border-white/50 text-white placeholder:text-white h-9 [&]:text-white"
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

            {/* Social Media Links Section */}
            <div className="border-t border-white/10 pt-5 space-y-4">
              <div>
                <h4 className="text-base font-semibold text-white mb-1">Sociala medier</h4>
                <p className="text-sm text-white">Lägg till företagets sociala medier-profiler</p>
              </div>

              {/* Existing social media links */}
              {formData.social_media_links.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm text-white">Företagets sociala medier</Label>
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
                  <div className="relative" ref={platformRef}>
                    <div
                      onClick={() => {
                        setPlatformMenuOpen(!platformMenuOpen);
                        setIndustryMenuOpen(false);
                        setEmployeeCountOpen(false);
                      }}
                      className={`flex items-center justify-between bg-white/10 border border-white/20 rounded-md px-3 py-2 h-11 cursor-pointer hover:border-white/40 transition-colors ${platformMenuOpen ? 'border-white/50' : ''}`}
                    >
                      <span className="text-sm text-white truncate">
                        {newSocialLink.platform ? SOCIAL_PLATFORMS.find(p => p.value === newSocialLink.platform)?.label : 'Välj plattform'}
                      </span>
                      <ChevronDown className="h-4 w-4 text-white flex-shrink-0" />
                    </div>
                    
                    {platformMenuOpen && (
                      <div className="absolute bottom-full left-0 right-0 z-50 bg-slate-900/85 backdrop-blur-xl border border-white/20 rounded-md mb-1 shadow-lg">
                        {SOCIAL_PLATFORMS.map((platform) => {
                          const Icon = platform.icon;
                          return (
                            <button
                              key={platform.value}
                              type="button"
                              onClick={() => {
                                setNewSocialLink(prev => ({ ...prev, platform: platform.value as SocialMediaLink['platform'] }));
                                setPlatformMenuOpen(false);
                              }}
                              className="w-full px-3 py-2 text-left hover:bg-white/20 text-white text-sm border-b border-white/10 last:border-b-0 transition-colors flex items-center gap-3"
                            >
                              <Icon className="h-4 w-4 flex-shrink-0" />
                              <span className="flex-1 font-medium">{platform.label}</span>
                              {newSocialLink.platform === platform.value && (
                                <Check className="h-4 w-4 text-green-400 flex-shrink-0" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <Input
                    placeholder="Klistra in din sociala medier länk här"
                    value={newSocialLink.url}
                    onChange={(e) => setNewSocialLink(prev => ({ ...prev, url: e.target.value }))}
                    className="bg-white/5 border-white/10 hover:border-white/50 text-white placeholder:text-white h-9 text-sm"
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

            {/* Interview Settings Section */}
            <div className="border-t border-white/10 pt-5 space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <CalendarDays className="h-5 w-5 text-white" />
                  <h4 className="text-base font-semibold text-white">Intervjuinställningar</h4>
                </div>
                <p className="text-sm text-white">Standardvärden som fylls i automatiskt när du bokar intervjuer</p>
              </div>

              <div className="space-y-4">
                {/* Interview Type Tabs */}
                <InterviewTypeTabs 
                  activeType={interviewType} 
                  onTypeChange={setInterviewType} 
                />

                {/* Video Interview Settings */}
                {interviewType === 'video' && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-3"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="interview_video_link" className="text-white flex items-center gap-1.5">
                          <Video className="h-3.5 w-3.5" />
                          Videolänk
                          <span className="text-white font-normal">(Din Teams, Zoom eller Google Meet-länk som visas för kandidater)</span>
                        </Label>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Input
                          id="interview_video_link"
                          value={formData.interview_video_link}
                          onChange={(e) => setFormData({...formData, interview_video_link: e.target.value})}
                          placeholder="https://teams.microsoft.com/... eller https://meet.google.com/..."
                          className="bg-white/5 border-white/10 hover:border-white/50 text-white placeholder:text-white h-9 [&]:text-white flex-1"
                        />
                        
                        {/* Validation icons inline */}
                        {formData.interview_video_link && isValidMeetingLink(formData.interview_video_link) && (
                          <CheckCircle2 className="h-5 w-5 text-green-400 flex-shrink-0" />
                        )}
                        {formData.interview_video_link && !isValidMeetingLink(formData.interview_video_link) && (
                          <AlertCircle className="h-5 w-5 text-amber-400 flex-shrink-0" />
                        )}
                      </div>
                      
                      {/* Video link validation feedback */}
                      {formData.interview_video_link && !isValidMeetingLink(formData.interview_video_link) && (
                        <p className="text-amber-400 text-xs">
                          Länken ser inte ut som en giltig möteslänk från Teams, Zoom, Google Meet, Webex, Whereby, Jitsi, Skype, GoToMeeting eller BlueJeans.
                        </p>
                      )}
                      
                      {formData.interview_video_link && isValidMeetingLink(formData.interview_video_link) && (
                        <p className="text-green-400 text-xs">Giltig möteslänk</p>
                      )}
                      
                      {/* Expandable help section */}
                      <Collapsible>
                        <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-white hover:text-white/80 transition-colors">
                          <HelpCircle className="h-3.5 w-3.5" />
                          <span>Hur får jag min videolänk?</span>
                          <ChevronDown className="h-3 w-3" />
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-2">
                          <div className="bg-white/5 rounded-lg p-3 space-y-3 text-xs text-white">
                            <div className="space-y-1">
                              <p className="font-medium text-white flex items-center gap-1.5">
                                <span className="text-blue-400">Microsoft Teams</span>
                              </p>
                              <ol className="list-decimal list-inside space-y-0.5 ml-1 text-white">
                                <li>Öppna Teams → Kalender</li>
                                <li>Klicka "Nytt möte" eller "Möt nu"</li>
                                <li>Kopiera möteslänken</li>
                              </ol>
                            </div>
                            <div className="space-y-1">
                              <p className="font-medium text-white flex items-center gap-1.5">
                                <span className="text-green-400">Google Meet</span>
                              </p>
                              <ol className="list-decimal list-inside space-y-0.5 ml-1 text-white">
                                <li>Gå till <a href="https://meet.google.com" target="_blank" rel="noopener noreferrer" className="text-white underline hover:text-white/80">meet.google.com</a></li>
                                <li>Klicka "Nytt möte" → "Skapa ett möte för senare"</li>
                                <li>Kopiera länken</li>
                              </ol>
                            </div>
                            <div className="space-y-1">
                              <p className="font-medium text-white flex items-center gap-1.5">
                                <span className="text-blue-300">Zoom</span>
                              </p>
                              <ol className="list-decimal list-inside space-y-0.5 ml-1 text-white">
                                <li>Öppna Zoom-appen</li>
                                <li>Gå till "Profil" → "Personal Meeting ID"</li>
                                <li>Kopiera din personliga möteslänk</li>
                              </ol>
                            </div>
                            <p className="text-white pt-1 border-t border-white/10">
                              💡 Tips: Använd din personliga möteslänk så behöver du bara fylla i den en gång!
                            </p>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    </div>

                    <div className="space-y-1.5 pt-4 mt-2 border-t border-white/10">
                      <Label htmlFor="interview_video_default_message" className="text-white flex items-center gap-1.5">
                        <MessageSquare className="h-3.5 w-3.5" />
                        Standardmeddelande för video
                      </Label>
                      <Textarea
                        id="interview_video_default_message"
                        value={formData.interview_video_default_message}
                        onChange={(e) => setFormData({...formData, interview_video_default_message: e.target.value})}
                        placeholder="Hej!&#10;&#10;Tack för din ansökan. Vi skulle gärna vilja träffa dig på en videointervju.&#10;&#10;Vänliga hälsningar"
                        rows={4}
                        className="bg-white/5 border-white/10 hover:border-white/50 text-white placeholder:text-white resize-none [&]:text-white"
                      />
                      <p className="text-xs text-white">Detta meddelande skickas till kandidaten vid videobokning</p>
                    </div>
                  </motion.div>
                )}

                {/* Office Interview Settings */}
                {interviewType === 'kontor' && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-3"
                  >
                    <div className="space-y-1.5">
                      <Label htmlFor="interview_office_address" className="text-white flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5" />
                        Intervjuadress
                      </Label>
                      <Input
                        id="interview_office_address"
                        value={formData.interview_office_address}
                        onChange={(e) => setFormData({...formData, interview_office_address: e.target.value})}
                        placeholder="Storgatan 1, 111 22 Stockholm"
                        className="bg-white/5 border-white/10 hover:border-white/50 text-white placeholder:text-white h-9 [&]:text-white"
                      />
                      <p className="text-xs text-white">Adressen som visas för kandidater vid fysiska intervjuer</p>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="interview_office_instructions" className="text-white">
                        Instruktioner till kandidaten
                      </Label>
                      <Textarea
                        id="interview_office_instructions"
                        value={formData.interview_office_instructions}
                        onChange={(e) => setFormData({...formData, interview_office_instructions: e.target.value})}
                        placeholder="T.ex. parkering, ingång, vem de ska fråga efter..."
                        rows={2}
                        className="bg-white/5 border-white/10 hover:border-white/50 text-white placeholder:text-white resize-none [&]:text-white"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="interview_default_message" className="text-white flex items-center gap-1.5">
                        <MessageSquare className="h-3.5 w-3.5" />
                        Standardmeddelande för kontor
                      </Label>
                      <Textarea
                        id="interview_default_message"
                        value={formData.interview_default_message}
                        onChange={(e) => setFormData({...formData, interview_default_message: e.target.value})}
                        placeholder="Hej!&#10;&#10;Tack för din ansökan. Vi skulle gärna vilja träffa dig på en intervju.&#10;&#10;Vänliga hälsningar"
                        rows={4}
                        className="bg-white/5 border-white/10 hover:border-white/50 text-white placeholder:text-white resize-none [&]:text-white"
                      />
                      <p className="text-xs text-white">Detta meddelande skickas till kandidaten vid kontorsbokning</p>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>

            <div className="flex justify-center pt-6">
              <Button 
                type="submit" 
                disabled={loading || !hasUnsavedChanges}
                variant="glass"
                className="h-9 px-6 disabled:opacity-50 disabled:cursor-not-allowed"
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
        onRestoreOriginal={handleRestoreOriginal}
        aspectRatio={1}
        isCircular={true}
      />

      {/* Delete Social Link Confirmation Dialog */}
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
                  Är du säker på att du vill ta bort länken till <span className="font-semibold text-white inline-block max-w-[200px] truncate align-bottom">{getPlatformLabel(linkToDelete.link.platform)}</span>? Denna åtgärd går inte att ångra.
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

      {/* Delete Logo Confirmation Dialog */}
      <AlertDialog open={logoDeleteDialogOpen} onOpenChange={setLogoDeleteDialogOpen}>
        <AlertDialogContentNoFocus 
          className="border-white/20 text-white w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] sm:max-w-md sm:w-[28rem] p-4 sm:p-6 bg-white/10 backdrop-blur-sm rounded-xl shadow-lg mx-0"
        >
          <AlertDialogHeader className="space-y-4 text-center">
            <div className="flex items-center justify-center gap-2.5">
              <div className="bg-red-500/20 p-2 rounded-full">
                <AlertTriangle className="h-4 w-4 text-red-400" />
              </div>
              <AlertDialogTitle className="text-white text-base md:text-lg font-semibold">
                Ta bort företagslogga
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-white text-sm leading-relaxed">
              Är du säker på att du vill ta bort företagsloggan? (Glöm inte att spara åtgärden.)
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2 mt-4 sm:justify-center">
            <AlertDialogCancel 
              onClick={() => setLogoDeleteDialogOpen(false)}
              style={{ height: '44px', minHeight: '44px', padding: '0 1rem' }}
              className="flex-1 mt-0 flex items-center justify-center rounded-full bg-white/10 border-white/20 text-white text-sm transition-all duration-300 md:hover:bg-white/20 md:hover:text-white md:hover:border-white/50"
            >
              Avbryt
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmLogoDelete}
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
    </div>
  );
};

export default CompanyProfile;