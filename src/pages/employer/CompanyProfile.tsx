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
import { Upload, Building2, Edit, Camera } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { createSignedUrl } from '@/utils/storageUtils';

const CompanyProfile = () => {
  const { profile, updateProfile } = useAuth();
  const { setOpen } = useSidebar();
  const [loading, setLoading] = useState(false);
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
      setLoading(true);
      await updateProfile(formData as any);
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
      <div>
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
          
          {/* Logo icon display */}
          <div className="flex items-center justify-center">
            <div className="relative">
              <div className="w-16 h-16 rounded-full border-4 border-white/20 p-2 bg-gradient-to-b from-white/10 to-white/5 backdrop-blur-sm">
                <div className="relative w-full h-full rounded-full bg-gradient-to-b from-primary/30 to-primary/50 overflow-hidden flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-white" />
                </div>
              </div>
              <div className="absolute -top-1 -right-1 bg-white rounded-full p-1 shadow-lg">
                <Upload className="h-2 w-2 text-primary" />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col items-center space-y-4">
          <div className="relative">
            {formData.company_logo_url ? (
              <div className="w-24 h-24 rounded-lg overflow-hidden bg-white/10 backdrop-blur-sm border-2 border-white/20 flex items-center justify-center">
                <img 
                  src={formData.company_logo_url} 
                  alt="Företagslogga" 
                  className="max-w-full max-h-full object-contain"
                />
              </div>
            ) : (
              <div className="w-24 h-24 rounded-lg bg-white/10 backdrop-blur-sm border-2 border-dashed border-white/40 flex items-center justify-center">
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
                <Label htmlFor="org_number" className="text-white">Organisationsnummer</Label>
                <Input
                  id="org_number"
                  value={formData.org_number}
                  onChange={(e) => setFormData({...formData, org_number: e.target.value})}
                  placeholder="XXXXXX-XXXX"
                  className="bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10 placeholder:text-white/60"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="industry" className="text-white">Bransch</Label>
                <Input
                  id="industry"
                  value={formData.industry}
                  onChange={(e) => setFormData({...formData, industry: e.target.value})}
                  className="bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10 placeholder:text-white/60"
                />
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
                <Label htmlFor="address" className="text-white">Adress</Label>
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

            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading}
            >
              {loading ? 'Sparar...' : 'Spara ändringar'}
            </Button>
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