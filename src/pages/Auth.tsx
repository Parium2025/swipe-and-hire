import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useDevice } from '@/hooks/use-device';
import { useToast } from '@/hooks/use-toast';
// AnimatedIntro removed - using index.html splash instead
import AuthMobile from '@/components/AuthMobile';
import AuthDesktop from '@/components/AuthDesktop';
import { AnimatedBackground } from '@/components/AnimatedBackground';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { consumePendingJobPath } from '@/lib/pendingJobIntent';
import { applyIntentToSearchFilters, type SavedSearchIntent } from '@/lib/savedSearchIntent';
import { sanitizeAuthNext, sanitizeAuthReturnTo } from '@/lib/authLinkRouting';
import {
  consumeAuthBootstrapCredentials,
  type AuthBootstrapCredential,
  type SupportedAuthOtpType,
} from '@/lib/authBootstrapCredentials';

// Delad bakgrund för hela /auth (inklusive status- och felsidor)
const AUTH_BACKDROP_STYLE = {
  backgroundColor: 'hsl(215 100% 12%)',
  backgroundImage:
    'radial-gradient(1200px 700px at 12% -10%, hsl(215 85% 28% / 0.55), transparent 60%), radial-gradient(900px 600px at 100% 110%, hsl(215 85% 22% / 0.45), transparent 65%), linear-gradient(135deg, hsl(215 100% 12%) 0%, hsl(215 85% 22%) 50%, hsl(215 100% 12%) 100%)',
};

type AuthNavigationState = {
  mode?: string;
  role?: string;
  plan?: unknown;
  savedSearchIntent?: SavedSearchIntent;
  returnTo?: unknown;
};

const Auth = () => {
  // Clear skip-splash flag on mount (used when navigating from landing)
  useEffect(() => {
    sessionStorage.removeItem('parium-skip-splash');
  }, []);

  // AnimatedIntro removed - index.html splash handles the loading screen now
  const [capturedAuthLink] = useState<AuthBootstrapCredential | null>(
    consumeAuthBootstrapCredentials,
  );
  const [authLinkHandled, setAuthLinkHandled] = useState(() => !capturedAuthLink);
  const [isPasswordReset, setIsPasswordReset] = useState(
    () => capturedAuthLink?.type === 'recovery' || capturedAuthLink?.reset === true,
  );
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [confirmationStatus, setConfirmationStatus] = useState<'none' | 'pending' | 'success' | 'already-confirmed' | 'error'>('none');
  const [confirmationMessage, setConfirmationMessage] = useState('');
  const [authLinkBusy, setAuthLinkBusy] = useState(false);
  const [recoveryStatus, setRecoveryStatus] = useState<'none' | 'expired' | 'consumed' | 'invalid' | 'used'>('none');
  const [emailForReset, setEmailForReset] = useState('');
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const [resendAnnouncement, setResendAnnouncement] = useState<'none' | 'success' | 'error'>('none');
  const [isLoginMode, setIsLoginMode] = useState(true); // Track if user is on login or register

  const {
    user,
    profile,
    loading,
    authAction,
    updatePassword,
    confirmEmail,
    runAuthLinkSessionTransition,
  } = useAuth();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const device = useDevice();
  const { toast } = useToast();
  const pkceVerificationStartedRef = useRef(false);
  const confirmationStartedRef = useRef(false);
  const recoveryGrantRef = useRef<{
    userId: string;
    sessionToken: string;
    verifiedAt: number;
  } | null>(null);

  // Read initial state from navigation (from Landing page)
  const navigationState = location.state && typeof location.state === 'object'
    ? location.state as AuthNavigationState
    : null;
  const initialMode = navigationState?.mode;
  const initialRole = navigationState?.role;
  const initialPlan = navigationState?.plan;
  const initialSavedSearchIntent = navigationState?.savedSearchIntent;
  const initialReturnTo = navigationState?.returnTo;

  // Persistera "Bevaka denna sökning"-intent från SEO-sidor så den överlever
  // signup/login/email-confirm-roundtrips.
  useEffect(() => {
    if (initialSavedSearchIntent) {
      import('@/lib/savedSearchIntent').then(({ persistIntent }) =>
        persistIntent(initialSavedSearchIntent)
      );
    }
  }, [initialSavedSearchIntent]);

  // Persist pending plan across signup/login/OAuth roundtrips so we can
  // redirect to /checkout once a session is established.
  useEffect(() => {
    if (initialPlan && typeof window !== 'undefined') {
      try { sessionStorage.setItem('parium-pending-plan', String(initialPlan)); } catch { /* storage unavailable */ }
      // Markera att checkout nås via signup-flöde (back ska gå till /home, inte /subscription)
      try { sessionStorage.setItem('parium-checkout-origin', 'signup'); } catch { /* storage unavailable */ }
    }
  }, [initialPlan]);

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
      if (!capturedAuthLink) return;
      const recoveryRequested = capturedAuthLink.reset || capturedAuthLink.type === 'recovery';

      if (recoveryRequested) {
        if (capturedAuthLink.expired) {
          setRecoveryStatus('expired');
          return;
        }
        if (capturedAuthLink.used) {
          setRecoveryStatus('used');
          return;
        }
        if (capturedAuthLink.tokenUsed) {
          setRecoveryStatus('consumed');
          return;
        }
      }

      if (capturedAuthLink.errorCode || capturedAuthLink.errorDescription) {
        const desc = (capturedAuthLink.errorCode || capturedAuthLink.errorDescription || '').toLowerCase();
        if (recoveryRequested) {
          if (desc.includes('expire')) setRecoveryStatus('expired');
          else if (desc.includes('used') || desc.includes('consumed') || desc.includes('already')) {
            setRecoveryStatus('used');
          } else {
            setRecoveryStatus('invalid');
          }
        } else {
          setConfirmationStatus('error');
          setConfirmationMessage('Denna autentiseringslänk är inte längre giltig. Begär en ny länk och försök igen.');
        }
        return;
      }

      if (capturedAuthLink.family === 'invalid') {
        if (recoveryRequested) setRecoveryStatus('invalid');
        else {
          setConfirmationStatus('error');
          setConfirmationMessage('Denna autentiseringslänk är ogiltig. Begär en ny länk och försök igen.');
        }
        return;
      }

      if (recoveryRequested) {
        setIsPasswordReset(true);
        if (
          capturedAuthLink.family === 'otp' ||
          capturedAuthLink.family === 'bearer' ||
          capturedAuthLink.family === 'pkce'
        ) {
          setRecoveryStatus('none');
          return;
        }
        // A generic existing session is never a password-recovery grant.
        setRecoveryStatus('used');
        return;
      }

      setIsPasswordReset(false);
      if (capturedAuthLink.family === 'otp' || capturedAuthLink.family === 'bearer') {
        setConfirmationStatus('pending');
        setConfirmationMessage(
          'Länken kan logga in eller byta konto. Fortsätt endast om du själv begärde länken.',
        );
        return;
      }

      if (capturedAuthLink.family === 'pkce') {
        if (pkceVerificationStartedRef.current) return;
        pkceVerificationStartedRef.current = true;
        setConfirmationStatus('pending');
        setConfirmationMessage('Slutför säker inloggning…');
        setAuthLinkBusy(true);
        try {
          // exchangeCodeForSession succeeds only when this tab owns the matching
          // PKCE verifier. A shared code therefore cannot replace a session.
          const { data, error } = await runAuthLinkSessionTransition(() =>
            supabase.auth.exchangeCodeForSession(capturedAuthLink.code)
          );
          if (error || !data.session?.user?.id) throw error || new Error('Missing PKCE session');
          setAuthLinkHandled(true);
          setConfirmationStatus('none');
        } catch {
          setConfirmationStatus('error');
          setConfirmationMessage('Denna autentiseringslänk är inte längre giltig. Begär en ny länk och försök igen.');
        } finally {
          setAuthLinkBusy(false);
        }
        return;
      }

      if (capturedAuthLink.family === 'public_state') {
        setConfirmationStatus('error');
        setConfirmationMessage('Denna autentiseringslänk saknar giltiga uppgifter. Begär en ny länk och försök igen.');
      }
    };

    void handleAuthFlow();
  }, [capturedAuthLink, runAuthLinkSessionTransition]);

  const handleExplicitAuthLink = async () => {
    if (!capturedAuthLink ||
        (capturedAuthLink.family !== 'otp' && capturedAuthLink.family !== 'bearer')) {
      return;
    }
    setAuthLinkBusy(true);
    try {
      if (capturedAuthLink.family === 'bearer') {
        const { data, error } = await runAuthLinkSessionTransition(() =>
          supabase.auth.setSession({
            access_token: capturedAuthLink.accessToken,
            refresh_token: capturedAuthLink.refreshToken,
          })
        );
        if (error || !data.session?.user?.id) throw error || new Error('Missing session');
      } else {
        const { data, error } = await runAuthLinkSessionTransition(() =>
          supabase.auth.verifyOtp({
            token_hash: capturedAuthLink.tokenHash,
            type: capturedAuthLink.type as SupportedAuthOtpType,
          })
        );
        if (error || !data.session?.user?.id) throw error || new Error('Missing session');
      }
      setAuthLinkHandled(true);
      setConfirmationStatus('none');
    } catch {
      setConfirmationStatus('error');
      setConfirmationMessage('Denna autentiseringslänk är inte längre giltig. Begär en ny länk och försök igen.');
    } finally {
      setAuthLinkBusy(false);
    }
  };

  useEffect(() => {
    if (capturedAuthLink?.family !== 'custom_confirm' || confirmationStartedRef.current) return;
    confirmationStartedRef.current = true;

    const handleEmailConfirmation = async () => {
      try {
        const result = await confirmEmail(capturedAuthLink.confirmToken);
        if (result.processed !== true) throw new Error('Confirmation not processed');
        setConfirmationStatus('success');
        setConfirmationMessage(result.message);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error
          ? error.message
          : 'Ett fel inträffade vid bekräftelse av e-post';
        const normalizedError = errorMessage.toLowerCase();

        if (normalizedError.includes('redan bekräftad') || normalizedError.includes('already')) {
          setConfirmationStatus('already-confirmed');
          setConfirmationMessage('Ditt konto är redan aktiverat. Du kan logga in direkt.');
        } else if (normalizedError.includes('utgången') || normalizedError.includes('expired')) {
          setConfirmationStatus('error');
          setConfirmationMessage('Bekräftelselänken har gått ut. Du kan registrera dig igen med samma e-postadress.');
        } else {
          setConfirmationStatus('error');
          setConfirmationMessage('Denna bekräftelselänk är inte längre giltig. Kontakta support om problemet kvarstår.');
        }
      }
    };

    void handleEmailConfirmation();
  }, [capturedAuthLink, confirmEmail]);

  const handleResendReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResendMessage('');
    setResendAnnouncement('none');
    setResending(true);
    try {
      if (!emailForReset) return;
      const { error } = await supabase.functions.invoke('send-reset-password', {
        body: { email: emailForReset }
      });
      if (error) throw error;
      setResendMessage('Ny återställningslänk skickad! Kolla din e‑post.\nHittar du oss inte? Kolla skräpposten – vi kanske gömmer oss där.');
      setResendAnnouncement('success');
    } catch {
      setResendMessage('Kunde inte skicka länk. Kontrollera e‑postadressen och försök igen.');
      setResendAnnouncement('error');
    } finally {
      setResending(false);
    }
  };

  const dismissCapturedAuthLink = () => {
    setAuthLinkHandled(true);
    setConfirmationStatus('none');
    setRecoveryStatus('none');
    setIsPasswordReset(false);
    // Navigera till ren auth-sida utan query/hash. The in-memory credential is
    // never restored, but the normal post-login redirect may resume.
    navigate('/auth', { replace: true });
  };

  const handleBackToLogin = dismissCapturedAuthLink;

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast({
        title: "Lösenorden matchar inte",
        description: "Kontrollera att båda lösenorden är identiska.",
        variant: "destructive"
      });
      return;
    }
    
    if (newPassword.length < 8 || newPassword.length > 128) {
      toast({
        title: "Ogiltig lösenordslängd",
        description: "Lösenordet måste vara mellan 8 och 128 tecken.",
        variant: "destructive"
      });
      return;
    }

    try {
      const recoveryCredential = capturedAuthLink;
      const isRecoveryCredential = Boolean(
        recoveryCredential &&
        (recoveryCredential.type === 'recovery' || recoveryCredential.reset),
      );
      if (!recoveryCredential || !isRecoveryCredential || !(
        recoveryCredential.family === 'otp' ||
        recoveryCredential.family === 'bearer' ||
        recoveryCredential.family === 'pkce'
      )) {
        throw new Error('Invalid recovery credential');
      }

      let grant = recoveryGrantRef.current;
      if (grant && Date.now() - grant.verifiedAt > 10 * 60 * 1000) {
        recoveryGrantRef.current = null;
        grant = null;
      }

      if (!grant) {
        let verifiedUserId: string | undefined;
        let verifiedSessionToken: string | undefined;
        if (recoveryCredential.family === 'bearer') {
          const { data, error } = await runAuthLinkSessionTransition(() =>
            supabase.auth.setSession({
              access_token: recoveryCredential.accessToken,
              refresh_token: recoveryCredential.refreshToken,
            })
          );
          if (error) throw error;
          verifiedUserId = data.session?.user?.id;
          verifiedSessionToken = data.session?.access_token;
        } else if (recoveryCredential.family === 'otp') {
          if (recoveryCredential.type !== 'recovery') throw new Error('Invalid recovery type');
          const { data, error } = await runAuthLinkSessionTransition(() =>
            supabase.auth.verifyOtp({
              token_hash: recoveryCredential.tokenHash,
              type: 'recovery',
            })
          );
          if (error) throw error;
          verifiedUserId = data.session?.user?.id;
          verifiedSessionToken = data.session?.access_token;
        } else {
          const { data, error } = await runAuthLinkSessionTransition(() =>
            supabase.auth.exchangeCodeForSession(recoveryCredential.code)
          );
          if (error) throw error;
          verifiedUserId = data.session?.user?.id;
          verifiedSessionToken = data.session?.access_token;
        }

        if (!verifiedUserId || !verifiedSessionToken) {
          throw new Error('Recovery session was not verified');
        }
        // Preserve only the proof returned by the successful verification so
        // a transient getSession failure can retry without consuming the
        // one-time recovery credential again.
        grant = {
          userId: verifiedUserId,
          sessionToken: verifiedSessionToken,
          verifiedAt: Date.now(),
        };
        recoveryGrantRef.current = grant;
      }

      // Bind every retry to the exact session established by this page's
      // recovery credential. A concurrent account switch invalidates the grant.
      const { data: currentSessionData, error: currentSessionError } = await supabase.auth.getSession();
      if (currentSessionError) throw currentSessionError;
      const currentSession = currentSessionData.session;
      if (!currentSession || currentSession.user.id !== grant.userId ||
          currentSession.access_token !== grant.sessionToken) {
        recoveryGrantRef.current = null;
        throw new Error('Recovery session changed');
      }

      const result = await updatePassword(newPassword);
      if (result.error) throw result.error;
      recoveryGrantRef.current = null;

      // The pre-bootstrap gate already removed all recovery state from the
      // address bar before this module loaded; no credential is restored here.
      
      toast({
        title: "Lösenord uppdaterat",
        description: "Ditt lösenord har ändrats. Du omdirigeras nu...",
      });
      
      // Låt auth state change hantera navigationen naturligt istället för manuell navigate
      // Detta förhindrar "blinkandet" från multiple redirects
      setTimeout(() => {
        window.location.href = '/';
      }, 1500);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '';
      const msg = errorMessage.toLowerCase();
      
      // Kolla om det är specifika lösenordsfel som användaren kan fixa
      if (msg.includes('different from') || msg.includes('same as') || msg.includes('should be different')) {
        toast({
          title: "Samma lösenord",
          description: "Det nya lösenordet måste vara annorlunda än ditt nuvarande lösenord.",
          variant: "destructive"
        });
        return; // Stanna kvar på formuläret så användaren kan försöka igen
      }
      
      // För fel som kommer när länken redan är använd (one-time-use)
      // Detta händer när någon klickar länken ANDRA gången efter att ha använt den
      if (msg.includes('expired') || msg.includes('invalid') || msg.includes('session')) {
        setRecoveryStatus('consumed');
      } else {
        // Andra fel - visa generiskt felmeddelande men stanna på formuläret
        toast({
          title: "Fel vid lösenordsuppdatering",
          description: errorMessage || 'Okänt fel. Försök igen.',
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
      <div
        className="relative min-h-dvh flex items-center justify-center p-4 smooth-scroll touch-pan overflow-hidden"
        style={{ WebkitOverflowScrolling: 'touch', ...AUTH_BACKDROP_STYLE }}
      >
        {/* Dekorativa bubblor — samma bakgrund som inloggningssidan */}
        <div className="fixed inset-0 z-[5] pointer-events-none">
          <AnimatedBackground showGlow={false} variant="viewport" />
        </div>
        <Card className="relative z-10 w-full max-w-md bg-glass backdrop-blur-md border-white/20">
          <CardContent className="p-8 text-center space-y-4">
            <AlertCircle className="h-16 w-16 text-red-500 mx-auto" />
            <h2 className="text-2xl font-bold text-primary-foreground">{title}</h2>
            <p className="text-white">{description}</p>
            <form onSubmit={handleResendReset} className="space-y-3">
              <label htmlFor="recovery-reset-email" className="sr-only">
                E-postadress
              </label>
              <Input
                id="recovery-reset-email"
                name="email"
                type="email"
                autoComplete="email"
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
              <div
                role={resendAnnouncement === 'error' ? 'alert' : 'status'}
                aria-live={resendAnnouncement === 'error' ? 'assertive' : 'polite'}
                aria-atomic="true"
                className="bg-white/5 backdrop-blur-sm border border-white/10 hover:border-white/50 rounded-lg p-4"
              >
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
      <div
        className="relative min-h-dvh flex items-center justify-center p-4 smooth-scroll touch-pan overflow-hidden"
        style={{ WebkitOverflowScrolling: 'touch', ...AUTH_BACKDROP_STYLE }}
      >
        <div className="fixed inset-0 z-[5] pointer-events-none">
          <AnimatedBackground showGlow={false} variant="viewport" />
        </div>
        <Card className="relative z-10 w-full max-w-md bg-glass backdrop-blur-md border-white/20">
          <CardContent className="p-8 text-center">
            {confirmationStatus === 'pending' && (
              <>
                {authLinkBusy ? (
                  <Loader2 className="h-16 w-16 animate-spin text-secondary mx-auto mb-4" />
                ) : (
                  <AlertCircle className="h-16 w-16 text-secondary mx-auto mb-4" />
                )}
                <h2 className="text-2xl font-bold text-primary-foreground mb-4">
                  Säker inloggningslänk
                </h2>
                <p className="text-primary-foreground/80 mb-6">
                  {confirmationMessage}
                </p>
                <Button
                  type="button"
                  onClick={() => void handleExplicitAuthLink()}
                  variant="glass"
                  className="w-full"
                  disabled={authLinkBusy || capturedAuthLink?.family === 'pkce'}
                >
                  {authLinkBusy ? 'Kontrollerar…' : 'Fortsätt säkert'}
                </Button>
              </>
            )}
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
                  onClick={dismissCapturedAuthLink}
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
                  onClick={dismissCapturedAuthLink}
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
                  onClick={dismissCapturedAuthLink}
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
  if (user && profile && !loading && authLinkHandled && confirmationStatus === 'none' && recoveryStatus === 'none' && !isPasswordReset) {
    const role = profile?.role;
    if (role) {
      // Samtyckesflödet för agentanslutningar (MCP) skickar hit med ?next=
      // Endast den exakta lokala consent-routen tillåts.
      const nextParam = searchParams.get('next');
      const safeNext = sanitizeAuthNext(nextParam);
      if (safeNext) {
        return <Navigate to={safeNext} replace />;
      }
      // Om användaren kom hit via en prisknapp ("Bli Premium") — skicka vidare till checkout
      const pendingPlan = typeof window !== 'undefined' ? sessionStorage.getItem('parium-pending-plan') : null;
      if (pendingPlan) {
        return <Navigate to="/checkout" replace />;
      }
      // Bevara den uttryckliga destinationen från publika kontosidor, till
      // exempel aviseringarna från en mejllänk. Sessionslagringen gör att målet
      // även överlever en hård omladdning på auth-sidan.
      try {
        const storedReturnTo = typeof window !== 'undefined'
          ? sessionStorage.getItem('parium-auth-return-to')
          : null;
        const requestedReturnTo = typeof initialReturnTo === 'string' ? initialReturnTo : storedReturnTo;
        const allowedReturnTo = sanitizeAuthReturnTo(requestedReturnTo);
        if (allowedReturnTo) {
          sessionStorage.removeItem('parium-auth-return-to');
          const isNotificationDestination =
            allowedReturnTo === '/profile#notifications' ||
            allowedReturnTo === '/settings#notifications';
          const destination = isNotificationDestination
            ? (role === 'employer' ? '/settings#notifications' : '/profile#notifications')
            : allowedReturnTo;
          return <Navigate to={destination} replace />;
        }
      } catch { /* fortsätt till standarddestination */ }
      // Om användaren kom hit via "Bevaka denna sökning" på en SEO-sida:
      // skapa saved_search + slussa till returnTo. Fire-and-forget för att
      // inte blockera renderingen – Navigate sker direkt till returnTo.
      // VIKTIGT: hoppa över returnTo om jobbsökaren ännu inte har gjort klart
      // välkomsttunneln — då skickas användaren till /home, tunneln triggas,
      // och Index.tsx konsumerar intent i onComplete (rätt tunneltråd).
      try {
        const raw = typeof window !== 'undefined' ? sessionStorage.getItem('parium-saved-search-intent') : null;
        if (raw) {
          const parsed = JSON.parse(raw);
          const returnTo = parsed?.returnTo;
          const onboardingDone = profile?.onboarding_completed === true;
          const isJobSeeker = role === 'job_seeker';
          if (!isJobSeeker || onboardingDone) {
            // Applicera filter SYNKRONT så /search-jobs har dem redan vid mount.
            applyIntentToSearchFilters(parsed);
            import('@/lib/savedSearchIntent').then(({ consumeIntent }) => {
              consumeIntent(user.id).catch(() => {});
            });
            const safeReturnTo = sanitizeAuthReturnTo(returnTo);
            if (safeReturnTo) {
              return <Navigate to={safeReturnTo} replace />;
            }
          }
          // Annars: lämna intent kvar — WelcomeTunnel.onComplete i Index.tsx
          // konsumerar den och slussar dit efter att tunneln är klar.
        }
      } catch { /* fortsätt */ }


      // Om användaren kom hit från en jobbannons (utloggad → klickade "Ansök"):
      // Slussa direkt vidare till ansökan — MEN ENDAST om välkomsttunneln
      // redan är klar. Är den inte klar låter vi tunneln konsumera intent
      // i sin onComplete (se Index.tsx) så hela onboardingen körs först.
      try {
        const onboardingDone = profile?.onboarding_completed === true;
        if (role === 'job_seeker' && onboardingDone) {
          const path = consumePendingJobPath();
          if (path) return <Navigate to={path} replace />;
        }
      } catch { /* fortsätt */ }


      // Alla roller landar på /home efter inloggning
      return <Navigate to="/home" replace />;
    }
  }


  // Använd rätt komponent baserat på skärmstorlek
  const authBackdropStyle = AUTH_BACKDROP_STYLE;


  const AuthBackdrop = () => (
    <div
      aria-hidden
      className="fixed inset-x-0 top-0 z-0 h-[calc(100dvh+var(--chrome-strip-pad,0px))] overflow-hidden pointer-events-none"
      style={authBackdropStyle}
    />
  );


  if (device === 'mobile') {
    return (
      <div className="relative h-dvh min-h-dvh w-full max-w-full overflow-hidden" style={authBackdropStyle}>
        <AuthBackdrop />
        {/* Dekorativa bubblor — fixed mot viewport, följer ALDRIG med scroll */}
        <div className="fixed inset-0 z-[5] pointer-events-none">
          <AnimatedBackground showGlow={false} variant="viewport" />
        </div>

        {/* Bottom safe-area blend to eliminate iOS seam */}
        <div
          className="fixed inset-x-0 bottom-0 pointer-events-none z-40"
          style={{
            height: 'env(safe-area-inset-bottom, 0px)',
            background: 'transparent'
          }}
        />

        {/* Internal scroll container (same pattern as Employer/JobSeeker layouts) */}
        <div
          className="relative z-10 h-full min-h-0 w-full max-w-full overflow-y-auto overflow-x-hidden"
          style={{ 
            WebkitOverflowScrolling: 'touch',
            scrollBehavior: 'smooth',
            willChange: 'scroll-position',
            transform: 'translateZ(0)',
          }}
        >
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
      </div>
    );
  }

  // Desktop layout (includes former tablet layout)

  return (
    <div className="relative h-screen w-full overflow-hidden" style={authBackdropStyle}>
      <AuthBackdrop />
      {/* Dekorativa bubblor — fixed mot viewport, följer ALDRIG med scroll */}
      <div className="fixed inset-0 z-[5] pointer-events-none">
        <AnimatedBackground showGlow={false} variant="viewport" />
      </div>

      {/* Internal scroll container (same pattern as Employer/JobSeeker layouts) */}
      <div
        className="h-full w-full min-h-0 overflow-y-auto overflow-x-hidden relative z-10"
        style={{ 
          WebkitOverflowScrolling: 'touch',
          scrollBehavior: 'smooth',
          willChange: 'scroll-position',
          transform: 'translateZ(0)',
        }}
      >
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
    </div>
  );
};

export default Auth;
