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

interface AuthDesktopProps {
  isPasswordReset: boolean;
  newPassword: string;
  setNewPassword: (value: string) => void;
  confirmPassword: string;
  setConfirmPassword: (value: string) => void;
  handlePasswordReset: (e: React.FormEvent) => void;
}

const AuthDesktop = ({ 
  isPasswordReset, 
  newPassword, 
  setNewPassword, 
  confirmPassword, 
  setConfirmPassword, 
  handlePasswordReset 
}: AuthDesktopProps) => {
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
    '@bredband2.com', '@comhem.se', '@me.com', '@msn.com', '@aol.com', '@protonmail.com', '@yandex.com', '@mail.ru'
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
    
    const cleaned = phoneNumber.replace(/[^\\d+]/g, '');
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
          // If user already exists, suggest switching to login
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
      <div className="min-h-screen bg-gradient-parium flex items-center justify-center p-8">
        <Card className="w-full max-w-md bg-background/80 backdrop-blur-2xl border border-white/10 shadow-2xl rounded-3xl">
          <CardHeader className="text-center">
            <img 
              src="/lovable-uploads/79c2f9ec-4fa4-43c9-9177-5f0ce8b19f57.png" 
              alt="Parium" 
              className="h-16 w-auto mx-auto mb-6"
            />
            <CardTitle className="text-2xl">Återställ lösenord</CardTitle>
            <CardDescription>Ange ditt nya lösenord</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordReset} className="space-y-6">
              <div>
                <Label htmlFor="newPassword">Nytt lösenord</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  className="mt-2"
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
                  className="mt-2"
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
    <div className="relative min-h-screen bg-gradient-parium overflow-hidden">
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
      
      <div className="relative z-10 min-h-screen flex">
        {/* Left side - Hero content */}
        <div className="w-1/2 flex flex-col justify-center px-12 text-primary-foreground">
          <div className="max-w-lg animate-fade-in">
            {/* Logo with glow effect */}
            <div className="mb-8">
              <div className="relative">
                <div className="absolute inset-0 blur-2xl bg-secondary/30 rounded-full"></div>
                <img 
                  src="/lovable-uploads/79c2f9ec-4fa4-43c9-9177-5f0ce8b19f57.png" 
                  alt="Parium" 
                  className="relative h-16 w-auto"
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
        <div className="w-1/2 flex items-center justify-center p-12">
          <div className="w-full max-w-md animate-scale-in">
            {/* Glassmorphism card */}
            <div className="relative">
              {/* Card glow effect */}
              <div className="absolute -inset-1 bg-gradient-to-r from-secondary/20 to-accent/20 rounded-3xl blur-lg"></div>
              
              <Card className="relative bg-background/80 backdrop-blur-2xl border border-white/10 shadow-2xl rounded-3xl overflow-hidden">
                <CardContent className="p-12">
                  <div className="text-center mb-8">
                    <h2 className="text-3xl font-bold text-primary-foreground mb-2">
                      {isLogin ? 'Välkommen tillbaka' : 'Skapa konto'}
                    </h2>
                    <p className="text-primary-foreground/80">
                      {isLogin ? 'Logga in för att fortsätta' : 'Börja din resa mot drömjobbet'}
                    </p>
                  </div>
                  
                  <Tabs value={isLogin ? 'login' : 'signup'} onValueChange={(value) => setIsLogin(value === 'login')}>
                    <TabsList className="grid w-full grid-cols-2 mb-8">
                      <TabsTrigger value="login" className="text-lg font-medium">{isLogin ? 'Logga in' : 'Har konto?'}</TabsTrigger>
                      <TabsTrigger value="signup" className="text-lg font-medium">{!isLogin ? 'Registrera' : 'Skapa konto'}</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="login">
                      <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                          <Label htmlFor="email" className="text-lg">E-post</Label>
                          <div className="relative">
                            <Input
                              id="email"
                              type="email"
                              value={email}
                              onChange={(e) => handleEmailChange(e.target.value)}
                              required
                              className="mt-2 w-full"
                            />
                            {showEmailSuggestions && emailSuggestions.length > 0 && (
                              <div className="absolute left-0 mt-1 w-full bg-background border border-input rounded-md shadow-sm z-10">
                                {emailSuggestions.map((suggestion, index) => (
                                  <div
                                    key={index}
                                    className="px-4 py-2 text-sm text-primary-foreground hover:bg-secondary/50 cursor-pointer"
                                    onClick={() => {
                                      setEmail(suggestion);
                                      setShowEmailSuggestions(false);
                                    }}
                                  >
                                    {suggestion}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="password" className="text-lg">Lösenord</Label>
                          <div className="relative">
                            <Input
                              id="password"
                              type={showPassword ? 'text' : 'password'}
                              value={password}
                              onChange={(e) => handlePasswordChange(e.target.value)}
                              required
                              className="mt-2 w-full"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-2 top-1/2 -translate-y-1/2 h-auto p-1"
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
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="firstName" className="text-lg">Förnamn</Label>
                            <Input
                              id="firstName"
                              value={firstName}
                              onChange={(e) => setFirstName(e.target.value)}
                              required
                              className="mt-2"
                            />
                          </div>
                          <div>
                            <Label htmlFor="lastName" className="text-lg">Efternamn</Label>
                            <Input
                              id="lastName"
                              value={lastName}
                              onChange={(e) => setLastName(e.target.value)}
                              required
                              className="mt-2"
                            />
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="email" className="text-lg">E-post</Label>
                          <div className="relative">
                            <Input
                              id="email"
                              type="email"
                              value={email}
                              onChange={(e) => handleEmailChange(e.target.value)}
                              required
                              className="mt-2 w-full"
                            />
                            {showEmailSuggestions && emailSuggestions.length > 0 && (
                              <div className="absolute left-0 mt-1 w-full bg-background border border-input rounded-md shadow-sm z-10">
                                {emailSuggestions.map((suggestion, index) => (
                                  <div
                                    key={index}
                                    className="px-4 py-2 text-sm text-primary-foreground hover:bg-secondary/50 cursor-pointer"
                                    onClick={() => {
                                      setEmail(suggestion);
                                      setShowEmailSuggestions(false);
                                    }}
                                  >
                                    {suggestion}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="phone" className="text-lg">Telefon</Label>
                          <Input
                            id="phone"
                            type="tel"
                            value={phone}
                            onChange={(e) => handlePhoneChange(e.target.value)}
                            className="mt-2"
                          />
                          {phoneError && <p className="text-red-500 text-sm mt-1">{phoneError}</p>}
                        </div>
                        <div>
                          <Label htmlFor="password" className="text-lg">Lösenord</Label>
                          <div className="relative">
                            <Input
                              id="password"
                              type={showPassword ? 'text' : 'password'}
                              value={password}
                              onChange={(e) => handlePasswordChange(e.target.value)}
                              required
                              className="mt-2 w-full"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-2 top-1/2 -translate-y-1/2 h-auto p-1"
                              onClick={() => setShowPassword(!showPassword)}
                            >
                              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                            </Button>
                          </div>
                          <div className="mt-2">
                            <div className="flex items-center space-x-2">
                              <span className="text-sm text-primary-foreground/80">Lösenordsstyrka:</span>
                              <div className="relative w-full bg-secondary/20 rounded-full h-2">
                                <div
                                  className="absolute left-0 top-0 h-full bg-gradient-to-r from-secondary to-accent rounded-full"
                                  style={{ width: `${(passwordStrength / 5) * 100}%` }}
                                ></div>
                              </div>
                            </div>
                            <ul className="mt-1 list-disc list-inside text-sm text-primary-foreground/60">
                              <li>Minst 8 tecken</li>
                              <li>En stor bokstav</li>
                              <li>En liten bokstav</li>
                              <li>En siffra</li>
                              <li>Ett specialtecken</li>
                            </ul>
                          </div>
                        </div>
                        
                        <div>
                          <Label className="text-lg">Jag är:</Label>
                          <RadioGroup 
                            value={role} 
                            onValueChange={(value: 'job_seeker' | 'employer') => setRole(value)}
                            className="mt-2"
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="job_seeker" id="job_seeker" />
                              <Label htmlFor="job_seeker" className="flex items-center cursor-pointer">
                                <User className="h-5 w-5 mr-2" />
                                Jobbsökande
                              </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="employer" id="employer" />
                              <Label htmlFor="employer" className="flex items-center cursor-pointer">
                                <Building2 className="h-5 w-5 mr-2" />
                                Arbetsgivare
                              </Label>
                            </div>
                          </RadioGroup>
                        </div>
                        
                        <Button type="submit" className="w-full py-3 text-lg" disabled={loading}>
                          {loading ? 'Registrerar...' : 'Registrera'}
                        </Button>
                      </form>
                    </TabsContent>
                  </Tabs>
                  
                  {showResend && (
                    <div className="mt-6 p-4 bg-secondary/10 rounded-lg text-center">
                      <p className="text-sm mb-2">Kolla din e-post för bekräftelselänk</p>
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

                  {showResetPassword && !resetPasswordSent && (
                    <div className="mt-6 p-4 bg-muted/50 rounded-lg text-center">
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
                    <div className="mt-6 p-4 bg-muted/50 rounded-lg text-center">
                      <p className="text-sm mb-3 font-medium">📧 Återställningsmail skickat!</p>
                      <div className="text-xs text-muted-foreground bg-secondary/10 p-2 rounded border-l-4 border-secondary">
                        <p className="font-medium">💡 Tips:</p>
                        <p className="mt-1">Kolla din skräppost om du inte ser mailet inom några minuter.</p>
                        <p>Hittar du oss inte? Kolla skräpposten – vi kanske gömmer oss där.</p>
                      </div>
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
