import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { consumeAuthBootstrapCredentials } from '@/lib/authBootstrapCredentials';

const EmailConfirm = () => {
  const [status, setStatus] = useState<'loading' | 'success' | 'already-confirmed' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [credential] = useState(consumeAuthBootstrapCredentials);
  const { confirmEmail } = useAuth();
  const navigate = useNavigate();
  const attemptedRef = useRef(false);

  const handleEmailConfirmation = useCallback(async () => {
    if (credential?.family !== 'custom_confirm') {
      setStatus('error');
      setMessage('Ingen bekräftelsetoken hittades i länken.');
      return;
    }

    setStatus('loading');
    try {
      const result = await confirmEmail(credential.confirmToken);
      if (result.processed !== true) throw new Error('Confirmation not processed');
      const resultMessage = result.message || '';
      const lowerMessage = resultMessage.toLowerCase();

      if (lowerMessage.includes('redan') &&
          (lowerMessage.includes('aktiverat') || lowerMessage.includes('bekräftad'))) {
        setStatus('already-confirmed');
      } else {
        setStatus('success');
      }
      setMessage(resultMessage);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error
        ? error.message
        : 'Ett fel inträffade vid bekräftelse av e-post';
      const normalizedError = errorMessage.toLowerCase();

      if (normalizedError.includes('redan bekräftad') || normalizedError.includes('already')) {
        setStatus('already-confirmed');
        setMessage('Ditt konto är redan aktiverat. Du kan logga in direkt.');
      } else if (normalizedError.includes('utgången') || normalizedError.includes('expired')) {
        setStatus('error');
        setMessage('Bekräftelselänken har gått ut. Du kan registrera dig igen med samma e-postadress.');
      } else {
        setStatus('error');
        setMessage('Denna bekräftelselänk är inte längre giltig. Kontakta support om problemet kvarstår.');
      }
    }
  }, [confirmEmail, credential]);

  useEffect(() => {
    if (attemptedRef.current) return;
    attemptedRef.current = true;
    void handleEmailConfirmation();
  }, [handleEmailConfirmation]);

  const handleGoToLogin = () => {
    navigate('/auth', { replace: true });
  };

  return (
    <div className="min-h-screen bg-gradient-parium flex items-center justify-center p-4 smooth-scroll touch-pan" style={{ WebkitOverflowScrolling: 'touch' }}>
      <Card className="w-full max-w-md bg-white/5 backdrop-blur-sm border border-white/10 hover:border-white/50 shadow-2xl rounded-3xl">
        <CardContent className="p-8 text-center">
          {status === 'loading' && (
            <div
              role="status"
              aria-live="polite"
              aria-atomic="true"
              aria-busy="true"
            >
              <Loader2 aria-hidden="true" className="h-16 w-16 text-white mx-auto mb-4 animate-spin" />
              <h2 className="text-xl md:text-2xl font-semibold text-white tracking-tight mb-4">
                Bekräftar ditt konto...
              </h2>
              <p className="text-sm text-white mb-6">
                Vänta ett ögonblick medan vi aktiverar ditt konto.
              </p>
            </div>
          )}
          
          {status === 'success' && (
            <>
              <div role="status" aria-live="polite" aria-atomic="true">
                <CheckCircle aria-hidden="true" className="h-16 w-16 text-green-500 mx-auto mb-4" />
                <h2 className="text-xl md:text-2xl font-semibold text-white tracking-tight mb-4">
                  Nu är kontot bekräftat! 🎉
                </h2>
                <p className="text-sm text-white mb-6">
                  Ditt konto är nu aktiverat och redo att användas. Du kan logga in och börja använda Parium!
                </p>
              </div>
              <Button 
                onClick={handleGoToLogin}
                variant="glass"
                className="w-full"
              >
                Logga in
              </Button>
            </>
          )}
          
          {status === 'already-confirmed' && (
            <>
              <div role="status" aria-live="polite" aria-atomic="true">
                <h2 className="text-xl md:text-2xl font-semibold text-white tracking-tight mb-4">
                  Redan aktiverat 🎉
                </h2>
                <p className="text-sm text-white mb-6">
                  Ditt konto är redan aktiverat och redo att användas.
                </p>
              </div>
              <Button 
                onClick={handleGoToLogin}
                variant="glass"
                className="w-full"
              >
                Logga in
              </Button>
            </>
          )}
          
          {status === 'error' && (
            <>
              <div role="alert" aria-live="assertive" aria-atomic="true">
                <AlertCircle aria-hidden="true" className="h-16 w-16 text-red-500 mx-auto mb-4" />
                <h2 className="text-xl md:text-2xl font-semibold text-white tracking-tight mb-4">
                  Ett fel inträffade
                </h2>
                <p className="text-sm text-white mb-6">
                  {message}
                </p>
              </div>
              <div className="space-y-3">
                {credential?.family === 'custom_confirm' && (
                  <Button
                    type="button"
                    onClick={() => void handleEmailConfirmation()}
                    variant="glass"
                    className="w-full"
                  >
                    Försök igen
                  </Button>
                )}
                <Button
                  onClick={handleGoToLogin}
                  variant="glass"
                  className="w-full"
                >
                  Tillbaka till inloggning
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default EmailConfirm;
