import { useState, useRef, useEffect, startTransition } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Eye, EyeOff, User, Building2, Mail, Key, Phone, Globe, MapPin, Users, ChevronDown, Search, Check } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import { validateSwedishPhoneNumber } from '@/lib/phoneValidation';
import { SWEDISH_INDUSTRIES, EMPLOYEE_COUNT_OPTIONS } from '@/lib/industries';
import { useIsMobile } from '@/hooks/use-mobile';
import { searchAddresses } from '@/lib/addressSearch';
import { cn } from '@/lib/utils';

interface AuthMobileProps {
  isPasswordReset: boolean;
  newPassword: string;
  setNewPassword: (value: string) => void;
  confirmPassword: string;
  setConfirmPassword: (value: string) => void;
  handlePasswordReset: (e: React.FormEvent) => void;
  onBackToLogin?: () => void;
  onAuthModeChange?: (isLogin: boolean) => void;
}

const AuthMobile = ({ 
  isPasswordReset, 
  newPassword, 
  setNewPassword, 
  confirmPassword, 
  setConfirmPassword, 
  handlePasswordReset,
  onBackToLogin,
  onAuthModeChange
}: AuthMobileProps) => {
  const [emailSuggestions, setEmailSuggestions] = useState<string[]>([]);
  const [showEmailSuggestions, setShowEmailSuggestions] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const isMobile = useIsMobile();
  const [searchTerm, setSearchTerm] = useState('');
  // Separate form data for each role
  const [jobSeekerData, setJobSeekerData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    phoneError: '',
    email: '',
    password: ''
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
    password: ''
  });
  const [role, setRole] = useState<'job_seeker' | 'employer'>('job_seeker');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [showResend, setShowResend] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetPasswordSent, setResetPasswordSent] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [hasRegistered, setHasRegistered] = useState(false);

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

  // Handle input focus - scroll into view when keyboard opens
  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setTimeout(() => {
      e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300); // Give keyboard time to appear
  };

  // Handle scroll-lock directly for instant response
  const handleTabChange = (value: string) => {
    const newIsLogin = value === 'login';
    if (newIsLogin === isLogin) return; // avoid redundant work

    // Save scroll state of the tab we are leaving
    if (!isLogin && typeof window !== 'undefined') {
      signupScrollRef.current = window.scrollY || 0;
    }

    onAuthModeChange?.(newIsLogin);

    // Immediate visual swap and reset transient states
    setIsLogin(newIsLogin);
    setHasRegistered(false);
    setShowResend(false);
    setShowResetPassword(false);
    setResetPasswordSent(false);

    // Restore independent scroll positions
    try { (document.activeElement as HTMLElement | null)?.blur?.(); } catch {}
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (typeof window !== 'undefined') {
          const targetTop = newIsLogin ? 0 : (signupScrollRef.current || 0);
          window.scrollTo({ top: targetTop, left: 0, behavior: 'auto' });
        }
      });
    });

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
    const validation = validatePhoneNumber(value);
    setJobSeekerData(prev => ({
      ...prev,
      phone: value,
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
      password: ''
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
      password: ''
    });
    setShowPassword(false);
    setPasswordStrength(0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
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
        // Network-safe sign in with timeout fallback
        const signInPromise = signIn(currentEmail, currentPassword);
        const timeoutPromise = (new Promise((resolve) =>
          setTimeout(() => resolve({ error: { code: 'timeout', message: 'timeout' } }), 5000)
        )) as Promise<{ error?: any }>;

        const result = await Promise.race([signInPromise, timeoutPromise]);
        
        if (result?.error) {
          if (result.error.code === 'timeout') {
            toast({
              title: 'Nätverksproblem',
              description: 'Inloggningen tog för lång tid. Kontrollera uppkopplingen och försök igen.',
              variant: 'default'
            });
          } else if (result.error.code === 'email_not_confirmed') {
            setShowResend(true);
          } else if (result.error.showResetPassword) {
            setShowResetPassword(true);
          }
        } else {
          // Lyckad inloggning – navigera direkt så Index hanterar resten
          navigate('/', { replace: true });
        }
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
        className="bg-gradient-parium overflow-y-auto p-4 py-8 auth-dark flex flex-col" 
        style={{ 
          WebkitOverflowScrolling: 'touch', 
          touchAction: 'pan-y',
          minHeight: 'calc(100dvh + env(safe-area-inset-bottom, 0px))',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)'
        }}
      >
        <Card 
          className="w-full max-w-sm bg-white/10 backdrop-blur-sm border-white/20 my-auto mx-auto overflow-y-auto" 
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
            <form onSubmit={handlePasswordReset} className="space-y-4">
              <div>
                <Label htmlFor="newPassword" className="text-white">Nytt lösenord</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  className="bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10 placeholder:text-white/60"
                />
              </div>
              <div>
                <Label htmlFor="confirmPassword" className="text-white">Bekräfta lösenord</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10 placeholder:text-white/60"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
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
      className="bg-gradient-parium flex flex-col relative auth-dark" 
      style={{ 
        WebkitOverflowScrolling: 'touch', 
        touchAction: 'pan-y',
        minHeight: '100svh',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)'
      }}
    >
      {/* Static animated background - won't re-render */}
      <div className="fixed inset-0 pointer-events-none z-0">

        {/* Animated floating elements - now stable */}
        <div className="absolute top-20 left-10 w-4 h-4 bg-secondary/30 rounded-full animate-bounce" style={{ animationDuration: '2s' }}></div>
        <div className="absolute top-32 left-16 w-2 h-2 bg-accent/40 rounded-full animate-bounce" style={{ animationDuration: '2.5s' }}></div>
        <div className="absolute top-24 left-20 w-3 h-3 bg-secondary/20 rounded-full animate-bounce" style={{ animationDuration: '3s' }}></div>
        
        {/* Decorative glow effect in bottom right corner */}
        <div className="absolute -right-32 w-96 h-96 pointer-events-none pwa-bottom-glow">
          <div className="absolute inset-0 bg-primary-glow/40 rounded-full blur-[120px]"></div>
          <div className="absolute inset-4 bg-primary-glow/30 rounded-full blur-[100px]"></div>
          <div className="absolute inset-8 bg-primary-glow/25 rounded-full blur-[80px]"></div>
        </div>
        
        <div className="absolute bottom-40 right-20 w-5 h-5 bg-accent/30 rounded-full animate-bounce" style={{ animationDuration: '2.2s' }}></div>
        <div className="absolute bottom-32 right-16 w-3 h-3 bg-secondary/25 rounded-full animate-bounce" style={{ animationDuration: '2.8s' }}></div>
        <div className="absolute bottom-36 right-24 w-2 h-2 bg-accent/35 rounded-full animate-bounce" style={{ animationDuration: '2.3s' }}></div>
        
        {/* Pulsing lights */}
        <div className="absolute top-10 right-10 w-3 h-3 bg-secondary/40 rounded-full animate-pulse" style={{ animationDuration: '1.5s' }}></div>
        <div className="absolute top-16 right-20 w-2 h-2 bg-accent/30 rounded-full animate-pulse" style={{ animationDuration: '2s' }}></div>
        <div className="absolute top-12 left-8 w-3 h-3 bg-accent/40 rounded-full animate-pulse" style={{ animationDuration: '1.8s' }}></div>
        
        {/* Small stars */}
        <div className="absolute top-1/4 left-1/3 w-1 h-1 bg-accent/60 rounded-full animate-pulse" style={{ animationDuration: '3s' }}>
          <div className="absolute inset-0 bg-accent/40 rounded-full animate-ping" style={{ animationDuration: '3s' }}></div>
        </div>
        <div className="absolute top-1/3 right-1/3 w-1 h-1 bg-secondary/60 rounded-full animate-pulse" style={{ animationDuration: '2.5s' }}>
          <div className="absolute inset-0 bg-secondary/40 rounded-full animate-ping" style={{ animationDuration: '2.5s' }}></div>
        </div>
      </div>

      <div 
        ref={containerRef} 
        className="relative z-10 flex flex-col min-h-screen"
        style={{ 
          paddingTop: 'env(safe-area-inset-top)', 
          paddingBottom: 'env(safe-area-inset-bottom)',
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
                  <div className="w-64 h-44 bg-primary-glow/25 rounded-full blur-[40px]"></div>
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
                <img 
                  src="/lovable-uploads/79c2f9ec-4fa4-43c9-9177-5f0ce8b19f57.png" 
                  alt="Parium" 
                  className="relative h-40 w-auto scale-125 will-change-transform"
                  width="400"
                  height="160"
                  loading="eager"
                  decoding="sync"
                  
                />
              </div>
            </div>
            
            <h1 className="text-2xl font-semibold text-white mb-2 relative z-10 [color:rgb(255,255,255)] drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]">
              Framtiden börjar med ett swipe
            </h1>
          </div>

          {/* Auth form */}
          <div className="w-full max-w-sm overscroll-contain">
            <Card 
              className="bg-white/10 backdrop-blur-sm border-white/20 shadow-2xl rounded-2xl overflow-hidden"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              <CardContent className={cn("p-6", isLogin && (showResetPassword || resetPasswordSent) && "pb-24")}>
                 <Tabs value={isLogin ? 'login' : 'signup'} onValueChange={handleTabChange}>
                  <TabsList className="grid w-full grid-cols-2 mb-6 bg-transparent border-0 p-0 h-auto gap-2">
                    <TabsTrigger 
                      value="login" 
                      className="text-white data-[state=active]:bg-parium-navy data-[state=active]:text-white rounded-md font-medium"
                    >
                      Logga in
                    </TabsTrigger>
                    <TabsTrigger 
                      value="signup"
                      className="text-white data-[state=active]:bg-parium-navy data-[state=active]:text-white rounded-md font-medium"
                    >
                      Registrera
                    </TabsTrigger>
                  </TabsList>

                  {/* Forms wrapper for instant swap */}
                  <div className="relative">
                    {/* Login form - always in DOM, overlay swap */}
                    <div className={isLogin ? 'relative opacity-100 pointer-events-auto transition-none' : 'absolute inset-0 opacity-0 pointer-events-none transition-none'}>
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="relative">
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
                          className="mt-1 bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10 placeholder:text-white/60"
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
                            className="bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10 placeholder:text-white/60"
                          />
                          <button
                            type="button"
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-white/70 hover:text-white transition-colors"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                       <Button type="submit" className="w-full bg-parium-navy hover:bg-parium-navy/90 text-white" disabled={loading}>
                         {loading ? "Loggar in..." : "Logga in"}
                       </Button>
                       
                       <div className="text-center mt-3">
                         <button
                           type="button"
                           onClick={() => setShowResetPassword(true)}
                            className="text-sm text-white hover:underline"
                         >
                           Glömt lösenordet?
                         </button>
                       </div>
                       
                         {showResetPassword && !resetPasswordSent && (
                          <div ref={resetSectionRef} className="mt-4 p-3 rounded-lg text-center">
                            <Button
                              className="bg-primary hover:bg-primary/90 text-primary-foreground"
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
                            <div className="text-xs text-muted-foreground bg-secondary/10 p-2 rounded border-l-4 border-secondary mb-3">
                              <p className="font-medium text-white">Tips:</p>
                              <p className="text-white">Hittar du oss inte? Kolla skräpposten – vi kanske gömmer oss där</p>
                            </div>
                             <Button
                               size="sm"
                               onClick={handleResetPasswordEmail}
                               disabled={resetLoading}
                               className="bg-parium-navy hover:bg-parium-navy/90 text-white text-xs"
                             >
                               {resetLoading ? "Skickar..." : "Skicka igen"}
                             </Button>
                          </div>
                        )}
                      </form>
                    </div>

                   {/* Register form - always in DOM, overlay swap */}
                    <div className={isLogin ? 'absolute inset-0 opacity-0 pointer-events-none transition-none' : 'relative opacity-100 pointer-events-auto transition-none'}>
                       <form onSubmit={handleSubmit} className="space-y-4">
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
                        <div className="space-y-4 border-t border-white/20 pt-4">
                          {role === 'employer' && (
                            <div className="flex items-center gap-2 mb-2">
                              <User className="h-4 w-4 text-white" />
                              <Label className="text-white font-medium">Konto Info</Label>
                            </div>
                          )}

                         <div className="grid grid-cols-2 gap-2">
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
                                className="mt-1 bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10 placeholder:text-white/60"
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
                                className="mt-1 bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10 placeholder:text-white/60"
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
                             className="mt-1 bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10 placeholder:text-white/60"
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
                                    className="mt-1 bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10 placeholder:text-white/60"
                                    placeholder="070-123 45 67"
                                    required
                                  />
                                 {jobSeekerData.phoneError && (
                                   <p className="text-destructive text-xs mt-1">{jobSeekerData.phoneError}</p>
                                 )}
                              </div>
                           )}
                       </div>

                       {/* Employer-specific fields */}
                       {role === 'employer' && (
                         <>
                           <div className="space-y-4 border-t border-white/20 pt-4">
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
                                   className="mt-1 bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10 placeholder:text-white/60"
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
                                      className="w-full bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10 transition-colors justify-between mt-1 text-left"
                                    >
                                       <span className="truncate text-left flex-1 px-1">
                                         {employerData.industry || 'Välj bransch'}
                                       </span>
                                      <ChevronDown className="h-5 w-5 flex-shrink-0 opacity-50 ml-2" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                    <DropdownMenuContent 
                                     className={`w-80 bg-slate-800/95 backdrop-blur-md border-slate-600/30 shadow-xl z-50 rounded-lg text-white overflow-hidden ${isMobile ? 'max-h-[50vh]' : 'max-h-96'}`}
                                     side="bottom"
                                     align="center"
                                     alignOffset={0}
                                     sideOffset={8}
                                     avoidCollisions={false}
                                     onCloseAutoFocus={(e) => e.preventDefault()}
                                   >
                                     {/* Search input - optimized for mobile */}
                                     <div className="p-3 border-b border-slate-600/30 sticky top-0 bg-slate-700/95 backdrop-blur-md">
                                       <div className="relative">
                                       <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/60" />
                                           <Input
                                            placeholder="Sök bransch..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className={`pl-10 pr-4 h-10 text-base bg-white/5 border-white/20 text-white placeholder:text-white/60 focus:border-white/40 rounded-lg`}
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
                                             className={`cursor-pointer hover:bg-slate-700/70 focus:bg-slate-700/70 ${isMobile ? 'py-2 px-4 text-sm' : 'py-2 px-3'} text-white flex items-center justify-between transition-colors touch-manipulation`}
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
                                           className={`cursor-pointer hover:bg-slate-700/70 focus:bg-slate-700/70 ${isMobile ? 'py-2 px-4 text-sm' : 'py-2 px-3'} text-white border-t border-slate-600/30 transition-colors touch-manipulation`}
                                         >
                                           <span className="flex-1">Använd "{searchTerm}"</span>
                                         </DropdownMenuItem>
                                       )}
                                       
                                       {/* Show message if no results */}
                                       {searchTerm.trim().length >= 3 && 
                                        SWEDISH_INDUSTRIES.filter(industryOption => 
                                          industryOption.toLowerCase().includes(searchTerm.toLowerCase())
                                        ).length === 0 && (
                                         <div className={`${isMobile ? 'py-4 px-4' : 'py-4 px-3'} text-center text-white/60 italic`}>
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
                                      className="w-full bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10 transition-colors justify-between mt-1 text-left"
                                    >
                                       <span className="truncate text-left flex-1 px-1">
                                         {employerData.employeeCount || 'Antal'}
                                       </span>
                                      <ChevronDown className="h-5 w-5 flex-shrink-0 opacity-50 ml-2" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent 
                                    className={`w-80 bg-slate-800/95 backdrop-blur-md border-slate-600/30 shadow-xl z-50 rounded-lg text-white overflow-hidden ${isMobile ? 'max-h-[50vh]' : 'max-h-96'}`}
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
                                          className={`cursor-pointer hover:bg-slate-700/70 focus:bg-slate-700/70 ${isMobile ? 'py-2 px-4 text-sm' : 'py-2 px-3'} text-white flex items-center justify-between transition-colors touch-manipulation`}
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
                                   className="mt-1 bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10 placeholder:text-white/60"
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
                                   className="mt-1 bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10 placeholder:text-white/60"
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
                                  className="mt-1 bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10 placeholder:text-white/60 resize-none"
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
                            name={`new-password-${role}`}
                            autoComplete={`${role}-new-password`}
                            className="bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10 placeholder:text-white/60"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-2 top-1/2 -translate-y-1/2 h-auto p-1 text-white hover:text-white/80"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                        {(role === 'job_seeker' ? jobSeekerData.password : employerData.password) && (
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
                            <p className="text-xs text-muted-foreground mt-1">
                              {passwordStrength < 3 && 'Svagt lösenord'}
                              {passwordStrength >= 3 && passwordStrength < 5 && 'Medel lösenord'}
                              {passwordStrength >= 5 && 'Starkt lösenord'}
                            </p>
                          </div>
                        )}
                      </div>
                      
                       <Button 
                         type="submit" 
                         className={`w-full bg-parium-navy hover:bg-parium-navy/90 text-white ${hasRegistered ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                    <div className="text-xs text-primary-foreground/80 bg-primary/10 p-2 rounded border-l-4 border-primary mb-3">
                      <p className="text-white">Hittar du oss inte? Kolla skräpposten – vi kanske gömmer oss där</p>
                    </div>
                    <Button
                      className="bg-parium-navy hover:bg-parium-navy/90 text-white"
                      size="sm"
                      onClick={handleResendConfirmation}
                      disabled={resendLoading}
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