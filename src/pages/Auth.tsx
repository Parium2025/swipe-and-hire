import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useDevice } from '@/hooks/use-device';
import { useToast } from '@/hooks/use-toast';
import AnimatedIntro from '@/components/AnimatedIntro';
import AuthMobile from '@/components/AuthMobile';
import AuthTablet from '@/components/AuthTablet';
import AuthDesktop from '@/components/AuthDesktop';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

const Auth = () => {
  const [showIntro, setShowIntro] = useState(() => {
    try {
      const loc = typeof window !== 'undefined' ? window.location : null;
      if (loc) {
        const sp = new URLSearchParams(loc.search);
        const hashStr = loc.hash && loc.hash.startsWith('#') ? loc.hash.slice(1) : '';
        const hp = new URLSearchParams(hashStr);
        const type = hp.get('type') || sp.get('type');
        const hasAnyRecovery =
          type === 'recovery' ||
          !!(hp.get('token') || sp.get('token') || hp.get('token_hash') || sp.get('token_hash') || hp.get('access_token') || sp.get('access_token')) ||
          !!(sp.get('reset') === 'true' && sp.get('issued')); // Lägg till stöd för issued parameter
        if (hasAnyRecovery) return false;
      }
    } catch {}
    return !sessionStorage.getItem('parium-intro-seen');
  });
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
  const [pullProgress, setPullProgress] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoginMode, setIsLoginMode] = useState(true); // Track if user is on login or register

  const { user, profile, updatePassword, confirmEmail } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const device = useDevice();
  const { toast } = useToast();

  // Smart scroll-locking: Lock only for login on MOBILE devices, allow scroll on desktop
  useEffect(() => {
    // Only apply scroll-lock on mobile/tablet, not desktop
    if (device === 'desktop') {
      return; // Skip scroll-lock entirely on desktop
    }

    try {
      const html = document.documentElement;
      const body = document.body;
      
      if (isLoginMode) {
        // Login mode: enable pull-to-refresh and block scroll via listeners (no global CSS class)
        
        let startY = 0;
        let triggered = false;
        let lastReload = 0;
        let isInputFocused = false;

        const onFocusIn = (e: FocusEvent) => {
          if (e.target && (e.target as HTMLElement).tagName === 'INPUT') {
            isInputFocused = true;
          }
        };

        const onFocusOut = (e: FocusEvent) => {
          if (e.target && (e.target as HTMLElement).tagName === 'INPUT') {
            isInputFocused = false;
          }
        };

        const onTouchStart = (e: TouchEvent) => {
          startY = e.touches?.[0]?.clientY ?? 0;
          triggered = false;
          setPullProgress(0);
        };

        const onTouchMove = (e: TouchEvent) => {
          // Allow scroll when input is focused (keyboard is open)
          if (isInputFocused) return;
          
          const y = e.touches?.[0]?.clientY ?? 0;
          const dy = y - startY;
          
          // Calculate progress (0-1) based on drag distance
          const maxDrag = 100;
          const progress = Math.min(Math.max(dy / maxDrag, 0), 1);
          setPullProgress(progress);
          
          // Block all vertical scroll when no input focused
          e.preventDefault();
          
          // Pull-to-refresh
          if (dy > 70 && !triggered) {
            triggered = true;
            const now = Date.now();
            if (now - lastReload > 1500) {
              lastReload = now;
              setIsRefreshing(true);
              setTimeout(() => {
                window.location.reload();
              }, 300);
            }
          }
        };

        const onTouchEnd = () => {
          if (!isRefreshing) {
            setPullProgress(0);
          }
        };

        const onWheel = (e: WheelEvent) => {
          if (!isInputFocused) {
            e.preventDefault();
          }
        };

        const onScroll = () => {
          if (!isInputFocused && window.scrollY !== 0) {
            window.scrollTo(0, 0);
          }
        };

        document.addEventListener('focusin', onFocusIn);
        document.addEventListener('focusout', onFocusOut);
        window.addEventListener('touchstart', onTouchStart, { passive: true });
        window.addEventListener('touchmove', onTouchMove, { passive: false });
        window.addEventListener('touchend', onTouchEnd, { passive: true });
        window.addEventListener('wheel', onWheel, { passive: false });
        window.addEventListener('scroll', onScroll, { passive: true });

        return () => {
          document.removeEventListener('focusin', onFocusIn);
          document.removeEventListener('focusout', onFocusOut);
          window.removeEventListener('touchstart', onTouchStart as any);
          window.removeEventListener('touchmove', onTouchMove as any);
          window.removeEventListener('touchend', onTouchEnd as any);
          window.removeEventListener('wheel', onWheel as any);
          window.removeEventListener('scroll', onScroll as any);
        };
      } else {
        // Register mode: Allow scroll (no global class toggles)
      }
    } catch {}
  }, [isLoginMode, isRefreshing]);

  useEffect(() => {
    const handleAuthFlow = async () => {
      const isReset = searchParams.get('reset') === 'true';
      const confirmed = searchParams.get('confirmed');
      
      console.log('🔍 AUTH FLOW DEBUG:', {
        isReset,
        url: window.location.href,
        searchParams: Array.from(searchParams.entries()),
        hasToken: !!searchParams.get('token'),
        hasTokenHash: !!searchParams.get('token_hash'),
        hasIssued: !!searchParams.get('issued'),
        issuedValue: searchParams.get('issued')
      });
      
      // FÖRSTA KONTROLLEN: Är det en reset-länk?
      if (isReset) {
        console.log('✅ Reset-länk detekterad');
        setIsPasswordReset(true);
        
        // ANDRA KONTROLLEN: Kontrollera expired parameter från redirect-funktionen
        const isExpired = searchParams.get('expired') === 'true';
        const isUsed = searchParams.get('used') === 'true';
        const isTokenUsed = searchParams.get('token_used') === 'true';
        if (isExpired) {
          console.log('❌ EXPIRED parameter funnen - Visar expired direkt');
          setRecoveryStatus('expired');
          return;
        }
        if (isUsed) {
          console.log('❌ USED parameter funnen - Visar used direkt');
          setRecoveryStatus('used');
          return;
        }
        if (isTokenUsed) {
          console.log('❌ TOKEN_USED parameter funnen - Token redan använd');
          setRecoveryStatus('consumed');
          return;
        }

        // TREDJE KONTROLLEN: Kontrollera issued timestamp för nya länkar
        const issuedParam = searchParams.get('issued');
        if (issuedParam) {
          const issuedTime = parseInt(issuedParam);
          const currentTime = Date.now();
          const timeDiff = currentTime - issuedTime;
          const tenMinutesInMs = 10 * 60 * 1000; // 10 minuter
          
          console.log('🕐 TIME CHECK:', { 
            issuedTime, 
            currentTime, 
            timeDiff, 
            tenMinutesInMs,
            isExpired: timeDiff > tenMinutesInMs,
            minutesOld: Math.floor(timeDiff / 60000)
          });
          
          if (timeDiff > tenMinutesInMs) {
            console.log('❌ RESET LINK EXPIRED baserat på issued timestamp');
            setRecoveryStatus('expired');
            return;
          } else {
            console.log('✅ Reset-länk är giltig enligt timestamp - tillåter återställning');
            // Länken är giltig - fortsätt till formulär även utan tokens
            return; // Avsluta här och visa formuläret
          }
        }

        // FJÄRDE KONTROLLEN: Gamla länkar utan tokens OCH utan issued = expired  
        const hasTokens = searchParams.get('token') || 
                         searchParams.get('token_hash') || 
                         searchParams.get('access_token');
        
        if (!hasTokens && !issuedParam) {
          console.log('❌ GAMMAL RESET-LÄNK utan tokens och utan issued - Visar expired');
          setRecoveryStatus('expired');
          return;
        }
        
        console.log('✅ Reset-länk verkar vara ok - fortsätter till formulär');
      }
      
      // Hantera recovery tokens från Supabase auth (olika format) + URL-hash
      const accessTokenQP = searchParams.get('access_token');
      const refreshTokenQP = searchParams.get('refresh_token');
      const tokenTypeQP = searchParams.get('type');
      const tokenParamQP = searchParams.get('token');
      const tokenHashParamQP = searchParams.get('token_hash');
      const errorCodeQP = searchParams.get('error_code') || searchParams.get('error');
      const errorDescQP = searchParams.get('error_description') || searchParams.get('error_message');
      const issuedQP = searchParams.get('issued');

      const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '';
      const hashParams = new URLSearchParams(hash);
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
      
      console.log('🔍 DETALJERAD TOKEN-DEBUG:', {
        issuedQP,
        issuedHash,
        issued,
        issuedMs,
        currentTime: Date.now(),
        url: window.location.href
      });
      
      console.log('Auth useEffect - URL params:', { 
        isReset, 
        confirmed, 
        currentUrl: window.location.href,
        hasTokens: !!accessToken && !!refreshToken,
        hasSupabaseToken: !!(tokenParam || tokenHashParam),
        tokenType,
        issuedMs
      });

      // Fånga fel från Supabase verify endpoint och fall utan tokens
      const errorCode = errorCodeHash || errorCodeQP || undefined;
      const errorDescription = errorDescHash || errorDescQP || undefined;
      const hasError = !!(errorCode || errorDescription);
      const noAnyRecoveryTokens = !(accessToken || refreshToken || tokenParam || tokenHashParam);

      if (hasError || (tokenType === 'recovery' && noAnyRecoveryTokens)) {
        const desc = (errorCode || errorDescription || '').toLowerCase();
        console.log('🔍 AUTH ERROR DETECTED:', { errorCode, errorDescription, desc });
        
        // Kolla först tidsgräns
        if (issuedMs) {
          const currentTime = Date.now();
          const tenMinutesInMs = 10 * 60 * 1000;
          const timeElapsed = currentTime - issuedMs;
          
          if (timeElapsed > tenMinutesInMs) {
            console.log('❌ TUNNEL 2 - Link expired (time)');
            setRecoveryStatus('expired');
            setShowIntro(false);
            return;
          }
        }
        
        // Om tiden är OK men vi har fel = token redan använd
        if (desc.includes('expire') || desc.includes('invalid') || desc.includes('session') || 
            desc.includes('used') || desc.includes('consumed') || desc.includes('already') ||
            desc.includes('not found') || desc.includes('token')) {
          console.log('❌ TUNNEL 1 - Token already used');
          setRecoveryStatus('used');
        } else {
          console.log('❌ Setting recovery status to invalid due to unknown error');
          setRecoveryStatus('invalid');
        }
        setShowIntro(false);
        return;
      }
      
      // Om vi har recovery tokens, verifiera först om de är giltiga
      const hasAccessPair = !!(accessToken && refreshToken);
      const hasTokenHash = !!tokenHashParam;
      const hasToken = !!tokenParam;
      
      if (hasAccessPair || hasTokenHash || hasToken) {
        console.log('🔍 Recovery token detekterad - SPARAR INTE ännu:', {
          hasAccessPair,
          hasTokenHash,
          hasToken,
          tokenHashParam,
          tokenParam,
          accessToken: accessToken ? 'exists' : 'missing',
          refreshToken: refreshToken ? 'exists' : 'missing'
        });
        
        // Kontrollera om länken har gått ut (tidsgräns)
        if (issuedMs) {
          const currentTime = Date.now();
          const tenMinutesInMs = 10 * 60 * 1000;
          const timeElapsed = currentTime - issuedMs;
          
          if (timeElapsed > tenMinutesInMs) {
            console.log('❌ TUNNEL 2 - Reset link expired (time)');
            setRecoveryStatus('expired');
            setShowIntro(false);
            return;
          }
        }
        
        // VIKTIGT: Spara INTE token i sessionStorage ännu!
        // VIKTIGT: Städa INTE URL:en ännu!
        // Token ska bara konsumeras när användaren faktiskt ändrar lösenordet
        
        console.log('✅ Token är giltig - visar reset-formulär MEN konsumerar INTE token ännu');
        setShowIntro(false);
        setIsPasswordReset(true);
        return;
      }
      
      // Hantera bekräftelsestatusmeddelanden från redirect
      if (confirmed === 'success') {
        setConfirmationStatus('success');
        setConfirmationMessage('Fantastiskt! Ditt konto har aktiverats och du kan nu logga in i Parium.');
        console.log('Showing success confirmation message');
      } else if (confirmed === 'already') {
        setConfirmationStatus('already-confirmed');
        setConfirmationMessage('Ditt konto är redan aktiverat och redo att användas.');
        console.log('Showing already confirmed message');
      }
      
      setIsPasswordReset(isReset);
      
      // CRITICAL: Only redirect when BOTH user AND profile are fully loaded
      const hasRecoveryParamsNow = isReset || !!accessToken || !!refreshToken || !!tokenParam || !!tokenHashParam || tokenType === 'recovery';
      if (user && profile && !hasRecoveryParamsNow && confirmationStatus === 'none' && recoveryStatus === 'none' && !confirmed) {
        const role = (profile as any)?.role;
        const onboardingCompleted = (profile as any)?.onboarding_completed;
        
        if (role) {
          const target = role === 'employer' ? '/dashboard' : '/search-jobs';
          console.log('✅ Auth: Redirecting IMMEDIATELY to', target, 'for role:', role, 'onboarding:', onboardingCompleted);
          navigate(target, { replace: true });
        }
      } else if (user && !profile && !hasRecoveryParamsNow) {
        // Fallback: if profile hasn't loaded within 1500ms after login, go to home
        setTimeout(() => {
          if (!profile && !hasRecoveryParamsNow) {
            console.log('⚠️ Fallback redirect from Auth: profile still not loaded, going to /');
            navigate('/', { replace: true });
          }
        }, 1500);
      }
    };

    handleAuthFlow();
  }, [user, profile, navigate, searchParams, confirmationStatus, recoveryStatus]);

  
  // DIREKT EXPIRY-KONTROLL: Kolla OMEDELBART när isPasswordReset blir true
  useEffect(() => {
    if (isPasswordReset) {
      console.log('🚨 PASSWORD RESET SIDA AKTIVERAD - Kollar expiry direkt');
      
      // Först kolla sessionStorage (för tidigare besök)
      const raw = sessionStorage.getItem('parium-pending-recovery');
      if (raw) {
        try {
          const pending = JSON.parse(raw);
          console.log('📦 SessionStorage data when password reset activated:', pending);
          
          if (pending.issued_at) {
            const issuedTime = parseInt(pending.issued_at);
            const currentTime = Date.now();
            const tenMinutesInMs = 10 * 60 * 1000;
            const timeElapsed = currentTime - issuedTime;
            
            console.log('⏰ DIREKT EXPIRY-KONTROLL (sessionStorage):', {
              issued_at: pending.issued_at,
              issuedTime,
              currentTime,
              timeElapsed,
              tenMinutesInMs,
              isExpired: timeElapsed > tenMinutesInMs,
              timeElapsedMinutes: Math.floor(timeElapsed / 1000 / 60)
            });
            
            if (timeElapsed > tenMinutesInMs) {
              console.log('❌ TOKEN EXPIRED PÅ PASSWORD RESET AKTIVERING (sessionStorage)!');
              sessionStorage.removeItem('parium-pending-recovery');
              setRecoveryStatus('expired');
              setIsPasswordReset(false);
              return;
            }
            console.log('✅ Token giltig när password reset aktiveras (sessionStorage)');
          }
        } catch (e) {
          console.warn('Fel vid expiry-kontroll (sessionStorage):', e);
          setRecoveryStatus('expired');
          setIsPasswordReset(false);
          return;
        }
      } else {
        // NYTT: Kolla tokens från URL (första besöket)
        const accessTokenQP = searchParams.get('access_token');
        const refreshTokenQP = searchParams.get('refresh_token');
        const tokenParamQP = searchParams.get('token');
        const tokenHashParamQP = searchParams.get('token_hash');
        const issuedParam = searchParams.get('issued');
        
        const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '';
        const hashParams = new URLSearchParams(hash);
        const accessTokenHash = hashParams.get('access_token');
        const refreshTokenHash = hashParams.get('refresh_token');
        const tokenParamHash = hashParams.get('token');
        const tokenHashParamHash = hashParams.get('token_hash');
        const issuedHash = hashParams.get('issued');
        
        const hasAnyToken = !!(accessTokenQP || refreshTokenQP || tokenParamQP || tokenHashParamQP ||
                              accessTokenHash || refreshTokenHash || tokenParamHash || tokenHashParamHash);
        const finalIssued = issuedHash || issuedParam;
        
        console.log('🔍 Kollar tokens från URL:', {
          hasAnyToken,
          issuedParam: finalIssued,
          url: window.location.href
        });
        
        if (hasAnyToken || finalIssued) {
          if (finalIssued) {
            const issuedTime = parseInt(finalIssued);
            const currentTime = Date.now();
            const tenMinutesInMs = 10 * 60 * 1000;
            const timeElapsed = currentTime - issuedTime;
            
            console.log('⏰ DIREKT EXPIRY-KONTROLL (URL):', {
              issued: finalIssued,
              issuedTime,
              currentTime,
              timeElapsed,
              tenMinutesInMs,
              isExpired: timeElapsed > tenMinutesInMs,
              timeElapsedMinutes: Math.floor(timeElapsed / 1000 / 60)
            });
            
            if (timeElapsed > tenMinutesInMs) {
              console.log('❌ TOKEN EXPIRED PÅ PASSWORD RESET AKTIVERING (URL)!');
              setRecoveryStatus('expired');
              setIsPasswordReset(false);
              return;
            }
            console.log('✅ Token giltig när password reset aktiveras (URL)');
          } else if (hasAnyToken) {
            console.log('✅ Har tokens men ingen issued timestamp - tillåter reset');
          }
        } else {
          console.log('⚠️ Ingen sessionStorage data och inga URL tokens - sätter som expired');
          setRecoveryStatus('expired');
          setIsPasswordReset(false);
        }
      }
    }
  }, [isPasswordReset, searchParams]);

  // Auto-expire timer: kontrollera om lagrad token är äldre än 10 minuter
  useEffect(() => {
    if (!isPasswordReset) return;
    
    const checkTokenExpiry = () => {
      // Kolla först sessionStorage
      const raw = sessionStorage.getItem('parium-pending-recovery');
      if (raw) {
        try {
          const pending = JSON.parse(raw);
          console.log('🕐 AUTO-TIMER: Kollar expiry automatiskt (sessionStorage)');
          
          if (pending.issued_at) {
            const issuedTime = parseInt(pending.issued_at);
            const currentTime = Date.now();
            const tenMinutesInMs = 10 * 60 * 1000;
            const timeElapsed = currentTime - issuedTime;
            
            console.log('⏰ AUTO-TIMER CHECK (sessionStorage):', {
              issued_at: pending.issued_at,
              current_time: currentTime,
              time_elapsed_ms: timeElapsed,
              time_elapsed_minutes: Math.floor(timeElapsed / 1000 / 60),
              ten_minutes_ms: tenMinutesInMs,
              is_expired: timeElapsed > tenMinutesInMs
            });
            
            if (timeElapsed > tenMinutesInMs) {
              console.log('❌ AUTO-TIMER: Token har gått ut (sessionStorage) - växlar till expired sida');
              sessionStorage.removeItem('parium-pending-recovery');
              setRecoveryStatus('expired');
              setIsPasswordReset(false);
              return;
            }
            console.log('✅ AUTO-TIMER: Token fortfarande giltig (sessionStorage)');
          }
        } catch (e) {
          console.warn('AUTO-TIMER fel (sessionStorage):', e);
        }
      } else {
        // Kolla tokens från URL
        const issuedParam = searchParams.get('issued');
        const issuedHash = window.location.hash.includes('issued=') ? 
          new URLSearchParams(window.location.hash.slice(1)).get('issued') : null;
        const finalIssued = issuedHash || issuedParam;
        
        if (finalIssued) {
          const issuedTime = parseInt(finalIssued);
          const currentTime = Date.now();
          const tenMinutesInMs = 10 * 60 * 1000;
          const timeElapsed = currentTime - issuedTime;
          
          console.log('⏰ AUTO-TIMER CHECK (URL):', {
            issued: finalIssued,
            current_time: currentTime,
            time_elapsed_ms: timeElapsed,
            time_elapsed_minutes: Math.floor(timeElapsed / 1000 / 60),
            ten_minutes_ms: tenMinutesInMs,
            is_expired: timeElapsed > tenMinutesInMs
          });
          
          if (timeElapsed > tenMinutesInMs) {
            console.log('❌ AUTO-TIMER: Token har gått ut (URL) - växlar till expired sida');
            setRecoveryStatus('expired');
            setIsPasswordReset(false);
            return;
          }
          console.log('✅ AUTO-TIMER: Token fortfarande giltig (URL)');
        }
      }
    };
    
    // Kontrollera direkt
    checkTokenExpiry();
    
    // Kontrollera varje minut
    const interval = setInterval(checkTokenExpiry, 60000);
    
    return () => clearInterval(interval);
  }, [isPasswordReset, searchParams]);

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
    try {
      sessionStorage.removeItem('parium-pending-recovery');
    } catch {}
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
    
    if (newPassword.length < 6) {
      toast({
        title: "Lösenordet är för kort",
        description: "Lösenordet måste vara minst 6 tecken långt",
        variant: "destructive"
      });
      return;
    }

    try {
      console.log('🔄 Starting handlePasswordReset');
      
      // FÖRSTA KONTROLLEN: Kolla om token har gått ut baserat på issued timestamp
      console.log('🕐 Checking if reset token has expired...');
      
      // Kolla först sessionStorage (från tidigare besök)
      const raw = sessionStorage.getItem('parium-pending-recovery');
      console.log('📦 SessionStorage data:', raw);
      
      if (raw) {
        const pending = JSON.parse(raw);
        console.log('🔓 Parsed pending data:', pending);
        
        if (pending.issued_at) {
          const issuedTime = parseInt(pending.issued_at);
          const currentTime = Date.now();
          const tenMinutesInMs = 10 * 60 * 1000;
          const timeElapsed = currentTime - issuedTime;
          
          console.log('🔍 Password reset token check (sessionStorage):', {
            issued_at: pending.issued_at,
            issuedTime,
            currentTime,
            timeElapsed,
            tenMinutesInMs,
            isExpired: timeElapsed > tenMinutesInMs,
            timeElapsedMinutes: Math.floor(timeElapsed / 1000 / 60)
          });
          
          if (timeElapsed > tenMinutesInMs) {
            console.log('❌ Token expired during password reset attempt (sessionStorage)');
            sessionStorage.removeItem('parium-pending-recovery');
            setRecoveryStatus('expired');
            return;
          }
          console.log('✅ Token is still valid (sessionStorage)');
        }
      } else {
        // NYTT: Kolla tokens direkt från URL (första användningen)
        console.log('🔍 Kollar tokens från URL för expiry check...');
        
        const issuedParam = searchParams.get('issued');
        const issuedHash = window.location.hash.includes('issued=') ? 
          new URLSearchParams(window.location.hash.slice(1)).get('issued') : null;
        const finalIssued = issuedHash || issuedParam;
        
        if (finalIssued) {
          const issuedTime = parseInt(finalIssued);
          const currentTime = Date.now();
          const tenMinutesInMs = 10 * 60 * 1000;
          const timeElapsed = currentTime - issuedTime;
          
          console.log('🔍 Checking issued parameter for expiry (URL):', {
            issued: finalIssued,
            issuedTime,
            currentTime,
            timeElapsed,
            tenMinutesInMs,
            isExpired: timeElapsed > tenMinutesInMs
          });
          
          if (timeElapsed > tenMinutesInMs) {
            console.log('❌ Issued parameter shows token expired (URL)');
            setRecoveryStatus('expired');
            return;
          }
          console.log('✅ Issued parameter shows token is still valid (URL)');
        } else {
          console.log('⚠️ No pending recovery data and no issued parameter found');
        }
      }

      console.log('🔍 Checking session...');
      // Säkerställ session först (förbruka länken först vid inlämning)
      const { data: sessionData } = await supabase.auth.getSession();
      let hasSession = !!sessionData.session;
      console.log('📊 Has active session:', hasSession);

      if (!hasSession) {
        console.log('🗂️ No active session, attempting to establish session...');
        
        // Kolla först om vi har sparad token i sessionStorage (från tidigare besök)
        if (raw) {
          const pending = JSON.parse(raw);
          
          if ((pending.token_hash || pending.token) && (pending.type === 'recovery' || !pending.type)) {
            const verifyOptions: any = { type: 'recovery' };
            if (pending.token_hash) verifyOptions.token_hash = pending.token_hash;
            if (pending.token) verifyOptions.token = pending.token;
            const { error } = await supabase.auth.verifyOtp(verifyOptions);
            if (error) throw error;
            hasSession = true;
          } else if (pending.access_token && pending.refresh_token) {
            const { error } = await supabase.auth.setSession({
              access_token: pending.access_token,
              refresh_token: pending.refresh_token,
            });
            if (error) throw error;
            hasSession = true;
          }
        } else {
          // NYTT: Hämta tokens från URL (första gången de används)
          console.log('🔍 Hämtar tokens från URL för första användningen...');
          
          const accessTokenQP = searchParams.get('access_token');
          const refreshTokenQP = searchParams.get('refresh_token');
          const tokenTypeQP = searchParams.get('type');
          const tokenParamQP = searchParams.get('token');
          const tokenHashParamQP = searchParams.get('token_hash');
          
          const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '';
          const hashParams = new URLSearchParams(hash);
          const accessTokenHash = hashParams.get('access_token');
          const refreshTokenHash = hashParams.get('refresh_token');
          const tokenTypeHash = hashParams.get('type');
          const tokenParamHash = hashParams.get('token');
          const tokenHashParamHash = hashParams.get('token_hash');
          
          const urlAccessToken = accessTokenHash || accessTokenQP;
          const urlRefreshToken = refreshTokenHash || refreshTokenQP;
          const urlTokenType = tokenTypeHash || tokenTypeQP;
          const urlTokenParam = tokenParamHash || tokenParamQP;
          const urlTokenHashParam = tokenHashParamHash || tokenHashParamQP;
          
          console.log('🔍 URL tokens found:', {
            hasAccessToken: !!urlAccessToken,
            hasRefreshToken: !!urlRefreshToken,
            hasTokenParam: !!urlTokenParam,
            hasTokenHashParam: !!urlTokenHashParam,
            tokenType: urlTokenType
          });
          
          if (urlAccessToken && urlRefreshToken) {
            console.log('✅ Using access/refresh tokens from URL');
            const { error } = await supabase.auth.setSession({
              access_token: urlAccessToken,
              refresh_token: urlRefreshToken,
            });
            if (error) throw error;
            hasSession = true;
            
            // Spara token-info för senare rensning
            const payload = {
              type: urlTokenType || 'recovery',
              token: urlTokenParam || null,
              token_hash: urlTokenHashParam || null,
              access_token: urlAccessToken,
              refresh_token: urlRefreshToken,
              issued_at: Date.now(),
              stored_at: Date.now()
            };
            sessionStorage.setItem('parium-pending-recovery', JSON.stringify(payload));
            
          } else if (urlTokenHashParam || urlTokenParam) {
            console.log('✅ Using token/token_hash from URL');
            const verifyOptions: any = { type: 'recovery' };
            if (urlTokenHashParam) verifyOptions.token_hash = urlTokenHashParam;
            if (urlTokenParam) verifyOptions.token = urlTokenParam;
            
            const { error } = await supabase.auth.verifyOtp(verifyOptions);
            if (error) throw error;
            hasSession = true;
            
            // Spara token-info för senare rensning
            const payload = {
              type: urlTokenType || 'recovery',
              token: urlTokenParam || null,
              token_hash: urlTokenHashParam || null,
              access_token: null,
              refresh_token: null,
              issued_at: Date.now(),
              stored_at: Date.now()
            };
            sessionStorage.setItem('parium-pending-recovery', JSON.stringify(payload));
            
          } else {
            // För nya länkar med bara issued parameter
            const issuedParam = searchParams.get('issued');
            if (issuedParam) {
              const issuedTime = parseInt(issuedParam);
              const currentTime = Date.now();
              const tenMinutesInMs = 10 * 60 * 1000;
              const timeElapsed = currentTime - issuedTime;
              
              if (timeElapsed > tenMinutesInMs) {
                console.log('❌ Issued parameter shows expired token on session check');
                setRecoveryStatus('expired');
                return;
              } else {
                console.log('⚠️ Har bara issued parameter, inte riktiga tokens - kan inte uppdatera lösenord');
                setRecoveryStatus('consumed');
                return;
              }
            }
          }
        }
      }

      const result = await updatePassword(newPassword);
      if (result.error) throw result.error;

      // Nu när lösenordet är ändrat - rensa sessionStorage och URL
      sessionStorage.removeItem('parium-pending-recovery');
      
      // Städa URL:en NU (efter lyckad lösenordsändring)
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
        description: "Ditt lösenord har ändrats och du är nu inloggad.",
      });
      
      navigate('/');
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
      if (msg.includes('expired') || msg.includes('invalid') || msg.includes('session')) {
        // Kontrollera om det är en "consumed" länk (redan använd) vs verkligt utgången
        const issuedParam = searchParams.get('issued');
        if (issuedParam) {
          const issuedTime = parseInt(issuedParam);
          const currentTime = Date.now();
          const timeElapsed = currentTime - issuedTime;
          const tenMinutesInMs = 10 * 60 * 1000;
          
          if (timeElapsed <= tenMinutesInMs) {
            // Länken är inte utgången men ger "expired" fel = förbrukad (använd en gång)
            setRecoveryStatus('consumed');
          } else {
            // Länken är verkligen utgången
            setRecoveryStatus('expired');
          }
        } else {
          setRecoveryStatus('expired');
        }
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
                className="bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10 placeholder:text-white/60"
              />
              <Button type="submit" className="w-full" disabled={resending}>
                {resending ? 'Skickar...' : 'Skicka ny länk'}
              </Button>
            </form>
            {resendMessage && (
              <p className="text-sm text-primary-foreground/80 whitespace-pre-line">{resendMessage}</p>
            )}
            <Button onClick={handleBackToLogin} className="w-full">
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

  
  console.log('🔍 AUTH COMPONENT RENDERING - Debug info:', {
    isPasswordReset,
    currentUrl: window.location.href,
    sessionStorage: sessionStorage.getItem('parium-pending-recovery')
  });

  // RENDERINGSKONTROLL: Kolla expiry VARJE GÅNG komponenten renderas
  if (isPasswordReset) {
    console.log('🔍 RENDERINGSKONTROLL - Password reset sida renderas');
    const raw = sessionStorage.getItem('parium-pending-recovery');
    if (raw) {
      try {
        const pending = JSON.parse(raw);
        console.log('📦 SessionStorage vid rendering:', pending);
        
        if (pending.issued_at) {
          const issuedTime = parseInt(pending.issued_at);
          const currentTime = Date.now();
          const tenMinutesInMs = 10 * 60 * 1000;
          const timeElapsed = currentTime - issuedTime;
          
          console.log('⏰ RENDERING EXPIRY-KONTROLL:', {
            issued_at: pending.issued_at,
            issuedTime,
            currentTime,
            timeElapsed,
            tenMinutesInMs,
            isExpired: timeElapsed > tenMinutesInMs,
            timeElapsedMinutes: Math.floor(timeElapsed / 1000 / 60)
          });
          
          if (timeElapsed > tenMinutesInMs) {
            console.log('❌ TOKEN EXPIRED VID RENDERING - OMDIRIGERAR TILL EXPIRED');
            sessionStorage.removeItem('parium-pending-recovery');
            // Använd ett annat approach - sätt bara expired status direkt
              return (
                <div 
                  className="bg-gradient-parium flex items-center justify-center p-4 smooth-scroll touch-pan" 
                  style={{ 
                    WebkitOverflowScrolling: 'touch',
                    minHeight: 'calc(100dvh + env(safe-area-inset-bottom, 0px))',
                    paddingBottom: 'env(safe-area-inset-bottom, 0px)'
                  }}
                >
                <Card className="w-full max-w-md bg-glass backdrop-blur-md border-white/20">
                  <CardContent className="p-8 text-center space-y-4">
                    <AlertCircle className="h-16 w-16 text-red-500 mx-auto" />
                    <h2 className="text-2xl font-bold text-primary-foreground">Återställningslänken har gått ut</h2>
                    <p className="text-primary-foreground/80">Länken har gått ut efter 10 minuter. Skriv din e‑postadress så skickar vi en ny länk för att återställa ditt lösenord.</p>
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
                    <Button variant="outline" onClick={handleBackToLogin} className="w-full">
                      Tillbaka till inloggning
                    </Button>
                  </CardContent>
                </Card>
              </div>
            );
          }
        }
      } catch (e) {
        console.warn('Fel vid renderingskontroll:', e);
      }
    }
  }

  // Använd rätt komponent baserat på skärmstorlek
  if (device === 'mobile') {
    return (
      <>
        {/* Pull-to-refresh spinner */}
        <div 
          className="fixed top-8 left-1/2 -translate-x-1/2 z-50 transition-opacity duration-200"
          style={{ 
            opacity: pullProgress,
            pointerEvents: 'none'
          }}
        >
          <Loader2 
            className={`w-8 h-8 text-primary-foreground ${isRefreshing ? 'animate-spin' : ''}`}
            style={{
              transform: isRefreshing ? 'none' : `rotate(${pullProgress * 360}deg)`,
              transition: isRefreshing ? 'none' : 'transform 0.1s linear'
            }}
          />
        </div>
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
        />
      </>
    );
  }

  if (device === 'tablet') {
    return (
      <>
        {/* Pull-to-refresh spinner */}
        <div 
          className="fixed top-8 left-1/2 -translate-x-1/2 z-50 transition-opacity duration-200"
          style={{ 
            opacity: pullProgress,
            pointerEvents: 'none'
          }}
        >
          <Loader2 
            className={`w-8 h-8 text-primary-foreground ${isRefreshing ? 'animate-spin' : ''}`}
            style={{
              transform: isRefreshing ? 'none' : `rotate(${pullProgress * 360}deg)`,
              transition: isRefreshing ? 'none' : 'transform 0.1s linear'
            }}
          />
        </div>
        <AuthTablet
          isPasswordReset={isPasswordReset}
          newPassword={newPassword}
          setNewPassword={setNewPassword}
          confirmPassword={confirmPassword}
          setConfirmPassword={setConfirmPassword}
          handlePasswordReset={handlePasswordReset}
          onBackToLogin={handleBackToLogin}
          onAuthModeChange={setIsLoginMode}
        />
      </>
    );
  }

  return (
    <>
      {/* Pull-to-refresh spinner */}
      <div 
        className="fixed top-8 left-1/2 -translate-x-1/2 z-50 transition-opacity duration-200"
        style={{ 
          opacity: pullProgress,
          pointerEvents: 'none'
        }}
      >
        <Loader2 
          className={`w-8 h-8 text-primary-foreground ${isRefreshing ? 'animate-spin' : ''}`}
          style={{
            transform: isRefreshing ? 'none' : `rotate(${pullProgress * 360}deg)`,
            transition: isRefreshing ? 'none' : 'transform 0.1s linear'
          }}
        />
      </div>
      <AuthDesktop
        isPasswordReset={isPasswordReset}
        newPassword={newPassword}
        setNewPassword={setNewPassword}
        confirmPassword={confirmPassword}
        setConfirmPassword={setConfirmPassword}
        handlePasswordReset={handlePasswordReset}
        onBackToLogin={handleBackToLogin}
        onAuthModeChange={setIsLoginMode}
      />
    </>
  );
};

export default Auth;