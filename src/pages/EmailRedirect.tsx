import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExternalLink, Smartphone, AlertTriangle, Copy, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const PUBLIC_APP_URL = 'https://parium.se';

const EmailRedirect = () => {
  const [isInAppBrowser, setIsInAppBrowser] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const userAgent = navigator.userAgent;
    
    // Detektera in-app browsers
    const isGmail = userAgent.includes('Gmail');
    const isLinkedIn = userAgent.includes('LinkedInApp');
    const isFacebook = userAgent.includes('FBAN') || userAgent.includes('FBAV');
    const isTwitter = userAgent.includes('Twitter');
    const isInstagram = userAgent.includes('Instagram');
    const isWhatsApp = userAgent.includes('WhatsApp');
    const isGeneralInApp = userAgent.includes('wv') || userAgent.includes('WebView');
    
    const inApp = isGmail || isLinkedIn || isFacebook || isTwitter || isInstagram || isWhatsApp || isGeneralInApp;
    
    // Detektera mobil
    const mobile = /iPhone|iPad|iPod|Android|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
    
    setIsInAppBrowser(inApp);
    setIsMobile(mobile);
    
    console.log('EmailRedirect - User Agent:', userAgent);
    console.log('EmailRedirect - Is In-App Browser:', inApp);
    console.log('EmailRedirect - Is Mobile:', mobile);
    
    // Om inte in-app browser, redirecta direkt till confirm-sidan
    if (!inApp) {
      const confirmToken = searchParams.get('confirm');
      if (confirmToken) {
        console.log('Not in-app browser, redirecting to confirm page');
        navigate(`/confirm?confirm=${confirmToken}`, { replace: true });
      }
    }
  }, [searchParams, navigate]);

  const copyUrlToClipboard = async () => {
    const confirmToken = searchParams.get('confirm');
    const url = `${PUBLIC_APP_URL}/confirm?confirm=${confirmToken}`;
    
    try {
      await navigator.clipboard.writeText(url);
      setCopySuccess(true);
      toast({
        title: "Länk kopierad!",
        description: "Öppna nu Safari och klistra in länken",
      });
      setTimeout(() => setCopySuccess(false), 3000);
    } catch (err) {
      console.error('Failed to copy: ', err);
      toast({
        title: "Kunde inte kopiera",
        description: "Kopiera länken manuellt från adressfältet",
        variant: "destructive"
      });
    }
  };

  const openInSafari = () => {
    const confirmToken = searchParams.get('confirm');
    const url = `${PUBLIC_APP_URL}/confirm?confirm=${confirmToken}`;
    
    // Försök öppna i Safari
    if (isMobile) {
      window.location.href = url;
    } else {
      window.open(url, '_blank');
    }
  };

  if (!isInAppBrowser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary via-primary-glow to-primary-dark flex items-center justify-center p-4 smooth-scroll touch-pan" style={{ WebkitOverflowScrolling: 'touch' }}>
        <Card className="w-full max-w-md bg-glass backdrop-blur-md border-white/20">
          <CardContent className="p-8 text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary-foreground mx-auto mb-4"></div>
            <h2 className="text-2xl font-bold text-primary-foreground mb-4">
              Redirectar...
            </h2>
            <p className="text-primary-foreground/80">
              Du omdirigeras till bekräftelsesidan...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary via-primary-glow to-primary-dark flex items-center justify-center p-4 smooth-scroll touch-pan" style={{ WebkitOverflowScrolling: 'touch' }}>
      <Card className="w-full max-w-md bg-glass backdrop-blur-md border-white/20">
        <CardContent className="p-8 text-center">
          <AlertTriangle className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
          
          <h2 className="text-2xl font-bold text-primary-foreground mb-4">
            Öppna i Safari
          </h2>
          
          <p className="text-primary-foreground/80 mb-6 text-left">
            Du öppnar länken i Gmail-appen eller en annan app. För att bekräfta ditt konto behöver du öppna länken i Safari istället.
          </p>

          <div className="space-y-4">
            {isMobile ? (
              <>
                <div className="bg-primary-foreground/10 rounded-lg p-4 mb-4">
                  <div className="flex items-start space-x-3 text-left">
                    <Smartphone className="h-5 w-5 text-primary-foreground mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-primary-foreground/90">
                      <p className="font-semibold mb-1">Steg-för-steg:</p>
                      <ol className="list-decimal list-inside space-y-1">
                        <li>Kopiera länken nedan</li>
                        <li>Öppna Safari-appen</li>
                        <li>Klistra in länken i adressfältet</li>
                        <li>Tryck "Gå" för att bekräfta ditt konto</li>
                      </ol>
                    </div>
                  </div>
                </div>

                <Button 
                  onClick={copyUrlToClipboard}
                  className="w-full"
                  variant="outline"
                >
                  {copySuccess ? (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Kopierad!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      Kopiera länk
                    </>
                  )}
                </Button>

                <div className="text-sm text-primary-foreground/60 text-center">
                  eller
                </div>

                <Button 
                  onClick={openInSafari}
                  className="w-full"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Försök öppna i Safari
                </Button>
              </>
            ) : (
              <Button 
                onClick={openInSafari}
                className="w-full"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Öppna i ny flik
              </Button>
            )}
          </div>

          <div className="mt-6 p-4 bg-blue-500/20 rounded-lg">
            <p className="text-sm text-primary-foreground/80">
              💡 <strong>Tips:</strong> Nästa gång, öppna emails direkt i Safari för smidigast upplevelse.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EmailRedirect;