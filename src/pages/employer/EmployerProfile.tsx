import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { useState, useEffect, useCallback } from 'react';
import { toast } from '@/hooks/use-toast';
import { Linkedin, Twitter, ExternalLink } from 'lucide-react';

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
    linkedin_url: (profile as any)?.linkedin_url || '',
    twitter_url: (profile as any)?.twitter_url || '',
  });

  // Update form data when profile changes
  useEffect(() => {
    if (profile) {
      const values = {
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
        bio: profile.bio || '',
        location: profile.location || '',
        phone: profile.phone || '',
        linkedin_url: (profile as any)?.linkedin_url || '',
        twitter_url: (profile as any)?.twitter_url || '',
      };
      
      setFormData(values);
      setOriginalValues(values);
      setHasUnsavedChanges(false);
    }
  }, [profile, setHasUnsavedChanges]);

  const checkForChanges = useCallback(() => {
    if (!originalValues.first_name && !originalValues.last_name && !originalValues.bio && !originalValues.location && !originalValues.phone && !originalValues.linkedin_url && !originalValues.twitter_url) return false; // Not loaded yet
    
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

  // URL validation functions
  const validateLinkedInUrl = (url: string) => {
    if (!url) return true; // Optional field
    return url.includes('linkedin.com/in/') || url.includes('linkedin.com/pub/');
  };

  const validateTwitterUrl = (url: string) => {
    if (!url) return true; // Optional field  
    return url.includes('twitter.com/') || url.includes('x.com/');
  };

  const validateUrl = (url: string, platform: string) => {
    if (!url.trim()) return true; // Empty URLs are allowed
    
    try {
      const validUrl = new URL(url);
      
      if (platform === 'linkedin') {
        return validUrl.hostname === 'www.linkedin.com' || validUrl.hostname === 'linkedin.com';
      }
      
      if (platform === 'twitter') {
        return validUrl.hostname === 'www.twitter.com' || validUrl.hostname === 'twitter.com' || 
               validUrl.hostname === 'www.x.com' || validUrl.hostname === 'x.com';
      }
      
      return true;
    } catch {
      return false;
    }
  };

  const handleSave = async () => {
    // Validera URL:er innan vi sparar
    if (formData.linkedin_url && !validateUrl(formData.linkedin_url, 'linkedin')) {
      toast({
        title: "Ogiltig LinkedIn URL",
        description: "Ange en giltig LinkedIn-profillänk (linkedin.com/in/...)",
        variant: "destructive"
      });
      return;
    }
    
    if (formData.twitter_url && !validateUrl(formData.twitter_url, 'twitter')) {
      toast({
        title: "Ogiltig Twitter/X URL", 
        description: "Ange en giltig Twitter/X-profillänk (twitter.com/... eller x.com/...)",
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
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-white">Min Profil</h1>
        <p className="text-white/90">Hantera din personliga information</p>
      </div>

      <Card className="bg-white/10 backdrop-blur-sm border-white/20">
        <CardHeader>
          <CardTitle className="text-white text-center">Personlig Information</CardTitle>
          <CardDescription className="text-white/80 text-center">
            Uppdatera din grundläggande profilinformation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="first_name" className="text-white">Förnamn</Label>
                <Input
                  id="first_name"
                  value={formData.first_name}
                  onChange={(e) => setFormData({...formData, first_name: e.target.value})}
                  className="bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10 placeholder:text-white/60"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name" className="text-white">Efternamn</Label>
                <Input
                  id="last_name"
                  value={formData.last_name}
                  onChange={(e) => setFormData({...formData, last_name: e.target.value})}
                  className="bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10 placeholder:text-white/60"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email" className="text-white">E-post</Label>
              <Input
                id="email"
                value={user?.email || ''}
                readOnly
                className="bg-white/5 backdrop-blur-sm border-white/20 text-white/70 cursor-not-allowed"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role" className="text-white">Roll</Label>
              <Input
                id="role"
                value={userRole?.role === 'employer' ? 'Admin' : userRole?.role === 'recruiter' ? 'Rekryteringsadmin' : userRole?.role || 'Användare'}
                readOnly
                className="bg-white/5 backdrop-blur-sm border-white/20 text-white/70 cursor-not-allowed"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location" className="text-white">Plats</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => setFormData({...formData, location: e.target.value})}
                placeholder="T.ex. Stockholm, Sverige"
                className="bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10 placeholder:text-white/60"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="text-white">Telefonnummer (frivilligt)</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                placeholder="T.ex. 070-123 45 67"
                className="bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10 placeholder:text-white/60"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="linkedin_url" className="text-white">LinkedIn (frivilligt)</Label>
                <Input
                  id="linkedin_url"
                  value={formData.linkedin_url}
                  onChange={(e) => setFormData({...formData, linkedin_url: e.target.value})}
                  placeholder="https://linkedin.com/in/dittnamn"
                  className="bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10 placeholder:text-white/60"
                />
                {formData.linkedin_url && (
                  <div className="flex items-center gap-2 mt-1">
                    <a 
                      href={formData.linkedin_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-sm"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                      </svg>
                      Visa LinkedIn-profil
                    </a>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="twitter_url" className="text-white">Twitter/X (frivilligt)</Label>
                <Input
                  id="twitter_url"
                  value={formData.twitter_url}
                  onChange={(e) => setFormData({...formData, twitter_url: e.target.value})}
                  placeholder="https://twitter.com/dittnamn"
                  className="bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10 placeholder:text-white/60"
                />
                {formData.twitter_url && (
                  <div className="flex items-center gap-2 mt-1">
                    <a 
                      href={formData.twitter_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-sm"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"/>
                      </svg>
                      Visa Twitter/X-profil
                    </a>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio" className="text-white">Om mig</Label>
              <Textarea
                id="bio"
                value={formData.bio}
                onChange={(e) => setFormData({...formData, bio: e.target.value})}
                rows={4}
                className="bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10 placeholder:text-white/60"
              />
            </div>

            <div className="flex justify-center pt-4">
              <Button 
                type="submit"
                disabled={loading}
                className="w-full"
              >
                {loading ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full mr-2"></div>
                    Sparar...
                  </>
                ) : (
                  'Spara ändringar'
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Social Media Links - Show if any are filled */}
      {(formData.linkedin_url || formData.twitter_url) && (
        <Card className="bg-white/10 backdrop-blur-sm border-white/20">
          <CardHeader>
            <CardTitle className="text-white text-center">Kontakt & Sociala medier</CardTitle>
            <CardDescription className="text-white/80 text-center">
              Dina sociala medier och kontaktlänkar
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center gap-4">
              {formData.linkedin_url && (
                <Button
                  variant="outline"
                  onClick={() => window.open(formData.linkedin_url, '_blank')}
                  className="bg-white/10 border-white/20 text-white hover:bg-blue-600/20 hover:border-blue-400/40 transition-colors"
                >
                  <Linkedin className="h-4 w-4 mr-2" />
                  LinkedIn
                  <ExternalLink className="h-3 w-3 ml-2" />
                </Button>
              )}
              {formData.twitter_url && (
                <Button
                  variant="outline"
                  onClick={() => window.open(formData.twitter_url, '_blank')}
                  className="bg-white/10 border-white/20 text-white hover:bg-sky-600/20 hover:border-sky-400/40 transition-colors"
                >
                  <Twitter className="h-4 w-4 mr-2" />
                  Twitter/X
                  <ExternalLink className="h-3 w-3 ml-2" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default EmployerProfile;