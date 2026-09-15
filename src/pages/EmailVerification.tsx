import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, AlertCircle, Mail, Smartphone, Copy } from 'lucide-react';

import { useToast } from '@/hooks/use-toast';
import * as QRCodeStylingModule from 'qr-code-styling';
// CJS/ESM interop: handle both default and namespace exports
const QRCodeStyling = (QRCodeStylingModule as any).default || QRCodeStylingModule;
const PUBLIC_APP_URL = 'https://www.parium.se';

const EmailVerification = () => {
  // PIN-metoden är borttagen: ingen PIN-kod skickas någonsin ut och knappen
  // visade "Konto aktiverat!" utan att något verifierades.
  const [verificationMethod, setVerificationMethod] = useState<'email' | 'qr'>('email');
  const [status, setStatus] = useState<'pending' | 'success' | 'error'>('pending');
  const [message, setMessage] = useState('');
  const [qrCode, setQrCode] = useState<any>(null);
  const [userEmail, setUserEmail] = useState('');
  const [confirmationUrl, setConfirmationUrl] = useState('');

  const { confirmEmail } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();


  useEffect(() => {
    const token = searchParams.get('confirm');
    const email = searchParams.get('email') || localStorage.getItem('pending-verification-email') || '';
    
    setUserEmail(email);
    
    if (token) {
      const fullUrl = `${PUBLIC_APP_URL}/confirm?confirm=${token}`;
      setConfirmationUrl(fullUrl);
      
      // Skapa QR-kod
      const qr = new QRCodeStyling({
        width: 200,
        height: 200,
        type: "svg",
        data: fullUrl,
        dotsOptions: {
          color: "#1E3A8A",
          type: "rounded"
        },
        backgroundOptions: {
          color: "#ffffff",
        },
        imageOptions: {
          crossOrigin: "anonymous",
          margin: 10
        }
      });
      setQrCode(qr);
    }
  }, [searchParams]);

  const handleEmailConfirmation = async (token: string) => {
    try {
      const result = await confirmEmail(token);
      setStatus('success');
      setMessage(result.message);
      localStorage.removeItem('pending-verification-email');
      setTimeout(() => navigate('/auth'), 3000);
    } catch (error: any) {
      const raw = String(error?.message ?? '').toLowerCase();
      setStatus('error');
      if (raw.includes('redan') || raw.includes('already')) {
        setMessage('Ditt konto är redan aktiverat. Du kan logga in direkt.');
      } else if (raw.includes('utgången') || raw.includes('expired')) {
        setMessage('Bekräftelselänken har gått ut. Du kan registrera dig igen med samma e-postadress.');
      } else {
        setMessage('Denna bekräftelselänk är inte längre giltig. Kontakta support om problemet kvarstår.');
      }
    }
  };


  const copyUrlToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(confirmationUrl);
      toast({
        title: "Länk kopierad!",
        description: "Öppna Safari och klistra in länken.",
      });
    } catch (err) {
      toast({
        title: "Kunde inte kopiera",
        description: "Kopiera länken manuellt",
        variant: "destructive"
      });
    }
  };

  // Effekten låg tidigare inne i renderfunktionen och kördes bara när
  // QR-fliken var vald — antalet hooks ändrades då vid flikbyte och React
  // kraschade. Nu ligger den på toppnivå och körs alltid.
  useEffect(() => {
    if (qrCode && verificationMethod === 'qr') {
      const qrContainer = document.getElementById('qr-code-container');
      if (qrContainer) {
        qrContainer.innerHTML = '';
        qrCode.append(qrContainer);
      }
    }
  }, [qrCode, verificationMethod]);

  const renderQRCode = () => (
    <div id="qr-code-container" className="flex justify-center mb-4"></div>
  );


  if (status === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary via-primary-glow to-primary-dark flex items-center justify-center p-4 smooth-scroll touch-pan" style={{ WebkitOverflowScrolling: 'touch' }}>
        <Card className="w-full max-w-md bg-glass backdrop-blur-md border-white/20">
          <CardContent className="p-8 text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-primary-foreground mb-4">
              Konto aktiverat!
            </h2>
            <p className="text-primary-foreground/80 mb-6">
              {message}
            </p>
            <p className="text-primary-foreground/60 text-sm">
              Du omdirigeras till inloggningssidan...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary via-primary-glow to-primary-dark flex items-center justify-center p-4 smooth-scroll touch-pan" style={{ WebkitOverflowScrolling: 'touch' }}>
        <Card className="w-full max-w-md bg-glass backdrop-blur-md border-white/20">
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-primary-foreground mb-4">
              Ett fel inträffade
            </h2>
            <p className="text-primary-foreground/80 mb-6">
              {message}
            </p>
            <Button onClick={() => navigate('/auth')} className="w-full">
              Tillbaka till inloggning
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary via-primary-glow to-primary-dark flex items-center justify-center p-4 smooth-scroll touch-pan" style={{ WebkitOverflowScrolling: 'touch' }}>
      <Card className="w-full max-w-md bg-glass backdrop-blur-md border-white/20">
        <CardContent className="p-8">
          <div className="text-center mb-6">
            <Mail className="h-12 w-12 text-primary-foreground mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-primary-foreground mb-2">
              Bekräfta ditt konto
            </h2>
            <p className="text-primary-foreground/80 text-sm">
              Vi skickade en bekräftelse till<br />
              <strong>{userEmail}</strong>
            </p>
          </div>

          {/* Metod-väljare */}
          <div className="grid grid-cols-2 gap-2 mb-6">
            <Button
              variant={verificationMethod === 'email' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setVerificationMethod('email')}
              className="text-sm"
            >
              <Mail className="h-3 w-3 mr-1" />
              Email
            </Button>
            <Button
              variant={verificationMethod === 'qr' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setVerificationMethod('qr')}
              className="text-sm"
            >
              <Smartphone className="h-3 w-3 mr-1" />
              QR-kod
            </Button>
          </div>


          {/* Email-metod */}
          {verificationMethod === 'email' && (
            <div className="space-y-4">
              <div className="bg-primary-foreground/10 rounded-lg p-4">
                <p className="text-sm text-primary-foreground/90 mb-3">
                  <strong>Öppnar länken i Gmail-appen?</strong><br />
                  Kopiera länken och öppna den i Safari istället:
                </p>
                <Button 
                  onClick={copyUrlToClipboard}
                  variant="outline"
                  size="sm"
                  className="w-full"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Kopiera bekräftelselänk
                </Button>
              </div>
              <p className="text-sm text-primary-foreground/60 text-center">
                Kolla din inkorg och följ länken i emailet.
              </p>
            </div>
          )}

          {/* QR-kod metod */}
          {verificationMethod === 'qr' && (
            <div className="space-y-4">
              {renderQRCode()}
              <div className="bg-blue-500/20 rounded-lg p-4">
                <p className="text-sm text-primary-foreground/90 text-center">
                  <strong>Skanna QR-koden</strong><br />
                  Öppna kameran på din telefon och skanna koden ovan
                </p>
              </div>
            </div>
          )}




          <div className="mt-6 text-center">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigate('/auth')}
              className="text-primary-foreground/60"
            >
              Tillbaka till inloggning
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EmailVerification;