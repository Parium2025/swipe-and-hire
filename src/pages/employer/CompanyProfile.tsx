import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAuth } from '@/hooks/useAuth';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { useState, useEffect, useCallback } from 'react';
import { toast } from '@/hooks/use-toast';
import { useSidebar } from '@/components/ui/sidebar';
import ImageEditor from '@/components/ImageEditor';
import { Upload, Building2, Edit, Camera, ChevronDown, Search, Check, Trash2 } from 'lucide-react';
import { SWEDISH_INDUSTRIES } from '@/lib/industries';
import { supabase } from '@/integrations/supabase/client';


const CompanyProfile = () => {
  const { profile, updateProfile } = useAuth();
  const { hasUnsavedChanges, setHasUnsavedChanges } = useUnsavedChanges();
  const [loading, setLoading] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [originalValues, setOriginalValues] = useState<any>({});
  
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
  });

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
      };
      
      setFormData(values);
      setOriginalValues(values);
      setHasUnsavedChanges(false);
    }
  }, [profile, setHasUnsavedChanges]);

  const checkForChanges = useCallback(() => {
    if (!originalValues.company_name) return false; // Not loaded yet
    
    const hasChanges = Object.keys(formData).some(
      key => formData[key] !== originalValues[key]
    );

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
    setFormData(prev => ({ ...prev, company_logo_url: '' }));
    setHasUnsavedChanges(true);
    
    toast({
      title: "Logga borttagen",
      description: "Tryck på \"Spara ändringar\" för att bekräfta borttagningen."
    });
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

    try {
      setLoading(true);
      await updateProfile(formData as any);
      
      // Update original values after successful save
      setOriginalValues({ ...formData });
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


  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="text-center mb-4">
        <h1 className="text-xl font-semibold text-white mb-1">Företagslogga</h1>
        <p className="text-xs text-white">Ladda upp din företagslogga för att bygga kännedom och förtroende</p>
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
            variant="outline" 
            size="sm"
            onClick={() => document.getElementById('logo-upload')?.click()}
            disabled={isUploadingLogo}
            className="bg-white/5 border-white/10 text-white/90 hover:bg-white/10 text-sm"
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
              variant="outline" 
              size="sm"
              onClick={handleLogoDelete}
              disabled={isUploadingLogo}
              className="bg-white/5 border-white/10 text-white/90 hover:bg-red-500/20 text-sm"
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
      <div className="mt-6">
        <div className="text-center mb-4">
          <h2 className="text-xl font-semibold text-white mb-1">Företagsinformation</h2>
          <p className="text-xs text-white">Uppdatera företagsprofil för att synas bättre för kandidater</p>
        </div>

        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-4">
          <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="company_name" className="text-xs text-white">Företagsnamn</Label>
                <Input
                  id="company_name"
                  value={formData.company_name}
                  onChange={(e) => setFormData({...formData, company_name: e.target.value})}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/40 h-9 text-sm"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="org_number" className="text-xs text-white">Organisationsnummer (frivillig)</Label>
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
                  className={`bg-white/5 border-white/10 text-white placeholder:text-white/40 h-9 text-sm ${orgNumberError ? 'border-red-500/50' : ''}`}
                />
                {orgNumberError && (
                  <p className="text-red-400/80 text-xs mt-1">{orgNumberError}</p>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="industry" className="text-xs text-white">Bransch</Label>
                <DropdownMenu modal={false} open={industryMenuOpen} onOpenChange={setIndustryMenuOpen}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full bg-white/5 border-white/10 text-white hover:bg-white/10 justify-between h-9 text-sm font-normal"
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

              <div className="space-y-1">
                <Label htmlFor="employee_count" className="text-xs text-white">Antal anställda</Label>
                <Select
                  value={formData.employee_count}
                  onValueChange={(value) => setFormData({...formData, employee_count: value})}
                >
                  <SelectTrigger className="bg-white/5 border-white/10 text-white h-9 text-sm">
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

              <div className="space-y-1">
                <Label htmlFor="address" className="text-xs text-white">Huvudkontor</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                  placeholder="Hammarby Backen 89555"
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/40 h-9 text-sm"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="website" className="text-xs text-white">Webbsida</Label>
                <Input
                  id="website"
                  value={formData.website}
                  onChange={(e) => setFormData({...formData, website: e.target.value})}
                  placeholder="parium.se"
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/40 h-9 text-sm"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="company_description" className="text-xs text-white">Företagsbeskrivning</Label>
              <Textarea
                id="company_description"
                value={formData.company_description}
                onChange={(e) => setFormData({...formData, company_description: e.target.value})}
                placeholder="Vi säljer bilar"
                rows={4}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/40 resize-none text-sm"
              />
            </div>

            <div className="flex justify-center pt-1">
              <Button 
                type="submit" 
                disabled={loading || !hasUnsavedChanges}
                className="border border-white/30 disabled:opacity-50 disabled:cursor-not-allowed font-medium h-9 px-6 text-sm"
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
    </div>
  );
};

export default CompanyProfile;