import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExternalLink, Smartphone, AlertTriangle, Copy, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  consumeAuthBootstrapCredentials,
  forwardCustomConfirmationCredential,
} from '@/lib/authBootstrapCredentials';
import { buildExternalConfirmationUrl } from '@/lib/authLinkRouting';

const PUBLIC_APP_URL = 'https://www.parium.se';

const EmailRedirect = () => {
  const [isInAppBrowser, setIsInAppBrowser] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [credential] = useState(consumeAuthBootstrapCredentials);
  const confirmToken = credential?.family === 'custom_confirm'
    ? credential.confirmToken
    : null;
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
    
    // In the same document the token is handed to /confirm only through the
    // one-time memory channel. It is never serialized back into the URL.
    if (!inApp && confirmToken && forwardCustomConfirmationCredential(credential)) {
      navigate('/confirm', { replace: true });
    }
  }, [confirmToken, credential, navigate]);

  const copyUrlToClipboard = async () => {
    if (!confirmToken) return;
    const url = buildExternalConfirmationUrl(PUBLIC_APP_URL, confirmToken);
    
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable');
      await navigator.clipboard.writeText(url);
      setCopySuccess(true);
      toast({
        title: "Länk kopierad!",
        description: "Öppna nu Safari och klistra in länken.",
      });
      setTimeout(() => setCopySuccess(false), 3000);
    } catch {
      toast({
        title: "Kunde inte kopiera",
        description: "Tryck i stället på ”Försök öppna i Safari”. Om det blockeras, öppna mejlet direkt i Safari och tryck på länken igen.",
        variant: "destructive"
      });
    }
  };

  const openInSafari = () => {
    if (!confirmToken) return;
    const url = buildExternalConfirmationUrl(PUBLIC_APP_URL, confirmToken);
    
    // Försök öppna i Safari
    if (isMobile) {
      window.location.href = url;
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  if (!confirmToken) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary via-primary-glow to-primary-dark flex items-center justify-center p-4 smooth-scroll touch-pan" style={{ WebkitOverflowScrolling: 'touch' }}>
        <Card className="w-full max-w-md bg-glass backdrop-blur-md border-white/20">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-primary-foreground mb-4">
              Ogiltig bekräftelselänk
            </h2>
            <p className="text-primary-foreground/80 mb-6">
              Länken saknar giltiga bekräftelseuppgifter. Begär en ny länk och försök igen.
            </p>
            <Button onClick={() => navigate('/auth', { replace: true })} className="w-full">
              Tillbaka till inloggning
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

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
