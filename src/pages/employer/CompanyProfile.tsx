import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { useState, useEffect } from 'react';
import { toast } from '@/hooks/use-toast';
import { useSidebar } from '@/components/ui/sidebar';
import ImageEditor from '@/components/ImageEditor';
import { Upload, Building2, Edit } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { createSignedUrl } from '@/utils/storageUtils';

const CompanyProfile = () => {
  const { profile, updateProfile } = useAuth();
  const { setOpen } = useSidebar();
  const [isEditing, setIsEditing] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  
  // Image editor states
  const [imageEditorOpen, setImageEditorOpen] = useState(false);
  const [pendingImageSrc, setPendingImageSrc] = useState<string>('');

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

  // Auto-collapse sidebar when component mounts
  useEffect(() => {
    setOpen(false);
  }, [setOpen]);

  // Update form data when profile changes
  useEffect(() => {
    if (profile) {
      setFormData({
        company_name: profile.company_name || '',
        org_number: profile.org_number || '',
        industry: profile.industry || '',
        address: profile.address || '',
        website: profile.website || '',
        company_description: profile.company_description || '',
        employee_count: profile.employee_count || '',
        company_logo_url: (profile as any)?.company_logo_url || '',
      });
    }
  }, [profile]);

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
      
      toast({
        title: "Logga uppladdad!",
        description: "Din företagslogga har uppdaterats."
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
    try {
      await updateProfile(formData as any);
      setIsEditing(false);
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
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Företagsprofil</h1>
        <p className="text-white/90">Hantera din företagsinformation och logga</p>
      </div>

      {/* Företagslogga sektion */}
      <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg p-6">
        <div className="flex items-center gap-4 mb-4">
          <Building2 className="h-6 w-6 text-white" />
          <div>
            <h2 className="text-xl font-semibold text-white">Företagslogga</h2>
            <p className="text-white/80">Ladda upp eller ändra din företagslogga</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {formData.company_logo_url ? (
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-lg border-2 border-white/20 flex items-center justify-center overflow-hidden">
                <img 
                  src={formData.company_logo_url} 
                  alt="Företagslogga" 
                  className="max-w-full max-h-full object-contain"
                />
              </div>
              <div className="space-y-2">
                <p className="text-sm text-white font-medium">Nuvarande logga</p>
                {isEditing && (
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
                        <Upload className="h-4 w-4 mr-2" />
                        Byt logga
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div 
              className={`w-full max-w-md h-32 border-2 border-dashed border-white/20 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-white/40 hover:bg-white/5 transition-all duration-300 ${isEditing ? '' : 'pointer-events-none opacity-50'}`}
              onClick={() => isEditing && document.getElementById('logo-upload')?.click()}
            >
              {isUploadingLogo ? (
                <div className="text-center">
                  <div className="animate-spin w-6 h-6 border-2 border-white border-t-transparent rounded-full mx-auto mb-2"></div>
                  <p className="text-sm text-white">Laddar upp...</p>
                </div>
              ) : (
                <>
                  <Upload className="w-8 h-8 text-white mb-2" />
                  <p className="text-sm text-white font-medium">Klicka för att ladda upp logga</p>
                  <p className="text-xs text-white/60 mt-1">PNG, JPG eller GIF (max 10MB)</p>
                  {!isEditing && (
                    <p className="text-xs text-white/40 mt-2">Aktivera redigeringsläge för att ladda upp</p>
                  )}
                </>
              )}
            </div>
          )}

          <input
            id="logo-upload"
            type="file"
            accept="image/*"
            onChange={handleLogoChange}
            className="hidden"
            disabled={isUploadingLogo || !isEditing}
          />
        </div>
      </div>

      {/* Företagsinformation */}
      <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-white">Företagsinformation</h2>
            <p className="text-white/80">Uppdatera din företagsprofil för att synas bättre för kandidater</p>
          </div>
          
          <div className="flex gap-2">
            {isEditing ? (
              <>
                <Button onClick={handleSave} className="bg-primary hover:bg-primary/90 text-white">
                  Spara
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setIsEditing(false)}
                  className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                >
                  Avbryt
                </Button>
              </>
            ) : (
              <Button 
                onClick={() => setIsEditing(true)}
                className="bg-primary hover:bg-primary/90 text-white"
              >
                <Edit className="h-4 w-4 mr-2" />
                Redigera
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Label htmlFor="company_name" className="text-white">Företagsnamn</Label>
            <Input
              id="company_name"
              value={formData.company_name}
              onChange={(e) => setFormData({...formData, company_name: e.target.value})}
              disabled={!isEditing}
              className="bg-white/10 border-white/20 text-white placeholder:text-white/60 disabled:bg-white/5"
            />
          </div>

          <div>
            <Label htmlFor="org_number" className="text-white">Organisationsnummer</Label>
            <Input
              id="org_number"
              value={formData.org_number}
              onChange={(e) => setFormData({...formData, org_number: e.target.value})}
              disabled={!isEditing}
              placeholder="XXXXXX-XXXX"
              className="bg-white/10 border-white/20 text-white placeholder:text-white/60 disabled:bg-white/5"
            />
          </div>

          <div>
            <Label htmlFor="industry" className="text-white">Bransch</Label>
            <Input
              id="industry"
              value={formData.industry}
              onChange={(e) => setFormData({...formData, industry: e.target.value})}
              disabled={!isEditing}
              className="bg-white/10 border-white/20 text-white placeholder:text-white/60 disabled:bg-white/5"
            />
          </div>

          <div>
            <Label htmlFor="employee_count" className="text-white">Antal anställda</Label>
            <Select 
              value={formData.employee_count} 
              onValueChange={(value) => setFormData({...formData, employee_count: value})}
              disabled={!isEditing}
            >
              <SelectTrigger className="bg-white/10 border-white/20 text-white disabled:bg-white/5">
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

          <div className="md:col-span-2">
            <Label htmlFor="address" className="text-white">Adress</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({...formData, address: e.target.value})}
              disabled={!isEditing}
              className="bg-white/10 border-white/20 text-white placeholder:text-white/60 disabled:bg-white/5"
            />
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="website" className="text-white">Webbsida</Label>
            <Input
              id="website" 
              value={formData.website}
              onChange={(e) => setFormData({...formData, website: e.target.value})}
              disabled={!isEditing}
              placeholder="https://exempel.se"
              className="bg-white/10 border-white/20 text-white placeholder:text-white/60 disabled:bg-white/5"
            />
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="company_description" className="text-white">Företagsbeskrivning</Label>
            <Textarea
              id="company_description"
              value={formData.company_description}
              onChange={(e) => setFormData({...formData, company_description: e.target.value})}
              disabled={!isEditing}
              rows={4}
              placeholder="Beskriv ditt företag, kultur och värderingar..."
              className="bg-white/10 border-white/20 text-white placeholder:text-white/60 disabled:bg-white/5"
            />
          </div>
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