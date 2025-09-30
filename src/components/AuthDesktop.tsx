import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
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

interface AuthDesktopProps {
  isPasswordReset: boolean;
  newPassword: string;
  setNewPassword: (value: string) => void;
  confirmPassword: string;
  setConfirmPassword: (value: string) => void;
  handlePasswordReset: (e: React.FormEvent) => void;
  onBackToLogin?: () => void;
}

const AuthDesktop = ({ 
  isPasswordReset, 
  newPassword, 
  setNewPassword, 
  confirmPassword, 
  setConfirmPassword, 
  handlePasswordReset,
  onBackToLogin
}: AuthDesktopProps) => {
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

  const { signIn, signUp, resendConfirmation, resetPassword } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

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
        const result = await signIn(currentEmail, currentPassword);
        
        if (result.error) {
          if (result.error.code === 'email_not_confirmed') {
            setShowResend(true);
          } else if (result.error.showResetPassword) {
            setShowResetPassword(true);
          }
        } else {
          // Navigate to app after successful login
          navigate('/search-jobs', { replace: true });
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
      <div className="min-h-[calc(100vh-4rem)] bg-gradient-parium flex items-center justify-center p-4 auth-dark">
        <Card className="w-full max-w-sm bg-white/10 backdrop-blur-sm border-white/20">
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
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-parium flex flex-col relative auth-dark">
      {/* Static animated background - won't re-render */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/95 to-primary-dark"></div>
        
        {/* Soft fade at bottom to prevent hard edges */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-primary-dark via-primary-dark/80 to-transparent"></div>
        
        {/* Animated floating elements - now stable */}
        <div className="absolute top-20 left-10 w-4 h-4 bg-secondary/30 rounded-full animate-bounce" style={{ animationDuration: '2s' }}></div>
        <div className="absolute top-32 left-16 w-2 h-2 bg-accent/40 rounded-full animate-bounce" style={{ animationDuration: '2.5s' }}></div>
        <div className="absolute top-24 left-20 w-3 h-3 bg-secondary/20 rounded-full animate-bounce" style={{ animationDuration: '3s' }}></div>
        
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

      <div className="relative z-10 flex flex-col min-h-[calc(100vh-4rem)]">
        {/* Header med logo och text */}
        <div className="flex-1 flex flex-col justify-center items-center px-6 pt-12 pb-6">
          <div className="text-center mb-8">
            <div className="mb-0 -mb-8">
              <div className="relative mx-auto w-fit">
                <img 
                  src="/lovable-uploads/79c2f9ec-4fa4-43c9-9177-5f0ce8b19f57.png" 
                  alt="Parium" 
                  className="relative h-52 w-auto lg:h-60"
                  width="400"
                  height="160"
                  loading="eager"
                  decoding="sync"
                  fetchPriority="high"
                />
              </div>
            </div>
            
            <h1 className="text-2xl lg:text-3xl font-semibold text-white mb-2">
              Välkommen till Parium
            </h1>
            <p className="text-white/90 text-base lg:text-lg mb-4">
              Framtiden börjar med ett swipe
            </p>
          </div>

          {/* Auth form */}
          <div className="w-full max-w-md lg:max-w-lg">
            <Card className="bg-white/10 backdrop-blur-sm border-white/20 shadow-2xl rounded-2xl overflow-hidden">
              <CardContent className="p-6 lg:p-8">
                 <Tabs value={isLogin ? 'login' : 'signup'} onValueChange={(value) => {
                   setIsLogin(value === 'login');
                   setHasRegistered(false); // Låt upp knappen när användaren byter flik
                   setShowResend(false); // Återställ meddelande när användaren byter flik
                   clearFormData(); // Rensa all formulärdata när man växlar flik
                 }}>
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

                  <TabsContent value="login">
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
                         <div className="mt-4 p-3 rounded-lg text-center">
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
                          <div className="mt-4 p-3 rounded-lg text-center">
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
                    </TabsContent>

                  <TabsContent value="signup">
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
                                     className="w-80 bg-slate-800/95 backdrop-blur-md border-slate-600/30 shadow-xl z-50 rounded-lg text-white overflow-hidden max-h-96"
                                     side="bottom"
                                     align="center"
                                     alignOffset={0}
                                     sideOffset={8}
                                     avoidCollisions={false}
                                     onCloseAutoFocus={(e) => e.preventDefault()}
                                   >
                                     {/* Search input */}
                                     <div className="p-3 border-b border-slate-600/30 sticky top-0 bg-slate-700/95 backdrop-blur-md">
                                       <div className="relative">
                                       <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/60" />
                                          <Input
                                            placeholder="Sök bransch..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="pl-10 pr-4 h-10 bg-white/5 border-white/20 text-white placeholder:text-white/60 focus:border-white/40 rounded-lg"
                                            autoComplete="off"
                                            autoCapitalize="none"
                                            autoCorrect="off"
                                            onKeyDownCapture={(e) => e.stopPropagation()}
                                            onKeyDown={(e) => e.stopPropagation()}
                                          />
                                       </div>
                                     </div>
                                    
                                     {/* Industry options */}
                                     <div className="overflow-y-auto max-h-80 overscroll-contain">
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
                                             className="cursor-pointer hover:bg-slate-700/70 focus:bg-slate-700/70 py-2 px-3 text-white flex items-center justify-between transition-colors touch-manipulation"
                                           >
                                             <span className="flex-1 pr-2">{industryOption}</span>
                                             {employerData.industry === industryOption && (
                                               <Check className="h-4 w-4 text-green-400 flex-shrink-0" />
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
                                           className="cursor-pointer hover:bg-slate-700/70 focus:bg-slate-700/70 py-2 px-3 text-white border-t border-slate-600/30 transition-colors touch-manipulation"
                                         >
                                           <span className="flex-1">Använd "{searchTerm}"</span>
                                         </DropdownMenuItem>
                                       )}
                                       
                                       {/* Show message if no results */}
                                       {searchTerm.trim().length >= 3 && 
                                        SWEDISH_INDUSTRIES.filter(industryOption => 
                                          industryOption.toLowerCase().includes(searchTerm.toLowerCase())
                                        ).length === 0 && (
                                         <div className="py-4 px-3 text-center text-white/60 italic">
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
                                    className="w-80 bg-slate-800/95 backdrop-blur-md border-slate-600/30 shadow-xl z-50 rounded-lg text-white overflow-hidden max-h-96"
                                    side="bottom"
                                    align="center"
                                    alignOffset={0}
                                    sideOffset={8}
                                    avoidCollisions={false}
                                    onCloseAutoFocus={(e) => e.preventDefault()}
                                  >
                                    {/* Employee count options */}
                                    <div className="overflow-y-auto max-h-80 overscroll-contain">
                                      {EMPLOYEE_COUNT_OPTIONS.map((count) => (
                                        <DropdownMenuItem
                                          key={count}
                                          onSelect={(e) => e.preventDefault()}
                                           onClick={() => {
                                             setEmployerData(prev => ({ ...prev, employeeCount: count }));
                                             setEmployeeMenuOpen(false);
                                           }}
                                          className="cursor-pointer hover:bg-slate-700/70 focus:bg-slate-700/70 py-2 px-3 text-white flex items-center justify-between transition-colors touch-manipulation"
                                        >
                                          <span className="flex-1 pr-2">{count}</span>
                                          {employerData.employeeCount === count && (
                                            <Check className="h-4 w-4 text-green-400 flex-shrink-0" />
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
                  </TabsContent>
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

export default AuthDesktop;