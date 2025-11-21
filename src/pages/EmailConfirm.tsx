import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

const EmailConfirm = () => {
  const [status, setStatus] = useState<'loading' | 'success' | 'already-confirmed' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const { confirmEmail } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const confirmToken = searchParams.get('confirm');
    const statusParam = searchParams.get('status');

    console.log('EmailConfirm - All URL params:', Object.fromEntries(searchParams.entries()));
    console.log('EmailConfirm - token:', confirmToken, 'Full URL:', window.location.href);
    console.log('EmailConfirm - User agent:', navigator.userAgent);

    // 1) Nytt autokonfirmerat läge (ingen token, men status=success)
    if (!confirmToken && statusParam === 'success') {
      console.log('Auto-confirm success mode detected');
      setStatus('success');
      setMessage('Fantastiskt! Ditt konto har skapats och är redan aktiverat. Du kan logga in direkt.');
      return;
    }
    
    // 2) Klassiskt token-baserat flöde
    if (!confirmToken) {
      console.log('No confirmation token found');
      setStatus('error');
      setMessage('Ingen bekräftelsetoken hittades i länken.');
      return;
    }

    console.log('Found confirmation token, starting confirmation process');
    handleEmailConfirmation(confirmToken);
  }, [searchParams]);

  const handleEmailConfirmation = async (token: string) => {
    try {
      console.log('Starting email confirmation with token:', token);
      const result = await confirmEmail(token);
      console.log('Email confirmation successful:', result);
      setStatus('success');
      setMessage(result.message);
    } catch (error: any) {
      console.log('Email confirmation error:', error);
      const errorMessage = error.message || 'Ett fel inträffade vid bekräftelse av e-post';
      
      if (errorMessage.includes('redan bekräftad') || errorMessage.includes('already')) {
        setStatus('already-confirmed');
        setMessage('Ditt konto är redan aktiverat. Du kan logga in direkt.');
      } else if (errorMessage.includes('utgången') || errorMessage.includes('expired')) {
        setStatus('error');
        setMessage('Bekräftelselänken har gått ut. Du kan registrera dig igen med samma e-postadress.');
      } else {
        setStatus('error');
        setMessage('Denna bekräftelselänk är inte längre giltig. Kontakta support om problemet kvarstår.');
      }
    }
  };

  const handleGoToLogin = () => {
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-gradient-parium flex items-center justify-center p-4 smooth-scroll touch-pan" style={{ WebkitOverflowScrolling: 'touch' }}>
      <Card className="w-full max-w-md bg-white/5 backdrop-blur-sm border border-white/10 shadow-2xl rounded-3xl">
        <CardContent className="p-8 text-center">
          {status === 'loading' && (
            <>
              <Loader2 className="h-16 w-16 text-primary-foreground mx-auto mb-4 animate-spin" />
              <h2 className="text-2xl font-bold text-primary-foreground mb-4">
                Bekräftar ditt konto...
              </h2>
              <p className="text-primary-foreground/80 mb-6">
                Vänta ett ögonblick medan vi aktiverar ditt konto.
              </p>
            </>
          )}
          
          {status === 'success' && (
            <>
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-primary-foreground mb-4">
                Nu är kontot bekräftat! 🎉
              </h2>
              <p className="text-primary-foreground/80 mb-6">
                Ditt konto är nu aktiverat och redo att användas. Du kan logga in och börja använda Parium!
              </p>
              <Button 
                onClick={handleGoToLogin}
                className="w-full"
              >
                Logga in
              </Button>
            </>
          )}
          
          {status === 'already-confirmed' && (
            <>
              <h2 className="text-2xl font-bold text-primary-foreground mb-4">
                Redan aktiverat
              </h2>
              <p className="text-primary-foreground/80 mb-6">
                Ditt konto är redan aktiverat och redo att användas.
              </p>
              <Button 
                onClick={handleGoToLogin}
                className="w-full"
              >
                Logga in
              </Button>
            </>
          )}
          
          {status === 'error' && (
            <>
              <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-primary-foreground mb-4">
                Ett fel inträffade
              </h2>
              <p className="text-primary-foreground/80 mb-6">
                {message}
              </p>
              <Button 
                onClick={handleGoToLogin}
                className="w-full"
              >
                Tillbaka till inloggning
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default EmailConfirm;