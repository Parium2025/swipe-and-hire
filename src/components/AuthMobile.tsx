import { useState, useRef, useEffect, startTransition } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AnimatedBackground } from './AnimatedBackground';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { SlidingTabs } from '@/components/ui/sliding-tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Eye, EyeOff, User, Building2, Mail, Key, Phone, Globe, MapPin, Users, ChevronDown, Search, Check } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import { validateSwedishPhoneNumber } from '@/lib/phoneValidation';
import { SWEDISH_INDUSTRIES, EMPLOYEE_COUNT_OPTIONS } from '@/lib/industries';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { setRememberMe as setRememberMePersistence, shouldRememberUser } from '@/lib/authStorage';
import { AuthLogoInline } from '@/assets/authLogoInline';
import { authSplashEvents } from '@/lib/authSplashEvents';

interface AuthMobileProps {
  isPasswordReset: boolean;
  newPassword: string;
  setNewPassword: (value: string) => void;
  confirmPassword: string;
  setConfirmPassword: (value: string) => void;
  handlePasswordReset: (e: React.FormEvent) => void;
  onBackToLogin?: () => void;
  onAuthModeChange?: (isLogin: boolean) => void;
  initialMode?: string;
  initialRole?: string;
}

const AuthMobile = ({ 
  isPasswordReset, 
  newPassword, 
  setNewPassword, 
  confirmPassword, 
  setConfirmPassword, 
  handlePasswordReset,
  onBackToLogin,
  onAuthModeChange,
  initialMode,
  initialRole
}: AuthMobileProps) => {
  const [emailSuggestions, setEmailSuggestions] = useState<string[]>([]);
  const [showEmailSuggestions, setShowEmailSuggestions] = useState(false);
  const [isLogin, setIsLogin] = useState(initialMode !== 'register');
  const isMobile = useIsMobile();
  const [searchTerm, setSearchTerm] = useState('');
  // Separate form data for each role
  const [jobSeekerData, setJobSeekerData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    phoneError: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [employerData, setEmployerData] = useState({
    firstName: '',
    lastName: '',
    companyName: '',
    orgNumber: '',
    industry: '',
    address: '',
    website: '',
    companyDescription: '',
    employeeCount: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [role, setRole] = useState<'job_seeker' | 'employer'>(
    initialRole === 'employer' ? 'employer' : 'job_seeker'
  );
  const [showPassword, setShowPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [showResend, setShowResend] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetPasswordSent, setResetPasswordSent] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [hasRegistered, setHasRegistered] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => {
    return shouldRememberUser();
  });

  const triggerRef = useRef<HTMLButtonElement>(null);
  const employeeCountTriggerRef = useRef<HTMLButtonElement>(null);
  const [industryMenuOpen, setIndustryMenuOpen] = useState(false);
  const [employeeMenuOpen, setEmployeeMenuOpen] = useState(false);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const resetSectionRef = useRef<HTMLDivElement>(null);
  // Independent scroll positions per tab
  const signupScrollRef = useRef(0);

  const { signIn, signUp, resendConfirmation, resetPassword } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (showResetPassword || resetPasswordSent) {
      setTimeout(() => {
        resetSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, 0);
    }
  }, [showResetPassword, resetPasswordSent]);

  // Utility: force top without smooth; works reliably on iOS Safari
  const hardScrollTo = (top: number) => {
    try {
      const html = document.documentElement;
      const body = document.body;
      const prev = (html as any).style.scrollBehavior;
      (html as any).style.scrollBehavior = 'auto';
      window.scrollTo(0, top);
      // double-write to be safe on iOS
      (html as any).scrollTop = top;
      (body as any).scrollTop = top;
      requestAnimationFrame(() => {
        window.scrollTo(0, top);
        (html as any).style.scrollBehavior = prev || '';
      });
    } catch (scrollError) {
      console.warn('Failed to hard scroll:', scrollError);
    }
  };

  // Handle scroll-lock directly for instant response
  const handleTabChange = (value: string) => {
    const newIsLogin = value === 'login';
    if (newIsLogin === isLogin) return; // avoid redundant work

    // Save current scroll if leaving signup
    if (!isLogin && typeof window !== 'undefined') {
      signupScrollRef.current = window.scrollY || 0;
    }

    // Scroll BEFORE state change to prevent layout jump
    try { (document.activeElement as HTMLElement | null)?.blur?.(); } catch (blurError) {
      console.warn('Failed to blur active element:', blurError);
    }
    const targetTop = newIsLogin ? 0 : (signupScrollRef.current || 0);
    if (typeof window !== 'undefined') hardScrollTo(targetTop);

    onAuthModeChange?.(newIsLogin);

    // Now swap content
    setIsLogin(newIsLogin);
    setHasRegistered(false);
    setShowResend(false);
    setShowResetPassword(false);
    setResetPasswordSent(false);

    // Defer heavy clearing until idle to avoid blocking frame
    const deferClear = () => startTransition(() => clearFormData());
    if (typeof (window as any).requestIdleCallback === 'function') {
      (window as any).requestIdleCallback(deferClear, { timeout: 500 } as any);
    } else {
      setTimeout(deferClear, 0);
    }
  };
  // Popular email domains for suggestions (Swedish and international)
  const popularDomains = [
    '@gmail.com', '@gmail.se', '@hotmail.com', '@hotmail.se', '@outlook.com', '@outlook.se',
    '@yahoo.com', '@yahoo.se', '@icloud.com', '@live.se', '@live.com', '@telia.com', '@spray.se',
    '@bredband2.com', '@comhem.se', '@me.com', '@msn.com', '@aol.com', '@protonmail.com', 
    '@yandex.com', '@mail.ru'
  ];

  // Handle email input with suggestions
  const handleEmailChange = (value: string) => {
    // VIKTIGT: Om användaren ändrar e-postadressen EFTER registrering,
    // återställ formuläret så "Registrera"-knappen visas igen
    if (hasRegistered) {
      setHasRegistered(false);
      setShowResend(false);
    }
    
    if (role === 'job_seeker') {
      setJobSeekerData(prev => ({ ...prev, email: value }));
    } else {
      setEmployerData(prev => ({ ...prev, email: value }));
    }
    
    if (value.includes('@')) {
      const [localPart, domainPart] = value.split('@');
      
      if (domainPart.length === 0) {
        const suggestions = popularDomains.map(domain => localPart + domain);
        setEmailSuggestions(suggestions);
        setShowEmailSuggestions(true);
      } else {
        const filteredDomains = popularDomains.filter(domain => {
          const domainWithoutAt = domain.substring(1);
          return domainWithoutAt.toLowerCase().startsWith(domainPart.toLowerCase());
        });
        
        if (filteredDomains.length > 0) {
          const suggestions = filteredDomains.map(domain => localPart + domain);
          setEmailSuggestions(suggestions);
          setShowEmailSuggestions(true);
        } else {
          setShowEmailSuggestions(false);
        }
      }
    } else {
      setShowEmailSuggestions(false);
    }
  };

  // Use centralized phone validation
  const validatePhoneNumber = (phoneNumber: string) => {
    return validateSwedishPhoneNumber(phoneNumber, false);
  };

  const handlePhoneChange = (value: string) => {
    // Filter out non-numeric characters except + (for +46)
    const filteredValue = value.replace(/[^0-9+]/g, '');
    const validation = validatePhoneNumber(filteredValue);
    setJobSeekerData(prev => ({
      ...prev,
      phone: filteredValue,
      phoneError: validation.error
    }));
  };

  // Password strength calculation
  const calculatePasswordStrength = (password: string) => {
    let strength = 0;
    if (password.length >= 8) strength += 1;
    if (/[A-Z]/.test(password)) strength += 1;
    if (/[a-z]/.test(password)) strength += 1;
    if (/[0-9]/.test(password)) strength += 1;
    if (/[^A-Za-z0-9]/.test(password)) strength += 1;
    return strength;
  };

  const handlePasswordChange = (newPassword: string) => {
    if (role === 'job_seeker') {
      setJobSeekerData(prev => ({ ...prev, password: newPassword }));
    } else {
      setEmployerData(prev => ({ ...prev, password: newPassword }));
    }
    setPasswordStrength(calculatePasswordStrength(newPassword));
  };

  // Clear all form data when switching between login and registration
  const clearFormData = () => {
    setJobSeekerData({
      firstName: '',
      lastName: '',
      phone: '',
      phoneError: '',
      email: '',
      password: '',
      confirmPassword: ''
    });
    setEmployerData({
      firstName: '',
      lastName: '',
      companyName: '',
      orgNumber: '',
      industry: '',
      address: '',
      website: '',
      companyDescription: '',
      employeeCount: '',
      email: '',
      password: '',
      confirmPassword: ''
    });
    setShowPassword(false);
    setPasswordStrength(0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if online before attempting auth
    if (!navigator.onLine) {
      toast({
        title: "Ingen anslutning",
        description: "Du måste vara online för att logga in eller registrera dig",
        variant: "destructive"
      });
      return;
    }
    
    // Förhindra submit om användaren redan har registrerat sig
    if (hasRegistered) {
      return;
    }
    
    setLoading(true);
    setShowResend(false);
    setShowResetPassword(false);
    setResetPasswordSent(false);

    try {
      const currentData = role === 'job_seeker' ? jobSeekerData : employerData;
      const currentEmail = currentData.email;
      const currentPassword = currentData.password;
      
      if (isLogin) {
        // Show premium splash screen while authenticating
        authSplashEvents.show();
        
        const result = await signIn(currentEmail, currentPassword);

        if (result?.error) {
          // Hide splash on error
          authSplashEvents.hide();
          
          if (result.error.code === 'email_not_confirmed') {
            setShowResend(true);
          } else if (result.error.showResetPassword) {
            setShowResetPassword(true);
          }
        }
        // Vid lyckad inloggning: splash förblir synlig tills redirect sker i Auth.tsx
      } else {
        // Validate all required fields
        if (role === 'job_seeker') {
          if (!jobSeekerData.firstName.trim()) {
            toast({
              title: "Förnamn krävs",
              description: "Vänligen ange ditt förnamn",
              variant: "destructive"
            });
            setLoading(false);
            return;
          }

          if (!jobSeekerData.lastName.trim()) {
            toast({
              title: "Efternamn krävs",
              description: "Vänligen ange ditt efternamn",
              variant: "destructive"
            });
            setLoading(false);
            return;
          }

          if (!jobSeekerData.phone.trim()) {
            toast({
              title: "Telefonnummer krävs",
              description: "Vänligen ange ditt telefonnummer",
              variant: "destructive"
            });
            setLoading(false);
            return;
          }
        }

        // Employer specific validation
        if (role === 'employer') {
          if (!employerData.firstName.trim()) {
            toast({
              title: "Förnamn krävs",
              description: "Vänligen ange ditt förnamn",
              variant: "destructive"
            });
            setLoading(false);
            return;
          }

          if (!employerData.lastName.trim()) {
            toast({
              title: "Efternamn krävs",
              description: "Vänligen ange ditt efternamn",
              variant: "destructive"
            });
            setLoading(false);
            return;
          }

          if (!employerData.companyName.trim()) {
            toast({
              title: "Företagsnamn krävs",
              description: "Vänligen ange företagsnamn",
              variant: "destructive"
            });
            setLoading(false);
            return;
          }

          if (!employerData.industry.trim()) {
            toast({
              title: "Bransch krävs",
              description: "Vänligen välj bransch",
              variant: "destructive"
            });
            setLoading(false);
            return;
          }

          if (!employerData.employeeCount) {
            toast({
              title: "Anställda krävs",
              description: "Vänligen välj antal anställda",
              variant: "destructive"
            });
            setLoading(false);
            return;
          }

          if (!employerData.address.trim()) {
            toast({
              title: "Adress krävs",
              description: "Vänligen ange företagets adress",
              variant: "destructive"
            });
            setLoading(false);
            return;
          }

          if (!employerData.website.trim()) {
            toast({
              title: "Webbplats krävs", 
              description: "Vänligen ange företagets webbplats",
              variant: "destructive"
            });
            setLoading(false);
            return;
          }
        }

        if (!currentEmail.trim()) {
          toast({
            title: "E-post krävs",
            description: "Vänligen ange din e-postadress",
            variant: "destructive"
          });
          setLoading(false);
          return;
        }

        if (!currentPassword.trim()) {
          toast({
            title: "Lösenord krävs",
            description: "Vänligen ange ett lösenord",
            variant: "destructive"
          });
          setLoading(false);
          return;
        }

        // Validera lösenordslängd
        if (currentPassword.length < 7) {
          toast({
            title: "För kort lösenord",
            description: "Lösenordet måste vara minst 7 tecken",
            variant: "destructive"
          });
          setLoading(false);
          return;
        }

        // Validera att lösenorden matchar
        const currentConfirmPassword = role === 'job_seeker' ? jobSeekerData.confirmPassword : employerData.confirmPassword;
        if (currentPassword !== currentConfirmPassword) {
          toast({
            title: "Lösenorden matchar inte",
            description: "Vänligen kontrollera att lösenorden är identiska",
            variant: "destructive"
          });
          setLoading(false);
          return;
        }

        const result = await signUp(currentEmail, currentPassword, {
          role,
          first_name: currentData.firstName,
          last_name: currentData.lastName,
          ...(role === 'job_seeker' && { phone: jobSeekerData.phone }),
          ...(role === 'employer' && {
            company_name: employerData.companyName,
            org_number: employerData.orgNumber,
            industry: employerData.industry,
            address: employerData.address,
            website: employerData.website,
            company_description: employerData.companyDescription,
            employee_count: employerData.employeeCount
          })
        });
        
        if (result.error) {
          // If user already exists, show specific message and switch to login
          if (result.error.isExistingUser) {
            // Auto-switch to login tab after a short delay
            setTimeout(() => {
              setIsLogin(true);
            }, 3000);
          }
        } else {
          setShowResend(true);
          setHasRegistered(true);
        }
      }
    } catch (error) {
      console.error('Auth error:', error);
      // Hide splash on unexpected error
      authSplashEvents.hide();
    } finally {
      setLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    const currentData = role === 'job_seeker' ? jobSeekerData : employerData;
    if (!currentData.email) return;
    setResendLoading(true);
    await resendConfirmation(currentData.email, role);
    setResendLoading(false);
  };

   const handleResetPasswordEmail = async () => {
     const currentData = role === 'job_seeker' ? jobSeekerData : employerData;
     if (!currentData.email) {
       toast({
         title: "E-post krävs",
         description: "Ange din e-postadress först",
         variant: "destructive"
       });
       return;
     }
     setResetLoading(true);
     const result = await resetPassword(currentData.email);
     if (!result.error) {
       setResetPasswordSent(true);
     }
     setResetLoading(false);
   };

  const handleBackToLogin = () => {
    // Rensa password reset-relaterad data
    sessionStorage.removeItem('parium-pending-recovery');
    
    // Navigera till ren auth-sida utan parametrar
    navigate('/auth', { replace: true });
  };

  if (isPasswordReset) {
    return (
      <div 
        className="overflow-y-auto p-4 py-8 auth-dark flex flex-col" 
        style={{ 
          WebkitOverflowScrolling: 'touch', 
          touchAction: 'pan-y',
          minHeight: 'calc(100dvh + env(safe-area-inset-bottom, 0px))',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)'
        }}
      >
        <Card 
          className="w-full max-w-sm bg-white/[0.01] backdrop-blur-sm border-white/20 my-auto mx-auto overflow-y-auto" 
          style={{ 
            maxHeight: '85svh',
            WebkitOverflowScrolling: 'touch',
            overscrollBehavior: 'contain',
            touchAction: 'pan-y'
          }}
        >
          <CardHeader className="text-center">
            <CardTitle className="text-white">Nytt lösenord</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordReset} className="space-y-3 md:space-y-4">
              <div>
                <Label htmlFor="newPassword" className="text-white">Nytt lösenord</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  className="bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10 hover:border-white/50 md:hover:border-white/50 placeholder:text-white h-11 sm:h-9"
                />
              </div>
              <div>
                <Label htmlFor="confirmPassword" className="text-white">Bekräfta lösenord</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onPaste={(e) => e.preventDefault()}
                  onCopy={(e) => e.preventDefault()}
                  required
                          className="bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10 hover:border-white/50 md:hover:border-white/50 placeholder:text-white h-11 sm:h-9"
                />
              </div>
              <Button type="submit" variant="glass" className="w-full min-h-[44px]" disabled={loading}>
                {loading ? "Sparar..." : "Spara nytt lösenord"}
              </Button>
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => (onBackToLogin ? onBackToLogin() : handleBackToLogin())}
                  className="text-sm text-white hover:underline"
                >
                  Tillbaka till inloggning
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div 
      className="flex flex-col relative auth-dark" 
      style={{ 
        WebkitOverflowScrolling: 'touch', 
        touchAction: 'pan-y',
        minHeight: '100svh'
      }}
    >
      {/* Animated background with bubbles and glow */}
      <AnimatedBackground />

      <div 
        ref={containerRef} 
        className="relative z-10 flex flex-col min-h-screen overflow-anchor-none"
        style={{ 
          paddingTop: 'env(safe-area-inset-top)', 
          WebkitOverflowScrolling: 'touch'
        }}
      >
        {/* Header med logo och text */}
        <div className="flex flex-col items-center px-6 pt-6 pb-2">
          <div className="text-center mb-4">
            <div className="-mb-6">
              <div className="relative mx-auto w-fit min-h-[200px] flex items-center justify-center">
                {/* Glow effect bakom loggan - subtle och täcker hela loggan */}
                <div className="absolute inset-0 flex items-center justify-center -translate-y-2">
                  <div className="w-72 h-52 bg-primary-glow/25 rounded-full blur-[40px]"></div>
                </div>
                <div className="absolute inset-0 flex items-center justify-center -translate-y-2">
                  <div className="w-52 h-36 bg-primary-glow/22 rounded-full blur-[35px]"></div>
                </div>
                <div className="absolute inset-0 flex items-center justify-center -translate-y-2">
                  <div className="w-44 h-28 bg-primary-glow/20 rounded-full blur-[30px]"></div>
                </div>
                <div className="absolute inset-0 flex items-center justify-center -translate-y-2">
                  <div className="w-36 h-20 bg-primary-glow/18 rounded-full blur-[25px]"></div>
                </div>
                {/*
                  IMPORTANT: The logo MUST have an explicit width.
                  Background images have no intrinsic width, and the surrounding
                  `w-fit` container can collapse to 0 on mobile otherwise.
                  This mirrors the Home logo structure (fixed box + backgroundImage).
                */}
                <AuthLogoInline className="relative h-40 w-[min(400px,90vw)] scale-125" />
              </div>
            </div>
            
            <h1 className="text-2xl font-semibold text-white mb-2 relative z-10 [color:rgb(255,255,255)] drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]">
              Framtiden börjar med ett swipe
            </h1>
          </div>

          {/* Auth form */}
          <div className="w-full max-w-sm overscroll-contain">
            <Card 
              className="bg-white/[0.01] backdrop-blur-sm border-white/20 shadow-2xl rounded-2xl overflow-hidden"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              <CardContent className={cn("p-4 md:p-6", isLogin && (showResetPassword || resetPasswordSent) && "pb-24")}>
                 <Tabs value={isLogin ? 'login' : 'signup'} onValueChange={handleTabChange}>
                  <SlidingTabs isLogin={isLogin} onTabChange={handleTabChange} />

                  {/* Forms wrapper for instant swap */}
                  <div className="relative">
                    {/* Login form - always in DOM, overlay swap */}
                    <div className={isLogin ? 'relative opacity-100 pointer-events-auto transition-none' : 'absolute inset-0 opacity-0 pointer-events-none transition-none'}>
                    <form key="login-form" onSubmit={handleSubmit} className="space-y-3 md:space-y-4">
                  <div className="relative overflow-anchor-none">
                        <Label htmlFor="email" className="text-white">
                          <Mail className="h-4 w-4 inline mr-2" />
                          E-post
                        </Label>
                        <Input
                          id="email"
                          type="email"
                          value={role === 'job_seeker' ? jobSeekerData.email : employerData.email}
                          onChange={(e) => handleEmailChange(e.target.value)}
                          required
                            name={`email-${role}`}
                            autoComplete={`${role}-email`}
                          inputMode="email"
                          spellCheck={false}
                          autoCapitalize="none"
                          className="mt-1 bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10 hover:border-white/50 md:hover:border-white/50 placeholder:text-white h-11 sm:h-9"
                        />
                        {/* email suggestions removed for simpler UX */}
                      </div>
                      <div>
                        <Label htmlFor="password" className="text-white">
                          <Key className="h-4 w-4 inline mr-2" />
                          Lösenord
                        </Label>
                        <div className="relative mt-1">
                          <Input
                            id="password"
                            type={showPassword ? 'text' : 'password'}
                            value={role === 'job_seeker' ? jobSeekerData.password : employerData.password}
                            onChange={(e) => handlePasswordChange(e.target.value)}
                            required
                            name={`password-${role}`}
                            autoComplete={`${role}-current-password`}
                            className="bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10 hover:border-white/50 md:hover:border-white/50 placeholder:text-white h-11 sm:h-9"
                          />
                          <button
                            type="button"
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-white hover:text-white transition-colors bg-transparent border-0 outline-none focus:outline-none active:bg-transparent"
                            onClick={() => setShowPassword(!showPassword)}
                            onTouchStart={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            onTouchEnd={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                      
                      {/* Håll mig inloggad checkbox */}
                      <label htmlFor="rememberMe" className="mb-4 inline-flex items-center gap-2 cursor-pointer select-none group">
                        <input
                          id="rememberMe"
                          type="checkbox"
                          checked={rememberMe}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setRememberMe(checked);
                            setRememberMePersistence(checked);
                          }}
                          className="sr-only peer"
                        />
                        <span className="relative h-4 w-4 rounded border-2 border-white/60 bg-transparent flex items-center justify-center transition-all peer-checked:bg-white/10 peer-checked:border-white group-hover:border-white/80 peer-checked:[&>svg]:opacity-100 peer-checked:[&>svg]:scale-100">
                          <Check className="absolute h-3 w-3 text-white opacity-0 scale-90 transition-all duration-200 pointer-events-none" strokeWidth={4} stroke="white" />
                        </span>
                        <span className="text-sm text-white">Håll mig inloggad</span>
                      </label>
                      
                       <Button type="submit" variant="glass" className="w-full min-h-[44px]" disabled={loading}>
                         Logga in
                       </Button>
                       
                        <div className="text-center mt-3">
                          <button
                            type="button"
                            onClick={() => setShowResetPassword(true)}
                             className="text-sm text-white no-underline"
                          >
                            Glömt lösenordet?
                          </button>
                        </div>
                       
                         {showResetPassword && !resetPasswordSent && (
                          <div ref={resetSectionRef} className="mt-4 p-3 rounded-lg text-center">
                            <Button
                              variant="glass"
                              size="sm"
                              onClick={handleResetPasswordEmail}
                              disabled={resetLoading}
                            >
                              {resetLoading ? "Skickar..." : "Återställ lösenord"}
                            </Button>
                         </div>
                        )}

                        {resetPasswordSent && (
                          <div ref={resetSectionRef} className="mt-4 p-3 rounded-lg text-center">
                            <p className="text-sm mb-3 font-medium text-white">Återställningsmail skickat!</p>
                            <div className="text-sm text-muted-foreground bg-secondary/10 p-2 rounded border-l-4 border-secondary mb-3">
                              <p className="font-medium text-white">Tips:</p>
                              <p className="text-white">Hittar du oss inte? Kolla skräpposten – vi kanske gömmer oss där</p>
                            </div>
                             <Button
                               variant="glass"
                               size="sm"
                               onClick={handleResetPasswordEmail}
                               disabled={resetLoading}
                             >
                               {resetLoading ? "Skickar..." : "Skicka igen"}
                             </Button>
                          </div>
                        )}
                      </form>
                    </div>

                   {/* Register form - always in DOM, overlay swap */}
                    <div className={isLogin ? 'absolute inset-0 opacity-0 pointer-events-none transition-none' : 'relative opacity-100 pointer-events-auto transition-none'}>
                       <form key="register-form" onSubmit={handleSubmit} className="space-y-3 md:space-y-4">
                       {/* User Role Selection - First */}
                       <div>
                         <Label className="text-white">Jag är:</Label>
                          <RadioGroup 
                            value={role} 
                            onValueChange={(value: 'job_seeker' | 'employer') => {
                              setRole(value);
                              setHasRegistered(false); // Återställ knappstatus
                              setShowResend(false); // Återställ meddelande när roll byts
                            }}
                            className="mt-2"
                          >
                           <div className="flex items-center space-x-2">
                             <RadioGroupItem value="job_seeker" id="job_seeker" />
                             <Label htmlFor="job_seeker" className="flex items-center cursor-pointer text-white">
                               <User className="h-4 w-4 mr-2" />
                               Jobbsökande
                             </Label>
                           </div>
                           <div className="flex items-center space-x-2">
                             <RadioGroupItem value="employer" id="employer" />
                             <Label htmlFor="employer" className="flex items-center cursor-pointer text-white">
                               <Building2 className="h-4 w-4 mr-2" />
                               Arbetsgivare
                              </Label>
                            </div>
                          </RadioGroup>
                        </div>

                       {/* Account Information Section */}
                        <div className="space-y-3 md:space-y-4 border-t border-white/20 pt-4">
                          {role === 'employer' && (
                            <div className="flex items-center gap-2 mb-2">
                              <User className="h-4 w-4 text-white" />
                              <Label className="text-white font-medium">Konto Info</Label>
                            </div>
                          )}

                         <div className="grid grid-cols-2 gap-2 md:gap-3">
                             <div>
                               <Label htmlFor="firstName" className="text-white">Förnamn *</Label>
                              <Input
                                id="firstName"
                                value={role === 'job_seeker' ? jobSeekerData.firstName : employerData.firstName}
                                onChange={(e) => {
                                  if (role === 'job_seeker') {
                                    setJobSeekerData(prev => ({ ...prev, firstName: e.target.value }));
                                  } else {
                                    setEmployerData(prev => ({ ...prev, firstName: e.target.value }));
                                  }
                                }}
                                required
                                className="mt-1 bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10 hover:border-white/50 md:hover:border-white/50 placeholder:text-white h-11 sm:h-9"
                              />
                            </div>
                             <div>
                               <Label htmlFor="lastName" className="text-white">Efternamn *</Label>
                              <Input
                                id="lastName"
                                value={role === 'job_seeker' ? jobSeekerData.lastName : employerData.lastName}
                                onChange={(e) => {
                                  if (role === 'job_seeker') {
                                    setJobSeekerData(prev => ({ ...prev, lastName: e.target.value }));
                                  } else {
                                    setEmployerData(prev => ({ ...prev, lastName: e.target.value }));
                                  }
                                }}
                                required
                                className="mt-1 bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10 hover:border-white/50 md:hover:border-white/50 placeholder:text-white h-11 sm:h-9"
                              />
                            </div>
                         </div>
                         
                         <div className="relative">
                            <Label htmlFor="email" className="text-white">
                              <Mail className="h-4 w-4 inline mr-2" />
                              E-post *
                            </Label>
                           <Input
                             id="email"
                             type="email"
                             value={role === 'job_seeker' ? jobSeekerData.email : employerData.email}
                             onChange={(e) => handleEmailChange(e.target.value)}
                             required
                             name="email"
                             autoComplete="email"
                             inputMode="email"
                             spellCheck={false}
                             autoCapitalize="none"
                             className="mt-1 bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10 hover:border-white/50 md:hover:border-white/50 placeholder:text-white h-11 sm:h-9"
                           />
                           {/* email suggestions removed for simpler UX */}
                         </div>
                         
                           {role === 'job_seeker' && (
                             <div>
                                <Label htmlFor="phone" className="text-white">
                                  <Phone className="h-4 w-4 inline mr-2" />
                                  Telefon *
                                </Label>
                                  <Input
                                    id="phone"
                                    type="tel"
                                    value={jobSeekerData.phone}
                                    onChange={(e) => handlePhoneChange(e.target.value)}
                                    className="mt-1 bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10 hover:border-white/50 md:hover:border-white/50 placeholder:text-white h-11 sm:h-9"
                                    placeholder="070-123 45 67"
                                    required
                                  />
                                 {jobSeekerData.phoneError && (
                                   <p className="text-destructive text-sm mt-1">{jobSeekerData.phoneError}</p>
                                 )}
                              </div>
                           )}
                       </div>

                       {/* Employer-specific fields */}
                       {role === 'employer' && (
                         <>
                            <div className="space-y-3 md:space-y-4 border-t border-white/20 pt-4">
                             <div className="flex items-center gap-2 mb-2">
                               <Building2 className="h-4 w-4 text-white" />
                               <Label className="text-white font-medium">Företagsinformation</Label>
                             </div>
                             
                              <div>
                                <Label htmlFor="companyName" className="text-white">Företagsnamn *</Label>
                                 <Input
                                   id="companyName"
                                   value={employerData.companyName}
                                   onChange={(e) => setEmployerData(prev => ({ ...prev, companyName: e.target.value }))}
                                   placeholder="Mitt företag"
                                   className="mt-1 bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10 hover:border-white/50 md:hover:border-white/50 placeholder:text-white h-11 sm:h-9"
                                   required
                                 />
                              </div>

                              <div>
                                <Label htmlFor="industry" className="text-white">Bransch *</Label>
                                <DropdownMenu modal={false} open={industryMenuOpen} onOpenChange={setIndustryMenuOpen}>
                                   <DropdownMenuTrigger asChild>
                                    <Button
                                      ref={triggerRef}
                                      variant="outline"
                                      className={`w-full bg-white/5 backdrop-blur-sm border-white/20 text-white transition-all duration-300 md:hover:bg-white/10 md:hover:border-white/50 md:hover:text-white [&_svg]:text-white md:hover:[&_svg]:text-white justify-between mt-1 text-left min-h-[44px] ${industryMenuOpen ? 'border-white/50' : ''}`}
                                    >
                                       <span className="truncate text-left flex-1 px-1">
                                         {employerData.industry || 'Välj bransch'}
                                       </span>
                                      <ChevronDown className="h-5 w-5 flex-shrink-0 opacity-50 ml-2" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                    <DropdownMenuContent 
                                     className={`w-80 bg-slate-900/85 backdrop-blur-xl border border-white/20 shadow-lg z-[9999] rounded-md text-white overflow-hidden ${isMobile ? 'max-h-[50vh]' : 'max-h-96'}`}
                                     side="bottom"
                                     align="center"
                                     alignOffset={0}
                                     sideOffset={8}
                                     avoidCollisions={false}
                                     onCloseAutoFocus={(e) => e.preventDefault()}
                                   >
                                     {/* Search input - optimized for mobile */}
                                     <div className="p-3 border-b border-white/20 sticky top-0 bg-transparent">
                                       <div className="relative">
                                       <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white" />
                                           <Input
                                            placeholder="Sök bransch..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className={`pl-10 pr-4 h-10 text-base bg-transparent border-white/20 text-white placeholder:text-white focus:border-white/40 hover:border-white/50 md:hover:border-white/50 rounded-lg`}
                                            autoComplete="off"
                                            autoCapitalize="none"
                                            autoCorrect="off"
                                            onKeyDownCapture={(e) => e.stopPropagation()}
                                            onKeyDown={(e) => e.stopPropagation()}
                                          />
                                       </div>
                                     </div>
                                    
                                     {/* Industry options - optimized for mobile scrolling */}
                                     <div className={`overflow-y-auto ${isMobile ? 'max-h-[calc(50vh-4rem)]' : 'max-h-80'} overscroll-contain`}>
                                         {SWEDISH_INDUSTRIES
                                         .filter(industryOption => 
                                              searchTerm.trim().length >= 2 ? industryOption.toLowerCase().includes(searchTerm.toLowerCase()) : true
                                            )
                                         .map((industryOption) => (
                                           <DropdownMenuItem
                                             key={industryOption}
                                             onSelect={(e) => e.preventDefault()}
                                               onClick={() => {
                                                 setEmployerData(prev => ({ ...prev, industry: industryOption }));
                                                 setSearchTerm('');
                                                 setIndustryMenuOpen(false);
                                               }}
                                              className={`cursor-pointer hover:bg-white/20 focus:bg-white/20 ${isMobile ? 'py-2 px-4 text-sm' : 'py-2 px-3'} text-white flex items-center justify-between transition-colors touch-manipulation`}
                                           >
                                             <span className="flex-1 pr-2">{industryOption}</span>
                                             {employerData.industry === industryOption && (
                                               <Check className={`${isMobile ? 'h-4 w-4' : 'h-4 w-4'} text-green-400 flex-shrink-0`} />
                                             )}
                                           </DropdownMenuItem>
                                         ))}
                                       
                                        {/* Custom value option if no matches and search term exists */}
                                         {searchTerm.trim().length >= 2 &&
                                        !SWEDISH_INDUSTRIES.some(industryOption => 
                                          industryOption.toLowerCase().includes(searchTerm.toLowerCase())
                                        ) && (
                                         <DropdownMenuItem
                                           onSelect={(e) => e.preventDefault()}
                                             onClick={() => {
                                               setEmployerData(prev => ({ ...prev, industry: searchTerm }));
                                               setSearchTerm('');
                                               setIndustryMenuOpen(false);
                                             }}
                                           className={`cursor-pointer hover:bg-white/20 focus:bg-white/20 ${isMobile ? 'py-2 px-4 text-sm' : 'py-2 px-3'} text-white border-t border-white/20 transition-colors touch-manipulation`}
                                         >
                                           <span className="flex-1">Använd "{searchTerm}"</span>
                                         </DropdownMenuItem>
                                       )}
                                       
                                        {/* Show message if no results */}
                                        {searchTerm.trim().length >= 3 && 
                                         SWEDISH_INDUSTRIES.filter(industryOption => 
                                           industryOption.toLowerCase().includes(searchTerm.toLowerCase())
                                         ).length === 0 && (
                                          <div className={`${isMobile ? 'py-4 px-4' : 'py-4 px-3'} text-center text-white`}>
                                            Inga resultat hittades för "{searchTerm}"
                                          </div>
                                        )}
                                     </div>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>

                              <div>
                                <Label htmlFor="employeeCount" className="text-white">Anställda *</Label>
                                <DropdownMenu modal={false} open={employeeMenuOpen} onOpenChange={setEmployeeMenuOpen}>
                                   <DropdownMenuTrigger asChild>
                                    <Button
                                      ref={employeeCountTriggerRef}
                                      variant="outline"
                                      className={`w-full bg-white/5 backdrop-blur-sm border-white/20 text-white transition-all duration-300 md:hover:bg-white/10 md:hover:border-white/50 md:hover:text-white [&_svg]:text-white md:hover:[&_svg]:text-white justify-between mt-1 text-left min-h-[44px] ${employeeMenuOpen ? 'border-white/50' : ''}`}
                                    >
                                       <span className="truncate text-left flex-1 px-1">
                                         {employerData.employeeCount || 'Antal'}
                                       </span>
                                      <ChevronDown className="h-5 w-5 flex-shrink-0 opacity-50 ml-2" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent 
                                    className={`w-80 bg-slate-900/85 backdrop-blur-xl border border-white/20 shadow-lg z-[9999] rounded-md text-white overflow-hidden ${isMobile ? 'max-h-[50vh]' : 'max-h-96'}`}
                                    side="bottom"
                                    align="center"
                                    alignOffset={0}
                                    sideOffset={8}
                                    avoidCollisions={false}
                                    onCloseAutoFocus={(e) => e.preventDefault()}
                                  >
                                    {/* Employee count options */}
                                    <div className={`overflow-y-auto ${isMobile ? 'max-h-[calc(50vh-4rem)]' : 'max-h-80'} overscroll-contain`}>
                                      {EMPLOYEE_COUNT_OPTIONS.map((count) => (
                                        <DropdownMenuItem
                                          key={count}
                                          onSelect={(e) => e.preventDefault()}
                                           onClick={() => {
                                             setEmployerData(prev => ({ ...prev, employeeCount: count }));
                                             setEmployeeMenuOpen(false);
                                           }}
                                          className={`cursor-pointer hover:bg-white/20 focus:bg-white/20 ${isMobile ? 'py-2 px-4 text-sm' : 'py-2 px-3'} text-white flex items-center justify-between transition-colors touch-manipulation`}
                                        >
                                          <span className="flex-1 pr-2">{count}</span>
                                          {employerData.employeeCount === count && (
                                            <Check className={`${isMobile ? 'h-4 w-4' : 'h-4 w-4'} text-green-400 flex-shrink-0`} />
                                          )}
                                        </DropdownMenuItem>
                                      ))}
                                    </div>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>

                              <div>
                                <Label htmlFor="address" className="text-white">
                                  <MapPin className="h-4 w-4 inline mr-2" />
                                  Adress *
                                </Label>
                                 <Input
                                   id="address"
                                   value={employerData.address}
                                   onChange={(e) => setEmployerData(prev => ({ ...prev, address: e.target.value }))}
                                   placeholder="Ange din adress"
                                   className="mt-1 bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10 hover:border-white/50 md:hover:border-white/50 placeholder:text-white h-11 sm:h-9"
                                   autoComplete="off"
                                   required
                                 />
                              </div>

                               <div>
                                <Label htmlFor="website" className="text-white">
                                  <Globe className="h-4 w-4 inline mr-2" />
                                  Webbplats *
                                </Label>
                                 <Input
                                   id="website"
                                   value={employerData.website}
                                   onChange={(e) => setEmployerData(prev => ({ ...prev, website: e.target.value }))}
                                   placeholder="https://exempel.se"
                                   className="mt-1 bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10 hover:border-white/50 md:hover:border-white/50 placeholder:text-white h-11 sm:h-9"
                                   required
                                 />
                              </div>

                              <div>
                                <Label htmlFor="companyDescription" className="text-white">Kort beskrivning</Label>
                                 <Textarea
                                   id="companyDescription"
                                   value={employerData.companyDescription}
                                   onChange={(e) => setEmployerData(prev => ({ ...prev, companyDescription: e.target.value }))}
                                   placeholder="Beskriv vad ert företag gör..."
                                   className="mt-1 bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10 hover:border-white/50 md:hover:border-white/50 placeholder:text-white resize-none text-base"
                                   style={{ fontSize: '16px' }}
                                   rows={2}
                                 />
                              </div>
                           </div>
                         </>
                       )}
                      <div>
                         <Label htmlFor="password" className="text-white">
                           <Key className="h-4 w-4 inline mr-2" />
                           Lösenord *
                         </Label>
                        <div className="relative mt-1">
                          <Input
                            id="password"
                            type={showPassword ? 'text' : 'password'}
                            value={role === 'job_seeker' ? jobSeekerData.password : employerData.password}
                            onChange={(e) => handlePasswordChange(e.target.value)}
                            required
                            minLength={7}
                            name={`new-password-${role}`}
                            autoComplete={`${role}-new-password`}
                             className="bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10 placeholder:text-white h-11 sm:h-9"
                          />
                           <button
                            type="button"
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-white hover:text-white transition-colors bg-transparent border-0 outline-none focus:outline-none active:bg-transparent"
                            onClick={() => setShowPassword(!showPassword)}
                            onTouchStart={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            onTouchEnd={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                        {(role === 'job_seeker' ? jobSeekerData.password : employerData.password) && (
                          <>
                            <div className="mt-2">
                              <div className="flex items-center gap-1">
                                {[...Array(5)].map((_, i) => (
                                  <div
                                    key={i}
                                    className={`h-1 flex-1 rounded ${
                                      i < passwordStrength
                                        ? passwordStrength < 3
                                          ? 'bg-destructive'
                                          : passwordStrength < 5
                                          ? 'bg-yellow-500'
                                          : 'bg-green-500'
                                        : 'bg-muted'
                                    }`}
                                  />
                                ))}
                              </div>
                              <p className="text-sm text-white mt-1">
                                {passwordStrength < 3 && 'Svagt lösenord'}
                                {passwordStrength >= 3 && passwordStrength < 5 && 'Medel lösenord'}
                                {passwordStrength >= 5 && 'Starkt lösenord'}
                              </p>
                            </div>
                            <p className="text-xs text-white mt-2">
                              Lösenordet måste vara minst 7 tecken (bokstäver, siffror eller tecken)
                            </p>
                          </>
                        )}
                      </div>

                      {(role === 'job_seeker' ? jobSeekerData.password : employerData.password) && (
                        <div>
                          <Label htmlFor="confirmPassword" className="text-white">
                            <Key className="h-4 w-4 inline mr-2" />
                            Bekräfta lösenord *
                          </Label>
                          <div className="relative mt-1">
                            <Input
                              id="confirmPassword"
                              type={showPassword ? 'text' : 'password'}
                              value={role === 'job_seeker' ? jobSeekerData.confirmPassword : employerData.confirmPassword}
                              onPaste={(e) => e.preventDefault()}
                              onCopy={(e) => e.preventDefault()}
                              onChange={(e) => {
                                if (role === 'job_seeker') {
                                  setJobSeekerData(prev => ({ ...prev, confirmPassword: e.target.value }));
                                } else {
                                  setEmployerData(prev => ({ ...prev, confirmPassword: e.target.value }));
                                }
                              }}
                              required
                              name={`confirm-password-${role}`}
                              autoComplete={`${role}-new-password`}
                              className="bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10 placeholder:text-white h-11 sm:h-9"
                            />
                            <button
                              type="button"
                              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-white hover:text-white transition-colors bg-transparent border-0 outline-none focus:outline-none active:bg-transparent"
                              onClick={() => setShowPassword(!showPassword)}
                              onTouchStart={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                              onTouchEnd={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                          {(role === 'job_seeker' ? jobSeekerData.confirmPassword : employerData.confirmPassword) && 
                           (role === 'job_seeker' ? jobSeekerData.password : employerData.password) !== 
                           (role === 'job_seeker' ? jobSeekerData.confirmPassword : employerData.confirmPassword) && (
                            <p className="text-sm text-destructive mt-1">Lösenorden matchar inte</p>
                          )}
                        </div>
                      )}
                      
                       <Button 
                         type="submit" 
                         variant="glass"
                         className={`w-full min-h-[44px] ${hasRegistered ? 'opacity-50 cursor-not-allowed' : ''}`}
                         disabled={loading || hasRegistered}
                       >
                         {loading ? "Registrerar..." : "Registrera"}
                       </Button>
                      </form>
                  </div>
                  </div>
                  </Tabs>

                {showResend && (
                  <div className="mt-4 p-4 bg-primary/10 backdrop-blur-sm border border-primary/20 rounded-lg text-center">
                    <p className="text-sm mb-3 text-white font-medium">Kolla din e-post för bekräftelselänk</p>
                    <div className="text-sm text-primary-foreground/80 bg-primary/10 p-2 rounded border-l-4 border-primary mb-3">
                      <p className="text-white">Hittar du oss inte? Kolla skräpposten – vi kanske gömmer oss där</p>
                    </div>
                    <Button
                      variant="glass"
                      size="sm"
                      onClick={handleResendConfirmation}
                      disabled={resendLoading}
                      className="min-h-[44px]"
                    >
                      {resendLoading ? "Skickar..." : "Skicka igen"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthMobile;