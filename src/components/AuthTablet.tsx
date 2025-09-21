import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Eye, EyeOff, User, Building2, Mail, Key, Phone } from 'lucide-react';
import { validateSwedishPhoneNumber } from '@/lib/phoneValidation';

interface AuthTabletProps {
  isPasswordReset: boolean;
  newPassword: string;
  setNewPassword: (value: string) => void;
  confirmPassword: string;
  setConfirmPassword: (value: string) => void;
  handlePasswordReset: (e: React.FormEvent) => void;
  onBackToLogin?: () => void;
}

const AuthTablet = ({ 
  isPasswordReset, 
  newPassword, 
  setNewPassword, 
  confirmPassword, 
  setConfirmPassword, 
  handlePasswordReset,
  onBackToLogin
}: AuthTabletProps) => {
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

  // Popular email domains for suggestions
  const popularDomains = [
    '@gmail.com', '@gmail.se', '@hotmail.com', '@hotmail.se', '@outlook.com', '@outlook.se',
    '@yahoo.com', '@yahoo.se', '@icloud.com', '@live.se', '@live.com', '@telia.com'
  ];

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
          ...(role === 'job_seeker' && { phone: jobSeekerData.phone })
        });
        
        if (result.error) {
          if (result.error.isExistingUser) {
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

  if (isPasswordReset) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-gradient-parium flex items-center justify-center p-6 auth-dark">
        <Card className="w-full max-w-lg bg-white/10 backdrop-blur-sm border-white/20 shadow-2xl rounded-2xl">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-xl text-white">Nytt lösenord</CardTitle>
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
              <Button type="submit" className="w-full bg-parium-navy hover:bg-parium-navy/90 text-white" disabled={loading}>
                {loading ? "Sparar..." : "Spara nytt lösenord"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-parium flex auth-dark">
      {/* Animated background elements */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/95 to-primary-dark"></div>
        
        {/* Simplified animations for tablet */}
        <div className="absolute top-20 left-10 w-4 h-4 bg-secondary/30 rounded-full animate-bounce" style={{ animationDuration: '2s' }}></div>
        <div className="absolute bottom-40 right-20 w-5 h-5 bg-accent/30 rounded-full animate-bounce" style={{ animationDuration: '2.2s' }}></div>
        <div className="absolute top-10 right-10 w-3 h-3 bg-secondary/40 rounded-full animate-pulse" style={{ animationDuration: '1.5s' }}></div>
      </div>

      <div className="relative z-10 w-full flex items-center justify-center p-8">
        <div className="w-full max-w-2xl grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          
          {/* Left side - Compact branding */}
          <div className="text-center lg:text-left">
            <div className="mb-6">
              <div className="relative mx-auto lg:mx-0 w-fit">
                <div className="absolute inset-0 blur-xl bg-secondary/30 rounded-full"></div>
                <img 
                  src="/lovable-uploads/79c2f9ec-4fa4-43c9-9177-5f0ce8b19f57.png" 
                  alt="Parium" 
                  className="relative h-36 w-auto"
                  width="360"
                  height="144"
                  loading="eager"
                  decoding="sync"
                  fetchPriority="high"
                />
              </div>
            </div>
            
            <h1 className="text-4xl font-bold text-primary-foreground mb-4">
              Välkommen till
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-secondary to-accent block"> Parium</span>
            </h1>
            
            <p className="text-lg text-primary-foreground/90 leading-relaxed">
              Framtiden börjar med ett swipe
            </p>
          </div>

          {/* Right side - Auth form */}
          <div className="w-full">
            <div className="relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-secondary/20 to-accent/20 rounded-2xl blur-lg"></div>
              
              <Card className="relative bg-white/10 backdrop-blur-sm border-white/20 shadow-xl rounded-2xl">
                <CardContent className="p-6">
                   <Tabs value={isLogin ? 'login' : 'signup'} onValueChange={(value) => {
                     setIsLogin(value === 'login');
                     setHasRegistered(false); // Låt upp knappen när användaren byter flik
                     setShowResend(false); // Återställ meddelande när användaren byter flik
                   }}>
                    <TabsList className="grid w-full grid-cols-2 mb-6 bg-transparent border-0">
                      <TabsTrigger 
                        value="login" 
                        className="text-white data-[state=active]:bg-parium-navy data-[state=active]:text-white"
                      >
                        Logga in
                      </TabsTrigger>
                      <TabsTrigger 
                        value="signup"
                        className="text-white data-[state=active]:bg-parium-navy data-[state=active]:text-white"
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
                            name="email"
                            autoComplete="email"
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
                              name="current-password"
                              autoComplete="current-password"
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
                        
                        {showResetPassword && !resetPasswordSent && (
                          <div className="mt-4 p-3 rounded-lg text-center">
                            <p className="text-sm mb-2 text-white">Glömt lösenordet?</p>
                            <Button
                              className="bg-primary hover:bg-primary/90 text-primary-foreground"
                              size="sm"
                              onClick={handleResetPassword}
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
                              onClick={handleResetPassword}
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
                             className="mt-2 grid grid-cols-2 gap-4"
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

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label htmlFor="firstName" className="text-white">Förnamn</Label>
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
                            <Label htmlFor="lastName" className="text-white">Efternamn</Label>
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
                            E-post
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
                              Telefon
                            </Label>
                            <Input
                              id="phone"
                              type="tel"
                              value={jobSeekerData.phone}
                              onChange={(e) => handlePhoneChange(e.target.value)}
                              className="mt-1 bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10 placeholder:text-white/60"
                              placeholder="070-123 45 67"
                            />
                            {jobSeekerData.phoneError && (
                              <p className="text-destructive text-xs mt-1">{jobSeekerData.phoneError}</p>
                            )}
                          </div>
                        )}
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
                              name="new-password"
                              autoComplete="new-password"
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
    </div>
  );
};

export default AuthTablet;