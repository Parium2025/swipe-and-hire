import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Eye, EyeOff, User, Building2, Mail, Key, Phone } from 'lucide-react';

interface AuthMobileProps {
  isPasswordReset: boolean;
  newPassword: string;
  setNewPassword: (value: string) => void;
  confirmPassword: string;
  setConfirmPassword: (value: string) => void;
  handlePasswordReset: (e: React.FormEvent) => void;
}

const AuthMobile = ({ 
  isPasswordReset, 
  newPassword, 
  setNewPassword, 
  confirmPassword, 
  setConfirmPassword, 
  handlePasswordReset 
}: AuthMobileProps) => {
  const [emailSuggestions, setEmailSuggestions] = useState<string[]>([]);
  const [showEmailSuggestions, setShowEmailSuggestions] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [company, setCompany] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [role, setRole] = useState<'job_seeker' | 'employer'>('job_seeker');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showResend, setShowResend] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetPasswordSent, setResetPasswordSent] = useState(false);

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
    setEmail(value);
    
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

  // Smart phone validation for Swedish numbers
  const validatePhoneNumber = (phoneNumber: string) => {
    if (!phoneNumber.trim()) return { isValid: true, error: '' };
    
    const cleaned = phoneNumber.replace(/[^\d+]/g, '');
    let isSwedish = false;
    let digitsOnly = '';
    
    if (cleaned.startsWith('+46')) {
      isSwedish = true;
      digitsOnly = cleaned.substring(3);
    } else if (cleaned.startsWith('0046')) {
      isSwedish = true;
      digitsOnly = cleaned.substring(4);
    } else if (cleaned.startsWith('0')) {
      isSwedish = true;
      digitsOnly = cleaned.substring(1);
    } else if (cleaned.match(/^\d+$/)) {
      if (cleaned.length >= 9 && cleaned.length <= 11) {
        isSwedish = true;
        digitsOnly = cleaned.startsWith('0') ? cleaned.substring(1) : cleaned;
      }
    }
    
    if (isSwedish) {
      if (digitsOnly.length !== 9) {
        return {
          isValid: false,
          error: `Svenska telefonnummer ska ha 10 siffror (du har ${digitsOnly.length + 1})`
        };
      }
    }
    
    return { isValid: true, error: '' };
  };

  const handlePhoneChange = (value: string) => {
    setPhone(value);
    const validation = validatePhoneNumber(value);
    setPhoneError(validation.error);
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
    setPassword(newPassword);
    setPasswordStrength(calculatePasswordStrength(newPassword));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setShowResend(false);
    setShowResetPassword(false);
    setResetPasswordSent(false);

    try {
      if (isLogin) {
        const result = await signIn(email, password);
        
        if (result.error) {
          if (result.error.code === 'email_not_confirmed') {
            setShowResend(true);
          } else if (result.error.showResetPassword) {
            setShowResetPassword(true);
          }
        }
      } else {
        const result = await signUp(email, password, {
          role,
          first_name: firstName,
          last_name: lastName,
          phone: phone
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
        }
      }
    } catch (error) {
      console.error('Auth error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    if (!email) return;
    setLoading(true);
    await resendConfirmation(email);
    setLoading(false);
  };

  const handleResetPassword = async () => {
    if (!email) {
      toast({
        title: "E-post krävs",
        description: "Ange din e-postadress först",
        variant: "destructive"
      });
      return;
    }
    setLoading(true);
    const result = await resetPassword(email);
    if (!result.error) {
      setResetPasswordSent(true);
    }
    setLoading(false);
  };

  if (isPasswordReset) {
    return (
      <div className="min-h-screen bg-gradient-parium flex items-center justify-center p-4">
        <Card className="w-full max-w-sm bg-background/95 backdrop-blur-sm">
          <CardHeader className="text-center">
            <img 
              src="/lovable-uploads/79c2f9ec-4fa4-43c9-9177-5f0ce8b19f57.png" 
              alt="Parium" 
              className="h-12 w-auto mx-auto mb-4"
            />
            <CardTitle>Nytt lösenord</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordReset} className="space-y-4">
              <div>
                <Label htmlFor="newPassword">Nytt lösenord</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="confirmPassword">Bekräfta lösenord</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Sparar...' : 'Spara nytt lösenord'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-parium flex flex-col relative">
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

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Header med logo och text */}
        <div className="flex-1 flex flex-col justify-center items-center px-6 pt-12 pb-6">
          <div className="text-center mb-8">
            <div className="mb-2">
              <div className="relative mx-auto w-fit">
                <div className="absolute inset-0 blur-xl bg-secondary/30 rounded-full"></div>
                <img 
                  src="/lovable-uploads/79c2f9ec-4fa4-43c9-9177-5f0ce8b19f57.png" 
                  alt="Parium" 
                  className="relative h-20 w-auto"
                />
              </div>
            </div>
            
            <h1 className="text-3xl font-bold text-primary-foreground mb-2">
              Välkommen till Parium
            </h1>
            <p className="text-primary-foreground/80 text-lg mb-8">
              Framtiden börjar med ett swipe
            </p>
          </div>

          {/* Auth form */}
          <div className="w-full max-w-sm">
            <Card className="bg-background/95 backdrop-blur-xl border-0 shadow-2xl rounded-2xl overflow-hidden">
              <CardContent className="p-6">
                <Tabs value={isLogin ? 'login' : 'signup'} onValueChange={(value) => setIsLogin(value === 'login')}>
                  <TabsList className="grid w-full grid-cols-2 mb-6 bg-muted/80 border border-border/20 rounded-lg p-1">
                    <TabsTrigger 
                      value="login" 
                      className="data-[state=active]:bg-parium-navy data-[state=active]:text-white rounded-md bg-muted-foreground/20 text-foreground font-medium"
                    >
                      Logga in
                    </TabsTrigger>
                    <TabsTrigger 
                      value="signup"
                      className="data-[state=active]:bg-parium-navy data-[state=active]:text-white rounded-md bg-muted-foreground/20 text-foreground font-medium"
                    >
                      Registrera
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="login">
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="relative">
                        <Label htmlFor="email">
                          <Mail className="h-4 w-4 inline mr-2" />
                          E-post
                        </Label>
                        <Input
                          id="email"
                          type="email"
                          value={email}
                          onChange={(e) => handleEmailChange(e.target.value)}
                          required
                          className="mt-1"
                        />
                        {showEmailSuggestions && emailSuggestions.length > 0 && (
                          <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-40 overflow-y-auto">
                            {emailSuggestions.slice(0, 5).map((suggestion, index) => (
                              <button
                                key={index}
                                type="button"
                                className="w-full px-3 py-2 text-left hover:bg-muted text-sm"
                                onClick={() => {
                                  setEmail(suggestion);
                                  setShowEmailSuggestions(false);
                                }}
                              >
                                {suggestion}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div>
                        <Label htmlFor="password">
                          <Key className="h-4 w-4 inline mr-2" />
                          Lösenord
                        </Label>
                        <div className="relative mt-1">
                          <Input
                            id="password"
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => handlePasswordChange(e.target.value)}
                            required
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-2 top-1/2 -translate-y-1/2 h-auto p-1"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                      <Button type="submit" className="w-full bg-parium-navy hover:bg-parium-navy/90 text-white" disabled={loading}>
                        {loading ? 'Loggar in...' : 'Logga in'}
                      </Button>
                      
                      {showResetPassword && !resetPasswordSent && (
                        <div className="mt-4 p-3 bg-muted/50 rounded-lg text-center">
                          <p className="text-sm mb-2">Glömt lösenordet?</p>
                          <Button
                            className="bg-primary hover:bg-primary/90 text-primary-foreground"
                            size="sm"
                            onClick={handleResetPassword}
                            disabled={loading}
                          >
                            Återställ lösenord
                          </Button>
                        </div>
                      )}

                      {resetPasswordSent && (
                        <div className="mt-4 p-3 bg-muted/50 rounded-lg text-center">
                          <p className="text-sm mb-3 font-medium">📧 Återställningsmail skickat!</p>
                          <div className="text-xs text-muted-foreground bg-secondary/10 p-2 rounded border-l-4 border-secondary">
                            <p className="font-medium">💡 Tips:</p>
                            <p>Hittar du oss inte? Kolla skräpposten – vi kanske gömmer oss där.</p>
                          </div>
                        </div>
                      )}
                    </form>
                  </TabsContent>

                  <TabsContent value="signup">
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label htmlFor="firstName">Förnamn</Label>
                          <Input
                            id="firstName"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            required
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="lastName">Efternamn</Label>
                          <Input
                            id="lastName"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            required
                            className="mt-1"
                          />
                        </div>
                      </div>
                      <div className="relative">
                        <Label htmlFor="email">
                          <Mail className="h-4 w-4 inline mr-2" />
                          E-post
                        </Label>
                        <Input
                          id="email"
                          type="email"
                          value={email}
                          onChange={(e) => handleEmailChange(e.target.value)}
                          required
                          className="mt-1"
                        />
                        {showEmailSuggestions && emailSuggestions.length > 0 && (
                          <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-40 overflow-y-auto">
                            {emailSuggestions.slice(0, 5).map((suggestion, index) => (
                              <button
                                key={index}
                                type="button"
                                className="w-full px-3 py-2 text-left hover:bg-muted text-sm"
                                onClick={() => {
                                  setEmail(suggestion);
                                  setShowEmailSuggestions(false);
                                }}
                              >
                                {suggestion}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div>
                        <Label htmlFor="phone">
                          <Phone className="h-4 w-4 inline mr-2" />
                          Telefon
                        </Label>
                         <Input
                           id="phone"
                           type="tel"
                           value={phone}
                           onChange={(e) => handlePhoneChange(e.target.value)}
                           className="mt-1"
                           placeholder="070-123 45 67"
                           required
                         />
                        {phoneError && (
                          <p className="text-destructive text-xs mt-1">{phoneError}</p>
                        )}
                      </div>
                      <div>
                        <Label htmlFor="password">
                          <Key className="h-4 w-4 inline mr-2" />
                          Lösenord
                        </Label>
                        <div className="relative mt-1">
                          <Input
                            id="password"
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => handlePasswordChange(e.target.value)}
                            required
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-2 top-1/2 -translate-y-1/2 h-auto p-1"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                        {password && (
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
                      <div>
                        <Label>Jag är:</Label>
                        <RadioGroup 
                          value={role} 
                          onValueChange={(value: 'job_seeker' | 'employer') => setRole(value)}
                          className="mt-2"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="job_seeker" id="job_seeker" />
                            <Label htmlFor="job_seeker" className="flex items-center cursor-pointer">
                              <User className="h-4 w-4 mr-2" />
                              Jobbsökande
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="employer" id="employer" />
                            <Label htmlFor="employer" className="flex items-center cursor-pointer">
                              <Building2 className="h-4 w-4 mr-2" />
                              Arbetsgivare
                             </Label>
                           </div>
                         </RadioGroup>
                       </div>
                      
                      <Button type="submit" className="w-full bg-parium-navy hover:bg-parium-navy/90 text-white" disabled={loading}>
                        {loading ? 'Registrerar...' : 'Registrera'}
                      </Button>
                    </form>
                  </TabsContent>
                </Tabs>

                {showResend && (
                  <div className="mt-4 p-4 bg-secondary/10 rounded-lg text-center border border-secondary/20">
                    <p className="text-sm mb-2 font-medium">📧 Kolla din e-post för bekräftelselänk</p>
                    <div className="bg-orange-50 border border-orange-200 rounded p-2 mb-3">
                      <p className="text-xs text-orange-800 font-medium">⚠️ VIKTIGT</p>
                      <p className="text-xs text-orange-700">Hittar du oss inte? Kolla skräpposten – vi kanske gömmer oss där.</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleResendConfirmation}
                      disabled={loading}
                    >
                      Skicka igen
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