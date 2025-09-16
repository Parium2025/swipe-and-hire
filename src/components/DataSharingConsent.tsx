import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Shield, Check, X, Users } from 'lucide-react';

export const DataSharingConsent = () => {
  const [consentGiven, setConsentGiven] = useState(false);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  // Fetch current consent status
  useEffect(() => {
    const fetchConsentStatus = async () => {
      if (!user?.id) return;
      
      try {
        const { data, error } = await supabase
          .from('user_data_consents')
          .select('consent_given')
          .eq('user_id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
          console.error('Error fetching consent:', error);
          return;
        }

        setConsentGiven(data?.consent_given || false);
      } catch (error) {
        console.error('Error fetching consent status:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchConsentStatus();
  }, [user?.id]);

  const updateConsent = async (newConsentValue: boolean) => {
    if (!user?.id) return;
    
    setUpdating(true);
    try {
      const { error } = await supabase
        .from('user_data_consents')
        .upsert({
          user_id: user.id,
          consent_given: newConsentValue,
          consent_date: new Date().toISOString(),
          consent_version: '1.0',
          data_types_consented: ['name', 'age', 'postal_code', 'phone', 'email', 'location']
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      setConsentGiven(newConsentValue);
      
      toast({
        title: newConsentValue ? "Samtycke givit" : "Samtycke återkallat",
        description: newConsentValue 
          ? "Arbetsgivare kan nu se din grundläggande information när du söker jobb."
          : "Arbetsgivare kan inte längre se din information. Du kan fortfarande söka jobb men arbetsgivare kommer inte kunna se dina kontaktuppgifter.",
        variant: "default",
        duration: 4000
      });
    } catch (error) {
      console.error('Error updating consent:', error);
      toast({
        title: "Fel uppstod",
        description: "Kunde inte uppdatera ditt samtycke. Försök igen.",
        variant: "destructive"
      });
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <Card className="bg-white/5 backdrop-blur-sm border-white/20">
        <CardContent className="pt-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-white/20 rounded w-3/4"></div>
            <div className="h-4 bg-white/20 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white/5 backdrop-blur-sm border-white/20">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Shield className="h-8 w-8 text-white" />
          <CardTitle className="text-white">Datadelning med arbetsgivare</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between p-4 rounded-lg bg-white/5 border border-white/10">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              {consentGiven ? (
                <Check className="h-4 w-4 text-green-400" />
              ) : (
                <X className="h-4 w-4 text-red-400" />
              )}
              <Label htmlFor="consent-switch" className="text-white font-medium">
                {consentGiven ? 'Datadelning aktiverad' : 'Datadelning inaktiverad'}
              </Label>
            </div>
            <p className="text-sm text-white">
              {consentGiven 
                ? 'Du kan när som helst ändra detta samtycke här'
                : ''
              }
            </p>
          </div>
          <Switch
            id="consent-switch"
            checked={consentGiven}
            onCheckedChange={updateConsent}
            disabled={updating}
          />
        </div>

        <div className="space-y-3">
          <h4 className="text-white font-medium flex items-center gap-2">
            <Users className="h-4 w-4" />
            Vad som delas när samtycke är givet:
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            <div className="flex items-center gap-2 text-white">
              <Check className="h-3 w-3 text-green-400" />
              <span>Ditt för- och efternamn</span>
            </div>
            <div className="flex items-center gap-2 text-white">
              <Check className="h-3 w-3 text-green-400" />
              <span>Din ålder (inte exakt födelsedatum)</span>
            </div>
            <div className="flex items-center gap-2 text-white">
              <Check className="h-3 w-3 text-green-400" />
              <span>Postnummer</span>
            </div>
            <div className="flex items-center gap-2 text-white">
              <Check className="h-3 w-3 text-green-400" />
              <span>Telefonnummer och e-post</span>
            </div>
            <div className="flex items-center gap-2 text-white">
              <Check className="h-3 w-3 text-green-400" />
              <span>Kommun/stad</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};