import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

const EmailConfirm = () => {
  const [status, setStatus] = useState<'loading' | 'success' | 'already-confirmed' | 'error'>('loading');
  const [message, setMessage] = useState('');
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
      
      // Hämta bekräftelsetoken från databasen
      const { data: confirmationData, error: fetchError } = await supabase
        .from('email_confirmations')
        .select('*')
        .eq('token', token)
        .maybeSingle();

      if (fetchError) {
        console.error('Error fetching confirmation:', fetchError);
        throw new Error('Kunde inte verifiera token');
      }

      if (!confirmationData) {
        setStatus('error');
        setMessage('Denna bekräftelselänk är inte längre giltig. Kontakta support om problemet kvarstår.');
        return;
      }

      // Kolla om token har gått ut
      if (new Date(confirmationData.expires_at) < new Date()) {
        setStatus('error');
        setMessage('Bekräftelselänken har gått ut. Du kan registrera dig igen med samma e-postadress.');
        return;
      }

      // Kolla om kontot redan är bekräftat
      if (confirmationData.confirmed_at) {
        console.log('Account already confirmed');
        setStatus('already-confirmed');
        setMessage('Ditt konto är redan aktiverat. Du kan logga in direkt.');
        return;
      }

      // Bekräfta användaren i auth.users via admin API
      const { error: updateError } = await supabase.auth.admin.updateUserById(
        confirmationData.user_id,
        { email_confirm: true }
      );

      if (updateError) {
        console.error('Error confirming user:', updateError);
        throw new Error('Kunde inte bekräfta konto');
      }

      // Uppdatera confirmed_at i email_confirmations
      const { error: confirmError } = await supabase
        .from('email_confirmations')
        .update({ confirmed_at: new Date().toISOString() })
        .eq('token', token);

      if (confirmError) {
        console.error('Error updating confirmation:', confirmError);
      }

      console.log('Email confirmation successful');
      setStatus('success');
      setMessage('Ditt konto har bekräftats framgångsrikt!');
    } catch (error: any) {
      console.log('Email confirmation error:', error);
      setStatus('error');
      setMessage('Ett oväntat fel inträffade. Kontakta support om problemet kvarstår.');
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
              <Loader2 className="h-16 w-16 text-white mx-auto mb-4 animate-spin" />
              <h2 className="text-2xl font-bold text-white mb-4">
                Bekräftar ditt konto...
              </h2>
              <p className="text-white mb-6">
                Vänta ett ögonblick medan vi aktiverar ditt konto.
              </p>
            </>
          )}
          
          {status === 'success' && (
            <>
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-white mb-4">
                Nu är kontot bekräftat! 🎉
              </h2>
              <p className="text-white mb-6">
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
              <h2 className="text-2xl font-bold text-white mb-4">
                Redan aktiverat
              </h2>
              <p className="text-white mb-6">
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
              <h2 className="text-2xl font-bold text-white mb-4">
                Ett fel inträffade
              </h2>
              <p className="text-white mb-6">
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