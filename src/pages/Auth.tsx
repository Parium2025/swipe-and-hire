import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useDevice } from '@/hooks/use-device';
import AnimatedIntro from '@/components/AnimatedIntro';
import AuthMobile from '@/components/AuthMobile';
import AuthTablet from '@/components/AuthTablet';
import AuthDesktop from '@/components/AuthDesktop';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CheckCircle, AlertCircle } from 'lucide-react';

const Auth = () => {
  const [showIntro, setShowIntro] = useState(() => {
    return !sessionStorage.getItem('parium-intro-seen');
  });
  const [isPasswordReset, setIsPasswordReset] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [confirmationStatus, setConfirmationStatus] = useState<'none' | 'success' | 'already-confirmed' | 'error'>('none');
  const [confirmationMessage, setConfirmationMessage] = useState('');
  const [recoveryStatus, setRecoveryStatus] = useState<'none' | 'expired' | 'invalid'>('none');
  const [emailForReset, setEmailForReset] = useState('');
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState('');

  const { user, updatePassword, confirmEmail } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const device = useDevice();

  useEffect(() => {
    const isReset = searchParams.get('reset') === 'true';
    const confirmed = searchParams.get('confirmed');
    
    // Hantera recovery tokens från Supabase auth (olika format) + URL-hash
    const accessTokenQP = searchParams.get('access_token');
    const refreshTokenQP = searchParams.get('refresh_token');
    const tokenTypeQP = searchParams.get('type');
    const tokenParamQP = searchParams.get('token');
    const tokenHashParamQP = searchParams.get('token_hash');
    const errorCodeQP = searchParams.get('error_code') || searchParams.get('error');
    const errorDescQP = searchParams.get('error_description') || searchParams.get('error_message');

    const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '';
    const hashParams = new URLSearchParams(hash);
    const accessTokenHash = hashParams.get('access_token');
    const refreshTokenHash = hashParams.get('refresh_token');
    const tokenTypeHash = hashParams.get('type');
    const tokenParamHash = hashParams.get('token');
    const tokenHashParamHash = hashParams.get('token_hash');
    const errorCodeHash = hashParams.get('error_code') || hashParams.get('error');
    const errorDescHash = hashParams.get('error_description') || hashParams.get('error_message');

    // Slutliga värden (hash vinner över query)
    const accessToken = accessTokenHash || accessTokenQP || undefined;
    const refreshToken = refreshTokenHash || refreshTokenQP || undefined;
    const tokenType = tokenTypeHash || tokenTypeQP || undefined;
    const tokenParam = tokenParamHash || tokenParamQP || undefined;
    const tokenHashParam = tokenHashParamHash || tokenHashParamQP || undefined;
    
    console.log('Auth useEffect - URL params:', { 
      isReset, 
      confirmed, 
      currentUrl: window.location.href,
      hasTokens: !!accessToken && !!refreshToken,
      hasSupabaseToken: !!(tokenParam || tokenHashParam),
      tokenType,
    });

    // Fånga fel från Supabase verify endpoint och fall utan tokens
    const errorCode = errorCodeHash || errorCodeQP || undefined;
    const errorDescription = errorDescHash || errorDescQP || undefined;
    const hasError = !!(errorCode || errorDescription);
    const noAnyRecoveryTokens = !(accessToken || refreshToken || tokenParam || tokenHashParam);

    if (hasError || (tokenType === 'recovery' && noAnyRecoveryTokens)) {
      const desc = (errorCode || errorDescription || '').toLowerCase();
      if (desc.includes('expire') || desc.includes('invalid') || desc.includes('session')) {
        setRecoveryStatus('expired');
      } else {
        setRecoveryStatus('invalid');
      }
      setShowIntro(false);
      return;
    }
    
    // Om vi har recovery tokens, hantera dem (stöd för flera format)
    const hasAccessPair = !!(accessToken && refreshToken);
    const hasTokenHash = !!tokenHashParam;
    const hasToken = !!tokenParam;
    if (hasAccessPair || hasTokenHash || hasToken) {
      console.log('Recovery tokens detected, proceeding to verify/session...');

      setShowIntro(false);

      if (hasTokenHash || hasToken) {
        // Verifiera token_hash eller token direkt
        const verifyOptions: any = { type: 'recovery' };
        if (hasTokenHash) verifyOptions.token_hash = tokenHashParam;
        if (hasToken) verifyOptions.token = tokenParam;
        supabase.auth.verifyOtp(verifyOptions).then(({ error }) => {
          if (error) {
            console.error('Error with recovery token:', error);

            // Fallback: försök Supabase verify endpoint som sätter session och redirectar tillbaka till /auth
            try {
              const projectUrl = 'https://rvtsfnaqlnggfkoqygbm.supabase.co';
              const paramName = hasTokenHash ? 'token_hash' : 'token';
              const tokenValue = hasTokenHash ? tokenHashParam! : tokenParam!;
              if (tokenValue) {
                const redirectTo = `${window.location.origin}/auth?reset=true`;
                const verifyUrl = `${projectUrl}/auth/v1/verify?type=recovery&${paramName}=${encodeURIComponent(tokenValue)}&redirect_to=${encodeURIComponent(redirectTo)}`;
                console.log('Falling back to Supabase verify endpoint:', verifyUrl);
                window.location.replace(verifyUrl);
                return; // avbryt lokal felhantering, låt verify flödet ta över
              }
            } catch (e) {
              console.warn('Verify fallback construction failed:', e);
            }

            const msg = (error as any)?.message?.toLowerCase() || '';
            if (msg.includes('expired') || msg.includes('invalid') || msg.includes('session')) {
              setRecoveryStatus('expired');
            } else {
              setRecoveryStatus('invalid');
            }
            setShowIntro(false);
          } else {
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.delete('token');
            newUrl.searchParams.delete('token_hash');
            newUrl.searchParams.delete('type');
            newUrl.searchParams.delete('redirect_to');
            newUrl.searchParams.set('reset', 'true');
            window.history.replaceState({}, '', newUrl.toString());
            setIsPasswordReset(true);
          }
        });
      } else if (hasAccessPair) {
        // Sätt session från access+refresh
        supabase.auth.setSession({
          access_token: accessToken!,
          refresh_token: refreshToken!
        }).then(({ error }) => {
          if (error) {
            console.error('Error setting session:', error);
            setRecoveryStatus('expired');
            setShowIntro(false);
          } else {
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.delete('access_token');
            newUrl.searchParams.delete('refresh_token');
            newUrl.searchParams.delete('type');
            newUrl.searchParams.set('reset', 'true');
            window.history.replaceState({}, '', newUrl.toString());
            setIsPasswordReset(true);
          }
        });
      }
      return;
    }
    
    // Hantera bekräftelsestatusmeddelanden från redirect
    if (confirmed === 'success') {
      setConfirmationStatus('success');
      setConfirmationMessage('🎉 Fantastiskt! Ditt konto har aktiverats och du kan nu logga in i Parium.');
      console.log('Showing success confirmation message');
    } else if (confirmed === 'already') {
      setConfirmationStatus('already-confirmed');
      setConfirmationMessage('✅ Perfekt! Ditt konto är redan aktiverat och redo att användas.');
      console.log('Showing already confirmed message');
    }
    
    setIsPasswordReset(isReset);
    
    // If user is logged in, redirect to home immediately (but not during recovery flow)
    const hasRecoveryParamsNow = isReset || !!accessToken || !!refreshToken || !!tokenParam || !!tokenHashParam || tokenType === 'recovery';
    if (user && !hasRecoveryParamsNow && confirmationStatus === 'none' && recoveryStatus === 'none' && !confirmed) {
      console.log('User is logged in, redirecting to home');
      navigate('/');
    }
  }, [user, navigate, searchParams, confirmationStatus, recoveryStatus]);

  const handleEmailConfirmation = async (token: string) => {
    console.log('Starting email confirmation with token:', token);
    
    try {
      const result = await confirmEmail(token);
      console.log('Email confirmation successful:', result);
      setConfirmationStatus('success');
      setConfirmationMessage(result.message);
    } catch (error: any) {
      console.log('Email confirmation error:', error);
      const errorMessage = error.message || 'Ett fel inträffade vid bekräftelse av e-post';
      
      // Kolla om det är "redan bekräftad" felet
      if (errorMessage.includes('redan bekräftad') || errorMessage.includes('already')) {
        console.log('Account already confirmed');
        setConfirmationStatus('already-confirmed');
        setConfirmationMessage('Ditt konto är redan aktiverat. Du kan logga in direkt.');
      } else if (errorMessage.includes('utgången') || errorMessage.includes('expired')) {
        console.log('Confirmation link expired');
        setConfirmationStatus('error');
        setConfirmationMessage('Bekräftelselänken har gått ut. Du kan registrera dig igen med samma e-postadress.');
      } else {
        console.log('Other confirmation error');
        setConfirmationStatus('error');
        setConfirmationMessage('Denna bekräftelselänk är inte längre giltig. Kontakta support om problemet kvarstår.');
      }
    }
    
    // Ta bort confirm parametern från URL
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.delete('confirm');
    const newUrl = `/auth?${newSearchParams.toString()}`;
    console.log('Navigating to:', newUrl);
    navigate(newUrl, { replace: true });
  };

  const handleResendReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResendMessage('');
    setResending(true);
    try {
      if (!emailForReset) return;
      const { error } = await supabase.functions.invoke('send-reset-password', {
        body: { email: emailForReset }
      });
      if (error) throw error;
      setResendMessage('Ny återställningslänk skickad! Kolla din e‑post.');
    } catch (err: any) {
      console.error('Resend reset error:', err);
      setResendMessage('Kunde inte skicka länk. Kontrollera e‑postadressen och försök igen.');
    } finally {
      setResending(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      alert('Lösenorden matchar inte');
      return;
    }
    
    if (newPassword.length < 6) {
      alert('Lösenordet måste vara minst 6 tecken långt');
      return;
    }
    
    const result = await updatePassword(newPassword);
    
    if (!result.error) {
      navigate('/');
    }
  };

  // Visa UI för utgången/ogiltig återställningslänk
  if (recoveryStatus !== 'none') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary via-primary-glow to-primary-dark flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-glass backdrop-blur-md border-white/20">
          <CardContent className="p-8 text-center space-y-4">
            <AlertCircle className="h-16 w-16 text-red-500 mx-auto" />
            <h2 className="text-2xl font-bold text-primary-foreground">Återställningslänken har gått ut</h2>
            <p className="text-primary-foreground/80">Skriv din e‑postadress så skickar vi en ny länk för att återställa ditt lösenord.</p>
            <form onSubmit={handleResendReset} className="space-y-3">
              <Input
                type="email"
                placeholder="din@epost.se"
                value={emailForReset}
                onChange={(e) => setEmailForReset(e.target.value)}
                required
                disabled={resending}
              />
              <Button type="submit" className="w-full" disabled={resending}>
                {resending ? 'Skickar...' : 'Skicka ny länk'}
              </Button>
            </form>
            {resendMessage && (
              <p className="text-sm text-primary-foreground/80">{resendMessage}</p>
            )}
            <Button variant="outline" onClick={() => navigate('/')} className="w-full">
              Tillbaka till inloggning
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (showIntro) {
    return (
      <AnimatedIntro onComplete={() => {
        setShowIntro(false);
        sessionStorage.setItem('parium-intro-seen', 'true');
      }} />
    );
  }

  // Visa bekräftelsestatus om det finns en
  if (confirmationStatus !== 'none') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary via-primary-glow to-primary-dark flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-glass backdrop-blur-md border-white/20">
          <CardContent className="p-8 text-center">
            {confirmationStatus === 'success' && (
              <>
                <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-primary-foreground mb-4">
                  Konto aktiverat!
                </h2>
                <p className="text-primary-foreground/80 mb-6">
                  {confirmationMessage}
                </p>
                <Button 
                  onClick={() => {
                    setConfirmationStatus('none');
                    navigate('/auth', { replace: true });
                  }}
                  className="w-full"
                >
                  Logga in
                </Button>
              </>
            )}
            
            {confirmationStatus === 'already-confirmed' && (
              <>
                <CheckCircle className="h-16 w-16 text-blue-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-primary-foreground mb-4">
                  Redan aktiverat
                </h2>
                <p className="text-primary-foreground/80 mb-6">
                  {confirmationMessage}
                </p>
                <Button 
                  onClick={() => {
                    setConfirmationStatus('none');
                    navigate('/auth', { replace: true });
                  }}
                  className="w-full"
                >
                  Logga in
                </Button>
              </>
            )}
            
            {confirmationStatus === 'error' && (
              <>
                <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-primary-foreground mb-4">
                  Ett fel inträffade
                </h2>
                <p className="text-primary-foreground/80 mb-6">
                  {confirmationMessage}
                </p>
                <Button 
                  onClick={() => {
                    setConfirmationStatus('none');
                    navigate('/auth', { replace: true });
                  }}
                  className="w-full"
                >
                  Försök igen
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Använd rätt komponent baserat på skärmstorlek
  if (device === 'mobile') {
    return (
      <AuthMobile
        isPasswordReset={isPasswordReset}
        newPassword={newPassword}
        setNewPassword={setNewPassword}
        confirmPassword={confirmPassword}
        setConfirmPassword={setConfirmPassword}
        handlePasswordReset={handlePasswordReset}
      />
    );
  }

  if (device === 'tablet') {
    return (
      <AuthTablet
        isPasswordReset={isPasswordReset}
        newPassword={newPassword}
        setNewPassword={setNewPassword}
        confirmPassword={confirmPassword}
        setConfirmPassword={setConfirmPassword}
        handlePasswordReset={handlePasswordReset}
      />
    );
  }

  return (
    <AuthDesktop
      isPasswordReset={isPasswordReset}
      newPassword={newPassword}
      setNewPassword={setNewPassword}
      confirmPassword={confirmPassword}
      setConfirmPassword={setConfirmPassword}
      handlePasswordReset={handlePasswordReset}
    />
  );
};

export default Auth;