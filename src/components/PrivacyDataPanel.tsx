import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { ShieldCheck, Download, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';

interface PrivacyDataPanelProps {
  /** Arbetsgivare ser även länk till personuppgiftsbiträdesavtalet */
  showDpaLink?: boolean;
}

/**
 * GDPR-panel: dataportabilitet (art. 20) + genvägar till policydokument.
 * Används både i jobbsökarens profil och arbetsgivarens inställningar.
 */
export function PrivacyDataPanel({ showDpaLink = false }: PrivacyDataPanelProps) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error('Du måste vara inloggad.');

      const { data, error } = await supabase.functions.invoke('export-my-data', {
        body: {},
      });
      if (error) throw error;

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `parium-mina-uppgifter-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      toast({
        title: 'Nedladdning klar',
        description: 'Dina uppgifter har laddats ner som en JSON-fil.',
      });
    } catch (e) {
      toast({
        title: 'Kunde inte hämta dina uppgifter',
        description: (e as Error).message || 'Försök igen om en stund.',
        variant: 'destructive',
      });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-6 md:p-4">
      <div className="space-y-5 md:space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <ShieldCheck className="h-4 w-4 text-white" />
          <h3 className="text-sm font-medium text-white">Dina uppgifter och integritet</h3>
        </div>

        <p className="text-xs text-white">
          Du kan när som helst ladda ner en kopia av allt vi sparar om dig — profil, ansökningar,
          meddelanden du skrivit, sparade jobb och inställningar. Filen är maskinläsbar (JSON) och
          kan tas med till en annan tjänst.
        </p>

        <Button
          variant="glass"
          onClick={handleDownload}
          disabled={downloading}
          className="h-10 rounded-full px-5 text-sm text-white"
        >
          {downloading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          {downloading ? 'Hämtar dina uppgifter…' : 'Ladda ner mina uppgifter'}
        </Button>

        <p className="text-xs text-white">
          Läs mer i{' '}
          <Link to="/integritetspolicy" className="underline underline-offset-2">
            integritetspolicyn
          </Link>
          {showDpaLink && (
            <>
              {' '}och{' '}
              <Link to="/dpa" className="underline underline-offset-2">
                personuppgiftsbiträdesavtalet
              </Link>
            </>
          )}
          . Vill du radera ditt konto helt, kontakta{' '}
          <a href="mailto:support@parium.se" className="underline underline-offset-2">
            support@parium.se
          </a>
          .
        </p>
      </div>
    </div>
  );
}

export default PrivacyDataPanel;
