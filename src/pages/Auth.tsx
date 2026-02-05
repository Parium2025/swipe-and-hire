import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useDevice } from '@/hooks/use-device';
import { useToast } from '@/hooks/use-toast';
// AnimatedIntro removed - using index.html splash instead
import AuthMobile from '@/components/AuthMobile';
import AuthTablet from '@/components/AuthTablet';
import AuthDesktop from '@/components/AuthDesktop';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

// Debug logging on /auth is surprisingly expensive (it runs during first paint and can cause visible jank).
// Keep it OFF by default; enable locally only when you explicitly need to debug auth flows.
const AUTH_DEBUG = false;

const Auth = () => {
  // Clear skip-splash flag on mount (used when navigating from landing)
  useEffect(() => {
    sessionStorage.removeItem('parium-skip-splash');
  }, []);

  // AnimatedIntro removed - index.html splash handles the loading screen now
  const [isPasswordReset, setIsPasswordReset] = useState(() => {
    try {
      const loc = typeof window !== 'undefined' ? window.location : null;
      if (!loc) return false;
      const sp = new URLSearchParams(loc.search);
      const hashStr = loc.hash && loc.hash.startsWith('#') ? loc.hash.slice(1) : '';
      const hp = new URLSearchParams(hashStr);
      const hasAccessPair = !!(hp.get('access_token') || sp.get('access_token')) && !!(hp.get('refresh_token') || sp.get('refresh_token'));
      const hasTokenHash = !!(hp.get('token_hash') || sp.get('token_hash'));
      const hasToken = !!(hp.get('token') || sp.get('token'));
      const type = hp.get('type') || sp.get('type');
      return hasAccessPair || hasTokenHash || hasToken || type === 'recovery' || sp.get('reset') === 'true';
    } catch {
      return false;
    }
  });
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [confirmationStatus, setConfirmationStatus] = useState<'none' | 'success' | 'already-confirmed' | 'error'>('none');
  const [confirmationMessage, setConfirmationMessage] = useState('');
  const [recoveryStatus, setRecoveryStatus] = useState<'none' | 'expired' | 'consumed' | 'invalid' | 'used'>('none');
  const [emailForReset, setEmailForReset] = useState('');
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const [isLoginMode, setIsLoginMode] = useState(true); // Track if user is on login or register

  const { user, profile, loading, authAction, updatePassword, confirmEmail } = useAuth();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const device = useDevice();
  const { toast } = useToast();

  // Read initial state from navigation (from Landing page)
  const initialMode = (location.state as any)?.mode;
  const initialRole = (location.state as any)?.role;

  // Failsafe: rensa ev. fastnade scroll-lås från äldre versioner.
  // (Vi använder inte scroll-låsning på /auth längre.)
  useEffect(() => {
    try {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
      document.documentElement.classList.remove('auth-locked', 'auth-lock');
      document.body.classList.remove('auth-locked', 'auth-lock');
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const handleAuthFlow = async () => {
      const isReset = searchParams.get('reset') === 'true';
      const confirmed = searchParams.get('confirmed');
      
      // Parsa hash tidigt så vi kan använda det för token-verifiering
      const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '';
      const hashParams = new URLSearchParams(hash);
      
      if (AUTH_DEBUG) {
        console.log('🔍 AUTH FLOW DEBUG:', {
          isReset,
          url: window.location.href,
          searchParams: Array.from(searchParams.entries()),
          hasToken: !!searchParams.get('token'),
          hasTokenHash: !!searchParams.get('token_hash'),
          hasIssued: !!searchParams.get('issued'),
          issuedValue: searchParams.get('issued')
        });
      }
      
      // FÖRSTA KONTROLLEN: Är det en reset-länk?
      if (isReset) {
        console.log('✅ Reset-länk detekterad');
        
        // ANDRA KONTROLLEN: Kontrollera expired/used parameter från redirect-funktionen
        const isExpired = searchParams.get('expired') === 'true';
        const isUsed = searchParams.get('used') === 'true';
        const isTokenUsed = searchParams.get('token_used') === 'true';
        
        if (isExpired) {
          console.log('❌ EXPIRED parameter - Visar expired sida');
          setRecoveryStatus('expired');
          return;
        }
        if (isUsed) {
          console.log('❌ USED parameter - Visar used sida');
          setRecoveryStatus('used');
          return;
        }
        if (isTokenUsed) {
          console.log('❌ TOKEN_USED parameter - Token redan använd');
          setRecoveryStatus('consumed');
          return;
        }
        
        // TREDJE KONTROLLEN: Visa formuläret direkt - verifiera token först vid password submission
        const tokenHashParam = searchParams.get('token_hash') || hashParams.get('token_hash');
        const tokenParam = searchParams.get('token') || hashParams.get('token');
        
        if (tokenHashParam || tokenParam) {
          console.log('✅ Reset-token detekterad - visar formulär (verifiering sker vid password submission)');
          setIsPasswordReset(true);
        } else {
          console.log('✅ Reset utan token - visar formulär');
          setIsPasswordReset(true);
        }
      }
      
      // Hantera recovery tokens från Supabase auth (olika format)
      const accessTokenQP = searchParams.get('access_token');
      const refreshTokenQP = searchParams.get('refresh_token');
      const tokenTypeQP = searchParams.get('type');
      const tokenParamQP = searchParams.get('token');
      const tokenHashParamQP = searchParams.get('token_hash');
      const errorCodeQP = searchParams.get('error_code') || searchParams.get('error');
      const errorDescQP = searchParams.get('error_description') || searchParams.get('error_message');
      const issuedQP = searchParams.get('issued');

      // hashParams redan skapad tidigare för token-verifiering
      const accessTokenHash = hashParams.get('access_token');
      const refreshTokenHash = hashParams.get('refresh_token');
      const tokenTypeHash = hashParams.get('type');
      const tokenParamHash = hashParams.get('token');
      const tokenHashParamHash = hashParams.get('token_hash');
      const errorCodeHash = hashParams.get('error_code') || hashParams.get('error');
      const errorDescHash = hashParams.get('error_description') || hashParams.get('error_message');
      const issuedHash = hashParams.get('issued');

      // Slutliga värden (hash vinner över query)
      const accessToken = accessTokenHash || accessTokenQP || undefined;
      const refreshToken = refreshTokenHash || refreshTokenQP || undefined;
      const tokenType = tokenTypeHash || tokenTypeQP || undefined;
      const tokenParam = tokenParamHash || tokenParamQP || undefined;
      const tokenHashParam = tokenHashParamHash || tokenHashParamQP || undefined;
      const issued = issuedHash || issuedQP || undefined;
      const issuedMs = issued ? parseInt(issued, 10) : undefined;
      
      if (AUTH_DEBUG) {
        console.log('🔍 DETALJERAD TOKEN-DEBUG:', {
          issuedQP,
          issuedHash,
          issued,
          issuedMs,
          currentTime: Date.now(),
          url: window.location.href
        });
      }
      
      if (AUTH_DEBUG) {
        console.log('Auth useEffect - URL params:', { 
          isReset, 
          confirmed, 
          currentUrl: window.location.href,
          hasTokens: !!accessToken && !!refreshToken,
          hasSupabaseToken: !!(tokenParam || tokenHashParam),
          tokenType,
          issuedMs
        });
      }

      // Fånga fel från Supabase verify endpoint och fall utan tokens
      const errorCode = errorCodeHash || errorCodeQP || undefined;
      const errorDescription = errorDescHash || errorDescQP || undefined;
      const hasError = !!(errorCode || errorDescription);
      const noAnyRecoveryTokens = !(accessToken || refreshToken || tokenParam || tokenHashParam);

      if (hasError || (tokenType === 'recovery' && noAnyRecoveryTokens)) {
        const desc = (errorCode || errorDescription || '').toLowerCase();
        if (AUTH_DEBUG) console.log('🔍 AUTH ERROR DETECTED:', { errorCode, errorDescription, desc });
        
        // Om tiden är OK men vi har fel = token redan använd
        if (desc.includes('expire') || desc.includes('invalid') || desc.includes('session') || 
            desc.includes('used') || desc.includes('consumed') || desc.includes('already') ||
            desc.includes('not found') || desc.includes('token')) {
          if (AUTH_DEBUG) console.log('❌ Token already used');
          setRecoveryStatus('used');
        } else {
          if (AUTH_DEBUG) console.log('❌ Setting recovery status to invalid due to unknown error');
          setRecoveryStatus('invalid');
        }
        // showIntro removed - index.html handles splash
        return;
      }
      
      // Om vi har recovery tokens, verifiera först om de är giltiga
      const hasAccessPair = !!(accessToken && refreshToken);
      const hasTokenHash = !!tokenHashParam;
      const hasToken = !!tokenParam;
      
      if (hasAccessPair || hasTokenHash || hasToken) {
        if (AUTH_DEBUG) console.log('🔍 Recovery token detekterad:', {
          hasAccessPair,
          hasTokenHash,
          hasToken,
          tokenHashParam,
          tokenParam,
          accessToken: accessToken ? 'exists' : 'missing',
          refreshToken: refreshToken ? 'exists' : 'missing'
        });
        
        if (AUTH_DEBUG) console.log('✅ Token är giltig - visar reset-formulär');
        // showIntro removed - index.html handles splash
        setIsPasswordReset(true);
        return;
      }
      
      // Hantera bekräftelsestatusmeddelanden från redirect
      if (confirmed === 'success') {
        setConfirmationStatus('success');
        setConfirmationMessage('Fantastiskt! Ditt konto har aktiverats och du kan nu logga in i Parium.');
        if (AUTH_DEBUG) console.log('Showing success confirmation message');
      } else if (confirmed === 'already') {
        setConfirmationStatus('already-confirmed');
        setConfirmationMessage('Ditt konto är redan aktiverat och redo att användas.');
        if (AUTH_DEBUG) console.log('Showing already confirmed message');
      }
      
      setIsPasswordReset(isReset);
      
      // Notera: Själva redirecten vid lyckad inloggning hanteras nu deklarativt
      // längre ner i render-funktionen via <Navigate>, för att undvika en
      // extra frame där formuläret blinkar till innan routing hinner ske.
    };

    handleAuthFlow();
  }, [user, profile, loading, navigate, searchParams, confirmationStatus, recoveryStatus]);

  // NYTT: Hantera email-confirm-länkar med ?confirm=TOKEN direkt på /auth
  useEffect(() => {
    const confirmToken = searchParams.get('confirm');

    if (confirmToken && confirmationStatus === 'none') {
      console.log('🔐 Auth: confirm token detected in URL, starting confirmation flow', confirmToken);
      handleEmailConfirmation(confirmToken);
    }
  }, [searchParams, confirmationStatus]);

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
      console.log('🔄 AUTH.TSX - SENDING RESET från Auth.tsx för:', emailForReset);
      const { error } = await supabase.functions.invoke('send-reset-password', {
        body: { email: emailForReset }
      });
      console.log('📩 AUTH.TSX - RESET RESPONSE:', { error });
      if (error) throw error;
      setResendMessage('Ny återställningslänk skickad! Kolla din e‑post.\nHittar du oss inte? Kolla skräpposten – vi kanske gömmer oss där.');
    } catch (err: any) {
      console.error('Resend reset error:', err);
      setResendMessage('Kunde inte skicka länk. Kontrollera e‑postadressen och försök igen.');
    } finally {
      setResending(false);
    }
  };

  const handleBackToLogin = () => {
    setRecoveryStatus('none');
    setIsPasswordReset(false);
    // Navigera till ren auth-sida utan query/hash
    navigate('/auth', { replace: true });
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('🔄 Starting handlePasswordReset');
    
    if (newPassword !== confirmPassword) {
      toast({
        title: "Lösenorden matchar inte",
        description: "Kontrollera att båda lösenorden är identiska",
        variant: "destructive"
      });
      return;
    }
    
    if (newPassword.length < 7) {
      toast({
        title: "Lösenordet är för kort",
        description: "Lösenordet måste vara minst 7 tecken",
        variant: "destructive"
      });
      return;
    }

    try {
      console.log('🔍 Attempting to update password...');
      
      // Säkerställ session (om tokens finns i URL)
      const { data: sessionData } = await supabase.auth.getSession();
      let hasSession = !!sessionData.session;
      console.log('📊 Has active session:', hasSession);

      if (!hasSession) {
        console.log('🗂️ No active session, attempting to establish session from URL tokens...');
        
        const accessTokenQP = searchParams.get('access_token');
        const refreshTokenQP = searchParams.get('refresh_token');
        const tokenParamQP = searchParams.get('token');
        const tokenHashParamQP = searchParams.get('token_hash');
        
        const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '';
        const hashParams = new URLSearchParams(hash);
        const accessTokenHash = hashParams.get('access_token');
        const refreshTokenHash = hashParams.get('refresh_token');
        const tokenParamHash = hashParams.get('token');
        const tokenHashParamHash = hashParams.get('token_hash');
        
        const urlAccessToken = accessTokenHash || accessTokenQP;
        const urlRefreshToken = refreshTokenHash || refreshTokenQP;
        const urlTokenParam = tokenParamHash || tokenParamQP;
        const urlTokenHashParam = tokenHashParamHash || tokenHashParamQP;
        
        if (urlAccessToken && urlRefreshToken) {
          console.log('✅ Using access/refresh tokens from URL');
          const { error } = await supabase.auth.setSession({
            access_token: urlAccessToken,
            refresh_token: urlRefreshToken,
          });
          if (error) throw error;
          hasSession = true;
        } else if (urlTokenHashParam || urlTokenParam) {
          console.log('✅ Using token/token_hash from URL');
          // VIKTIGT: Använd ANTINGEN token_hash ELLER token, aldrig båda samtidigt
          const verifyOptions: any = { type: 'recovery' };
          if (urlTokenHashParam) {
            verifyOptions.token_hash = urlTokenHashParam;
          } else if (urlTokenParam) {
            verifyOptions.token = urlTokenParam;
          }
          
          const { error } = await supabase.auth.verifyOtp(verifyOptions);
          if (error) throw error;
          hasSession = true;
        } else {
          console.log('⚠️ No tokens found - cannot establish session');
          setRecoveryStatus('consumed');
          return;
        }
      }

      const result = await updatePassword(newPassword);
      if (result.error) throw result.error;

      // Städa URL:en efter lyckad lösenordsändring
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('token');
      newUrl.searchParams.delete('token_hash');
      newUrl.searchParams.delete('access_token');
      newUrl.searchParams.delete('refresh_token');
      newUrl.searchParams.delete('type');
      newUrl.searchParams.delete('reset');
      newUrl.searchParams.delete('issued');
      newUrl.hash = '';
      window.history.replaceState({}, '', newUrl.toString());
      
      toast({
        title: "Lösenord uppdaterat",
        description: "Ditt lösenord har ändrats. Du omdirigeras nu...",
      });
      
      // Låt auth state change hantera navigationen naturligt istället för manuell navigate
      // Detta förhindrar "blinkandet" från multiple redirects
      setTimeout(() => {
        window.location.href = '/';
      }, 1500);
    } catch (err: any) {
      console.error('Återställning misslyckades:', err);
      const msg = (err?.message || '').toLowerCase();
      
      // Kolla om det är specifika lösenordsfel som användaren kan fixa
      if (msg.includes('different from') || msg.includes('same as') || msg.includes('should be different')) {
        toast({
          title: "Samma lösenord",
          description: "Det nya lösenordet måste vara annorlunda än ditt nuvarande lösenord",
          variant: "destructive"
        });
        return; // Stanna kvar på formuläret så användaren kan försöka igen
      }
      
      // För fel som kommer när länken redan är använd (one-time-use)
      // Detta händer när någon klickar länken ANDRA gången efter att ha använt den
      if (msg.includes('expired') || msg.includes('invalid') || msg.includes('session')) {
        console.log('❌ Token already used or expired');
        setRecoveryStatus('consumed');
      } else {
        // Andra fel - visa generiskt felmeddelande men stanna på formuläret
        toast({
          title: "Fel vid lösenordsuppdatering",
          description: err?.message || 'Okänt fel. Försök igen.',
          variant: "destructive"
        });
      }
    }
  };

  // Visa UI för utgången/ogiltig återställningslänk
  if (recoveryStatus !== 'none') {
    const isConsumed = recoveryStatus === 'consumed';
    const isUsed = recoveryStatus === 'used';
    const isExpired = recoveryStatus === 'expired';
    
    let title, description;
    if (isUsed) {
      title = 'Återställningslänken är redan använd';
      description = 'Av säkerhetsskäl kan denna länk endast användas en gång för att återställa ditt lösenord.\nOm du redan har återgått till inloggningssidan eller försöker använda länken igen behöver du begära en ny återställningslänk.';
    } else if (isConsumed) {
      title = 'Återställningslänken är förbrukad';
      description = 'Återställningslänkar kan bara användas en gång av säkerhetsskäl. Begär en ny länk för att ändra ditt lösenord.';
    } else {
      title = 'Återställningslänken har gått ut';
      description = 'Skriv din e‑postadress så skickar vi en ny länk för att återställa ditt lösenord.';
    }
    
    return (
      <div className="min-h-dvh bg-gradient-parium flex items-center justify-center p-4 smooth-scroll touch-pan" style={{ WebkitOverflowScrolling: 'touch' }}>
        <Card className="w-full max-w-md bg-glass backdrop-blur-md border-white/20">
          <CardContent className="p-8 text-center space-y-4">
            <AlertCircle className="h-16 w-16 text-red-500 mx-auto" />
            <h2 className="text-2xl font-bold text-primary-foreground">{title}</h2>
            <p className="text-white">{description}</p>
            <form onSubmit={handleResendReset} className="space-y-3">
              <Input
                type="email"
                placeholder="din@epost.se"
                value={emailForReset}
                onChange={(e) => setEmailForReset(e.target.value)}
                required
                disabled={resending}
                className="bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10 hover:border-white/50 placeholder:text-white"
              />
              <Button type="submit" variant="glass" className="w-full" disabled={resending}>
                {resending ? 'Skickar...' : 'Skicka ny länk'}
              </Button>
            </form>
            {resendMessage && (
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 hover:border-white/50 rounded-lg p-4">
                <p className="text-sm text-white whitespace-pre-line">{resendMessage}</p>
              </div>
            )}
            <Button onClick={handleBackToLogin} variant="glass" className="w-full">
              Tillbaka till inloggning
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // AnimatedIntro removed - index.html splash handles this now

  // Visa bekräftelsestatus om det finns en
  if (confirmationStatus !== 'none') {
    return (
      <div className="min-h-dvh bg-gradient-parium flex items-center justify-center p-4 smooth-scroll touch-pan" style={{ WebkitOverflowScrolling: 'touch' }}>
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
                  variant="glass"
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
                  variant="glass"
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
                  variant="glass"
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

  // 🎯 AuthSplashScreen hanterar nu laddningsupplevelsen vid inloggning
  // Returnera bara en tom bakgrund medan splashen täcker allt
  if (user && loading && authAction !== 'logout') {
    return <div className="min-h-screen bg-gradient-parium" />;
  }

  // 🔁 Direkt redirect efter lyckad inloggning utan extra frame
  if (user && profile && !loading && confirmationStatus === 'none' && recoveryStatus === 'none' && !isPasswordReset) {
    const role = (profile as any)?.role;
    if (role) {
      // Alla roller landar på /home efter inloggning
      return <Navigate to="/home" replace />;
    }
  }

  // Använd rätt komponent baserat på skärmstorlek
  if (device === 'mobile') {
    return (
      <div className="min-h-screen w-full overflow-x-hidden relative">
        {/* Bottom safe-area blend to eliminate iOS seam */}
        <div
          className="fixed inset-x-0 bottom-0 pointer-events-none z-40"
          style={{
            height: 'env(safe-area-inset-bottom, 0px)',
            background: 'transparent'
          }}
        />
        <AuthMobile
          isPasswordReset={isPasswordReset}
          newPassword={newPassword}
          setNewPassword={setNewPassword}
          confirmPassword={confirmPassword}
          setConfirmPassword={setConfirmPassword}
          handlePasswordReset={handlePasswordReset}
          onBackToLogin={handleBackToLogin}
          onAuthModeChange={setIsLoginMode}
          initialMode={initialMode}
          initialRole={initialRole}
        />
      </div>
    );
  }

  // Desktop layout (includes former tablet layout)

  return (
    <div className="min-h-screen w-full overflow-x-hidden relative">
      <AuthDesktop
        isPasswordReset={isPasswordReset}
        newPassword={newPassword}
        setNewPassword={setNewPassword}
        confirmPassword={confirmPassword}
        setConfirmPassword={setConfirmPassword}
        handlePasswordReset={handlePasswordReset}
        onBackToLogin={handleBackToLogin}
        onAuthModeChange={setIsLoginMode}
        initialMode={initialMode}
        initialRole={initialRole}
      />
    </div>
  );
};

export default Auth;