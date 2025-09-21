import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Mail, Key, Users, Target, Zap, Eye, EyeOff, User, Building2, Phone } from 'lucide-react';
import phoneWithPariumLogo from '@/assets/phone-with-parium-logo.jpg';
import { validateSwedishPhoneNumber } from '@/lib/phoneValidation';

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
    company: '',
    jobTitle: '',
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

  const { signIn, signUp, resendConfirmation, resetPassword } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Popular email domains for suggestions (Swedish and international)
  const popularDomains = [
    '@gmail.com', '@gmail.se', '@hotmail.com', '@hotmail.se', '@outlook.com', '@outlook.se',
    '@yahoo.com', '@yahoo.se', '@icloud.com', '@live.se', '@live.com', '@telia.com', '@spray.se',
    '@bredband2.com', '@comhem.se', '@me.com', '@msn.com', '@aol.com', '@protonmail.com', '@yandex.com', '@mail.ru'
  ];

  // Handle email input with suggestions
  const handleEmailChange = (value: string) => {
    const currentData = role === 'job_seeker' ? jobSeekerData : employerData;
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
        const result = await signUp(currentEmail, currentPassword, {
          role,
          first_name: currentData.firstName,
          last_name: currentData.lastName,
          ...(role === 'job_seeker' && { phone: jobSeekerData.phone }),
          ...(role === 'employer' && { 
            company: employerData.company,
            job_title: employerData.jobTitle
          })
        });
        
        if (result.error) {
          // If user already exists, suggest switching to login
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

   const handleResetPassword = async () => {
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
      <div className="min-h-[calc(100vh-4rem)] bg-gradient-parium flex items-center justify-center p-8 auth-dark">
        <Card className="w-full max-w-md bg-white/10 backdrop-blur-sm border-white/20 shadow-2xl rounded-3xl">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl text-white">Nytt lösenord</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordReset} className="space-y-6">
              <div>
                <Label htmlFor="newPassword" className="text-white">Nytt lösenord</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  className="mt-2 bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10 placeholder:text-white/60"
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
                  className="mt-2 bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10 placeholder:text-white/60"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Sparar..." : "Spara nytt lösenord"}
              </Button>
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => (onBackToLogin ? onBackToLogin() : navigate('/auth'))}
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
    <div className="relative min-h-[calc(100vh-4rem)] bg-gradient-parium overflow-hidden auth-dark">
      {/* Modern animated mobile background */}
      <div className="absolute inset-0">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-30 animate-pulse"
          style={{ backgroundImage: `url(${phoneWithPariumLogo})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/95 to-primary-dark"></div>
        
        <ul className="circles">
          <li></li>
          <li></li>
          <li></li>
          <li></li>
          <li></li>
          <li></li>
          <li></li>
          <li></li>
          <li></li>
          <li></li>
        </ul>
      </div>
      
      <div className="relative z-10 min-h-[calc(100vh-4rem)] flex">
        {/* Left side - Hero content */}
        <div className="hidden">
          <div className="max-w-lg animate-fade-in">
            {/* Logo with glow effect */}
            <div className="mb-8">
              <div className="relative">
                <div className="absolute inset-0 blur-2xl bg-secondary/30 rounded-full"></div>
                <img 
                  src="/lovable-uploads/79c2f9ec-4fa4-43c9-9177-5f0ce8b19f57.png" 
                  alt="Parium" 
                  className="relative h-24 w-auto"
                  width="320"
                  height="96"
                  loading="eager"
                  decoding="sync"
                  fetchPriority="high"
                />
              </div>
            </div>
            
            <h1 className="text-6xl font-bold mb-6 leading-tight tracking-tight">
              Hitta din perfekta
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-secondary to-accent ml-2"> jobbmatch</span>
            </h1>
            
            <div className="mb-8 flex justify-center">
              <div className="space-y-4">
                <div className="flex items-center text-primary-foreground/90">
                  <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                    <div className="w-2 h-2 bg-secondary rounded-full"></div>
                  </div>
                  <span className="text-lg ml-3">Smart matchmaking</span>
                </div>
                <div className="flex items-center text-primary-foreground/90">
                  <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                    <div className="w-2 h-2 bg-accent rounded-full"></div>
                  </div>
                  <span className="text-lg ml-3">Direktkontakt med företag</span>
                </div>
                <div className="flex items-center text-primary-foreground/90">
                  <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                    <div className="w-2 h-2 bg-secondary rounded-full"></div>
                  </div>
                  <span className="text-lg ml-3">Snabb ansökningsprocess</span>
                </div>
              </div>
            </div>
            
            <p className="text-xl mb-12 text-primary-foreground/90 leading-relaxed">
              Parium revolutionerar rekrytering genom AI-driven matchmaking. 
              Upptäck karriärmöjligheter som är skapade för just dig.
            </p>
            
            <div className="space-y-6">
              <div className="flex items-center gap-4 group">
                <div className="bg-gradient-to-r from-secondary/20 to-accent/20 p-3 rounded-2xl group-hover:scale-110 transition-transform duration-300">
                  <Target className="h-6 w-6 text-secondary" />
                </div>
                <span className="text-primary-foreground/90 text-lg">AI-driven precision matching</span>
              </div>
              <div className="flex items-center gap-4 group">
                <div className="bg-gradient-to-r from-secondary/20 to-accent/20 p-3 rounded-2xl group-hover:scale-110 transition-transform duration-300">
                  <Users className="h-6 w-6 text-secondary" />
                </div>
                <span className="text-primary-foreground/90 text-lg">Direct access to decision makers</span>
              </div>
              <div className="flex items-center gap-4 group">
                <div className="bg-gradient-to-r from-secondary/20 to-accent/20 p-3 rounded-2xl group-hover:scale-110 transition-transform duration-300">
                  <Zap className="h-6 w-6 text-secondary" />
                </div>
                <span className="text-primary-foreground/90 text-lg">Lightning-fast recruitment process</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Right side - Modern Auth form */}
        <div className="w-full flex items-center justify-center p-12">
          <div className="w-full max-w-md animate-scale-in">
            <div className="text-center mb-8">
              <div className="mb-2">
                <div className="relative mx-auto w-fit">
                  <div className="absolute inset-0 blur-xl bg-secondary/30 rounded-full"></div>
                  <img 
                    src="/lovable-uploads/79c2f9ec-4fa4-43c9-9177-5f0ce8b19f57.png" 
                    alt="Parium" 
                    className="relative h-24 w-auto"
                    width="320"
                    height="128"
                    loading="eager"
                    decoding="sync"
                    fetchPriority="high"
                  />
                </div>
              </div>
              <h1 className="text-3xl font-bold text-white mb-2">Välkommen till Parium</h1>
              <p className="text-white/80">Framtiden börjar med ett swipe</p>
            </div>
            {/* Glassmorphism card */}
            <div className="relative">
              {/* Card glow effect */}
              <div className="absolute -inset-1 bg-gradient-to-r from-secondary/20 to-accent/20 rounded-3xl blur-lg"></div>
              
              <Card className="relative bg-white/10 backdrop-blur-sm border-white/20 shadow-2xl rounded-3xl overflow-hidden">
                <CardContent className="p-12">
                   <Tabs value={isLogin ? 'login' : 'signup'} onValueChange={(value) => {
                     setIsLogin(value === 'login');
                     setHasRegistered(false); // Låt upp knappen när användaren byter flik
                     setShowResend(false); // Återställ meddelande när användaren byter flik
                   }}>
                    <TabsList className="grid w-full grid-cols-2 mb-8 bg-transparent border-0 p-0 h-auto gap-2">
                      <TabsTrigger 
                        value="login" 
                        className="text-white data-[state=active]:bg-parium-navy data-[state=active]:text-white rounded-md font-medium text-lg"
                      >
                        Logga in
                      </TabsTrigger>
                      <TabsTrigger 
                        value="signup"
                        className="text-white data-[state=active]:bg-parium-navy data-[state=active]:text-white rounded-md font-medium text-lg"
                      >
                        Registrera
                      </TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="login">
                      <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                          <Label htmlFor="email" className="text-lg text-white">E-post</Label>
                          <div className="relative">
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
                              className="mt-2 w-full bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10 placeholder:text-white/60"
                            />
                            {/* email suggestions removed for simpler UX */}
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="password" className="text-lg text-white">Lösenord</Label>
                          <div className="relative">
                            <Input
                              id="password"
                              type={showPassword ? 'text' : 'password'}
                              value={role === 'job_seeker' ? jobSeekerData.password : employerData.password}
                              onChange={(e) => handlePasswordChange(e.target.value)}
                              required
                              name={`password-${role}`}
                              autoComplete={`${role}-current-password`}
                              className="mt-2 w-full bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10 placeholder:text-white/60"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-2 top-1/2 -translate-y-1/2 h-auto p-1 text-white hover:text-white/80"
                              onClick={() => setShowPassword(!showPassword)}
                            >
                              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                            </Button>
                          </div>
                        </div>
                        <Button type="submit" className="w-full py-3 text-lg" disabled={loading}>
                          {loading ? 'Loggar in...' : 'Logga in'}
                        </Button>
                      </form>
                    </TabsContent>
                    
                    <TabsContent value="signup">
                      <form onSubmit={handleSubmit} className="space-y-6">
                        {/* User Role Selection - First */}
                        <div>
                          <Label className="text-lg text-white">Jag är:</Label>
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
                                <User className="h-5 w-5 mr-2" />
                                Jobbsökande
                              </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="employer" id="employer" />
                              <Label htmlFor="employer" className="flex items-center cursor-pointer text-white">
                                <Building2 className="h-5 w-5 mr-2" />
                                Arbetsgivare
                              </Label>
                            </div>
                          </RadioGroup>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="firstName" className="text-lg text-white">Förnamn</Label>
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
                              className="mt-2 bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10 placeholder:text-white/60"
                            />
                          </div>
                          <div>
                            <Label htmlFor="lastName" className="text-lg text-white">Efternamn</Label>
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
                              className="mt-2 bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10 placeholder:text-white/60"
                            />
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="email" className="text-lg text-white">E-post</Label>
                          <div className="relative">
                            <Input
                              id="email"
                              type="email"
                              value={role === 'job_seeker' ? jobSeekerData.email : employerData.email}
                              onChange={(e) => handleEmailChange(e.target.value)}
                              required
                              className="mt-2 w-full bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10 placeholder:text-white/60"
                            />
                            {/* email suggestions removed for simpler UX */}
                          </div>
                        </div>
                        {role === 'job_seeker' && (
                          <div>
                            <Label htmlFor="phone" className="text-lg text-white">Telefon</Label>
                            <Input
                              id="phone"
                              type="tel"
                              value={jobSeekerData.phone}
                              onChange={(e) => handlePhoneChange(e.target.value)}
                              className="mt-2 bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10 placeholder:text-white/60"
                            />
                            {jobSeekerData.phoneError && <p className="text-red-500 text-sm mt-1">{jobSeekerData.phoneError}</p>}
                          </div>
                        )}
                        
                        {role === 'employer' && (
                          <>
                            <div>
                              <Label htmlFor="company" className="text-lg text-white">Företag</Label>
                              <Input
                                id="company"
                                value={employerData.company}
                                onChange={(e) => setEmployerData(prev => ({ ...prev, company: e.target.value }))}
                                className="mt-2 bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10 placeholder:text-white/60"
                              />
                            </div>
                            <div>
                              <Label htmlFor="jobTitle" className="text-lg text-white">Befattning</Label>
                              <Input
                                id="jobTitle"
                                value={employerData.jobTitle}
                                onChange={(e) => setEmployerData(prev => ({ ...prev, jobTitle: e.target.value }))}
                                className="mt-2 bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10 placeholder:text-white/60"
                              />
                            </div>
                          </>
                        )}
                        <div>
                          <Label htmlFor="password" className="text-lg text-white">Lösenord</Label>
                          <div className="relative">
                            <Input
                                id="password"
                                type={showPassword ? 'text' : 'password'}
                                value={role === 'job_seeker' ? jobSeekerData.password : employerData.password}
                                onChange={(e) => handlePasswordChange(e.target.value)}
                                required
                              name={`new-password-${role}`}
                              autoComplete={`${role}-new-password`}
                                className="mt-2 w-full bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10 placeholder:text-white/60"
                              />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-2 top-1/2 -translate-y-1/2 h-auto p-1 text-white hover:text-white/80"
                              onClick={() => setShowPassword(!showPassword)}
                            >
                              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                            </Button>
                          </div>
                          <div className="mt-2">
                            <div className="flex items-center space-x-2">
                              <span className="text-sm text-white/80">Lösenordsstyrka:</span>
                              <div className="relative w-full bg-secondary/20 rounded-full h-2">
                                <div
                                  className="absolute left-0 top-0 h-full bg-gradient-to-r from-secondary to-accent rounded-full"
                                  style={{ width: `${(passwordStrength / 5) * 100}%` }}
                                ></div>
                              </div>
                            </div>
                            <ul className="mt-1 list-disc list-inside text-sm text-white/60">
                              <li>Minst 8 tecken</li>
                              <li>En stor bokstav</li>
                              <li>En liten bokstav</li>
                              <li>En siffra</li>
                              <li>Ett specialtecken</li>
                            </ul>
                          </div>
                        </div>
                        
                         <Button 
                           type="submit" 
                           className={`w-full py-3 text-lg ${hasRegistered ? 'opacity-50 cursor-not-allowed' : ''}`}
                           disabled={loading || hasRegistered}
                         >
                           {loading ? 'Registrerar...' : 'Registrera'}
                         </Button>
                      </form>
                    </TabsContent>
                  </Tabs>
                  
                  {showResend && (
                    <div className="mt-6 p-4 bg-primary/10 backdrop-blur-sm border border-primary/20 rounded-lg text-center">
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

                  {showResetPassword && !resetPasswordSent && (
                    <div className="mt-6 p-4 rounded-lg text-center">
                      <p className="text-sm mb-2 text-white">Glömt lösenordet?</p>
                       <Button
                         className="bg-primary hover:bg-primary/90 text-primary-foreground"
                         size="sm"
                         onClick={handleResetPassword}
                         disabled={resetLoading}
                       >
                         {resetLoading ? 'Skickar...' : 'Återställ lösenord'}
                       </Button>
                    </div>
                  )}

                  {resetPasswordSent && (
                    <div className="mt-6 p-4 rounded-lg text-center">
                      <p className="text-sm mb-3 font-medium text-white">Återställningsmail skickat!</p>
                      <div className="text-xs text-muted-foreground bg-secondary/10 p-2 rounded border-l-4 border-secondary mb-3">
                        <p className="font-medium text-white">Tips:</p>
                        <p className="text-white">Hittar du oss inte? Kolla skräpposten – vi kanske gömmer oss där</p>
                      </div>
                      <Button
                        size="sm"
                        onClick={handleResetPassword}
                        disabled={resetLoading}
                        className="bg-parium-navy hover:bg-parium-navy/90 text-white text-xs"
                      >
                        {resetLoading ? "Skickar..." : "Skicka igen"}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthDesktop;
