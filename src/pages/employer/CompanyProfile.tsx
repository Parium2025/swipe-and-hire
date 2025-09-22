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
import { Upload, Building2, Edit, Camera, ChevronDown, Search, Check } from 'lucide-react';
import { SWEDISH_INDUSTRIES } from '@/lib/industries';
import { supabase } from '@/integrations/supabase/client';
import { createSignedUrl } from '@/utils/storageUtils';

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
        .from('job-applications')
        .upload(fileName, editedBlob);

      if (uploadError) throw uploadError;

      // Use signed URL for secure access
      const signedUrl = await createSignedUrl('job-applications', fileName, 86400); // 24 hours
      if (!signedUrl) {
        throw new Error('Could not create secure access URL');
      }

      const logoUrl = `${signedUrl}&t=${Date.now()}`;
      
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
        description: "Din företagsprofil har uppdaterats framgångsrikt."
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
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-white">Företagsprofil</h1>
        <p className="text-white/90">Hantera din företagsinformation och logga</p>
      </div>

      {/* Företagslogga sektion */}
      <Card className="bg-white/10 backdrop-blur-sm border-white/20">
        <CardHeader>
          <CardTitle className="text-white text-center">
            Företagslogga
          </CardTitle>
          <CardDescription className="text-white/80 text-center">
            Ladda upp din företagslogga för att bygga kännedom och förtroende
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center space-y-4">
          <div className="relative">
            {formData.company_logo_url ? (
              <div className="w-24 h-24 rounded-full overflow-hidden bg-white/10 backdrop-blur-sm border-2 border-white/20 flex items-center justify-center">
                <img 
                  src={formData.company_logo_url} 
                  alt="Företagslogga" 
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="w-24 h-24 rounded-full bg-white/10 backdrop-blur-sm border-2 border-dashed border-white/40 flex items-center justify-center">
                <Building2 className="h-8 w-8 text-white/60" />
              </div>
            )}
          </div>

          <Button 
            variant="outline" 
            onClick={() => document.getElementById('logo-upload')?.click()}
            disabled={isUploadingLogo}
            className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:scale-105 transition-transform duration-200"
          >
            {isUploadingLogo ? (
              <>
                <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full mr-2"></div>
                Laddar upp...
              </>
            ) : (
              <>
                <Camera className="h-4 w-4 mr-2" />
                {formData.company_logo_url ? 'Byt logga' : 'Ladda upp logga'}
              </>
            )}
          </Button>

          <input
            id="logo-upload"
            type="file"
            accept="image/*"
            onChange={handleLogoChange}
            className="hidden"
            disabled={isUploadingLogo}
          />
        </CardContent>
      </Card>

      {/* Företagsinformation */}
      <Card className="bg-white/10 backdrop-blur-sm border-white/20">
        <CardHeader>
          <CardTitle className="text-white">Företagsinformation</CardTitle>
          <CardDescription className="text-white/80">
            Uppdatera din företagsprofil för att synas bättre för kandidater
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="company_name" className="text-white">Företagsnamn</Label>
                <Input
                  id="company_name"
                  value={formData.company_name}
                  onChange={(e) => setFormData({...formData, company_name: e.target.value})}
                  className="bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10 placeholder:text-white/60"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="org_number" className="text-white">Organisationsnummer (frivillig)</Label>
                <Input
                  id="org_number"
                  value={formData.org_number}
                  onChange={(e) => {
                    let value = e.target.value.replace(/[^0-9]/g, ''); // Remove everything except numbers
                    
                    // Auto-format with dash after 6 digits
                    if (value.length > 6) {
                      value = value.slice(0, 6) + '-' + value.slice(6, 10);
                    }
                    
                    setFormData({...formData, org_number: value});
                    
                    // Validate organization number
                    const digitsOnly = value.replace(/-/g, '');
                    if (value && digitsOnly.length !== 10) {
                      setOrgNumberError('Organisationsnummer måste vara exakt 10 siffror');
                    } else {
                      setOrgNumberError('');
                    }
                  }}
                  placeholder="XXXXXX-XXXX"
                  inputMode="numeric"
                  maxLength={11} // 10 digits + 1 dash
                  className={`bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10 placeholder:text-white/60 ${orgNumberError ? 'border-red-500' : ''}`}
                />
                {orgNumberError && (
                  <p className="text-red-400 text-sm mt-1">{orgNumberError}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="industry" className="text-white">Bransch</Label>
                <DropdownMenu modal={false} open={industryMenuOpen} onOpenChange={setIndustryMenuOpen}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10 transition-colors justify-between mt-1 text-left"
                    >
                      <span className="truncate text-left flex-1 px-1">
                        {formData.industry || 'Välj bransch'}
                      </span>
                      <ChevronDown className="h-5 w-5 flex-shrink-0 opacity-50 ml-2" />
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
                    {/* Search input */}
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
                   
                    {/* Industry options */}
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
                      
                      {/* Custom value option if no matches and search term exists */}
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
                      
                      {/* Show message if no results */}
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

              <div className="space-y-2">
                <Label htmlFor="employee_count" className="text-white">Antal anställda</Label>
                <Select 
                  value={formData.employee_count} 
                  onValueChange={(value) => setFormData({...formData, employee_count: value})}
                >
                  <SelectTrigger className="bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10">
                    <SelectValue placeholder="Välj antal anställda" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1-10 anställda">1-10 anställda</SelectItem>
                    <SelectItem value="11-50 anställda">11-50 anställda</SelectItem>
                    <SelectItem value="51-200 anställda">51-200 anställda</SelectItem>
                    <SelectItem value="201-1000 anställda">201-1000 anställda</SelectItem>
                    <SelectItem value="1000+ anställda">1000+ anställda</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="md:col-span-2 space-y-2">
                <Label htmlFor="address" className="text-white">Huvudkontor</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                  className="bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10 placeholder:text-white/60"
                />
              </div>

              <div className="md:col-span-2 space-y-2">
                <Label htmlFor="website" className="text-white">Webbsida</Label>
                <Input
                  id="website" 
                  value={formData.website}
                  onChange={(e) => setFormData({...formData, website: e.target.value})}
                  placeholder="https://exempel.se"
                  className="bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10 placeholder:text-white/60"
                />
              </div>

              <div className="md:col-span-2 space-y-2">
                <Label htmlFor="company_description" className="text-white">Företagsbeskrivning</Label>
                <Textarea
                  id="company_description"
                  value={formData.company_description}
                  onChange={(e) => setFormData({...formData, company_description: e.target.value})}
                  rows={4}
                  placeholder="Beskriv ditt företag, kultur och värderingar..."
                  className="bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10 placeholder:text-white/60"
                />
              </div>
            </div>

            <div className="pt-4">
              <Button 
                type="submit" 
                className="w-full" 
                disabled={loading}
              >
                {loading ? 'Sparar...' : 'Spara ändringar'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

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