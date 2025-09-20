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
import { Eye, EyeOff, User, Building2, Mail, Key, Phone, Globe, MapPin, Users } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { validateSwedishPhoneNumber } from '@/lib/phoneValidation';
import { SWEDISH_INDUSTRIES, EMPLOYEE_COUNT_OPTIONS } from '@/lib/industries';

interface AuthMobileProps {
  isPasswordReset: boolean;
  newPassword: string;
  setNewPassword: (value: string) => void;
  confirmPassword: string;
  setConfirmPassword: (value: string) => void;
  handlePasswordReset: (e: React.FormEvent) => void;
  onBackToLogin?: () => void;
}

const AuthMobile = ({ 
  isPasswordReset, 
  newPassword, 
  setNewPassword, 
  confirmPassword, 
  setConfirmPassword, 
  handlePasswordReset,
  onBackToLogin
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
  
  // New employer-specific fields
  const [companyName, setCompanyName] = useState('');
  const [orgNumber, setOrgNumber] = useState('');
  const [industry, setIndustry] = useState('');
  const [address, setAddress] = useState('');
  const [website, setWebsite] = useState('');
  const [companyDescription, setCompanyDescription] = useState('');
  const [employeeCount, setEmployeeCount] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
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

  // Use centralized phone validation
  const validatePhoneNumber = (phoneNumber: string) => {
    return validateSwedishPhoneNumber(phoneNumber, false);
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
        } else {
          // Navigate to app after successful login
          navigate('/search-jobs', { replace: true });
        }
      } else {
        const result = await signUp(email, password, {
          role,
          first_name: firstName,
          last_name: lastName,
          phone: phone,
          ...(role === 'employer' && {
            company_name: companyName,
            org_number: orgNumber,
            industry: industry,
            address: address,
            website: website,
            company_description: companyDescription,
            employee_count: employeeCount
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

   const handleResetPasswordEmail = async () => {
     if (!email) {
       toast({
         title: "E-post krävs",
         description: "Ange din e-postadress först",
         variant: "destructive"
       });
       return;
     }
     setResetLoading(true);
     const result = await resetPassword(email);
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
            <div className="mb-2">
              <div className="relative mx-auto w-fit">
                <div className="absolute inset-0 blur-xl bg-secondary/30 rounded-full"></div>
                <img 
                  src="/lovable-uploads/79c2f9ec-4fa4-43c9-9177-5f0ce8b19f57.png" 
                  alt="Parium" 
                  className="relative h-32 w-auto"
                  width="320"
                  height="128"
                  loading="eager"
                  decoding="sync"
                  fetchPriority="high"
                />
              </div>
            </div>
            
            <h1 className="text-2xl font-semibold text-white mb-2">
              Välkommen till Parium
            </h1>
            <p className="text-white/90 text-base mb-4">
              Framtiden börjar med ett swipe
            </p>
          </div>

          {/* Auth form */}
          <div className="w-full max-w-sm">
            <Card className="bg-white/10 backdrop-blur-sm border-white/20 shadow-2xl rounded-2xl overflow-hidden">
              <CardContent className="p-6">
                <Tabs value={isLogin ? 'login' : 'signup'} onValueChange={(value) => setIsLogin(value === 'login')}>
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
                          value={email}
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
                            value={password}
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
                           onValueChange={(value: 'job_seeker' | 'employer') => setRole(value)}
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
                             <Label htmlFor="firstName" className="text-white">Förnamn</Label>
                             <Input
                               id="firstName"
                               value={firstName}
                               onChange={(e) => setFirstName(e.target.value)}
                               required
                               className="mt-1 bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10 placeholder:text-white/60"
                             />
                           </div>
                           <div>
                             <Label htmlFor="lastName" className="text-white">Efternamn</Label>
                             <Input
                               id="lastName"
                               value={lastName}
                               onChange={(e) => setLastName(e.target.value)}
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
                             value={email}
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
                                 Telefon (frivilligt)
                               </Label>
                                <Input
                                  id="phone"
                                  type="tel"
                                  value={phone}
                                  onChange={(e) => handlePhoneChange(e.target.value)}
                                  className="mt-1 bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10 placeholder:text-white/60"
                                  placeholder="070-123 45 67"
                                />
                               {phoneError && (
                                 <p className="text-destructive text-xs mt-1">{phoneError}</p>
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
                                 value={companyName}
                                 onChange={(e) => setCompanyName(e.target.value)}
                                 placeholder="Mitt Företag AB"
                                 className="mt-1 bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10 placeholder:text-white/60"
                                 required
                               />
                             </div>

                             <div className="grid grid-cols-2 gap-2">
                               <div>
                                 <Label htmlFor="industry" className="text-white">Bransch *</Label>
                                 <Select value={industry} onValueChange={setIndustry}>
                                   <SelectTrigger className="mt-1 bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10">
                                     <SelectValue placeholder="Välj bransch" />
                                   </SelectTrigger>
                                   <SelectContent>
                                     {SWEDISH_INDUSTRIES.map((ind) => (
                                       <SelectItem key={ind} value={ind}>
                                         {ind}
                                       </SelectItem>
                                     ))}
                                   </SelectContent>
                                 </Select>
                               </div>

                               <div>
                                 <Label htmlFor="employeeCount" className="text-white">Anställda</Label>
                                 <Select value={employeeCount} onValueChange={setEmployeeCount}>
                                   <SelectTrigger className="mt-1 bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10">
                                     <SelectValue placeholder="Antal" />
                                   </SelectTrigger>
                                   <SelectContent>
                                     {EMPLOYEE_COUNT_OPTIONS.map((count) => (
                                       <SelectItem key={count} value={count}>
                                         {count}
                                       </SelectItem>
                                     ))}
                                   </SelectContent>
                                 </Select>
                               </div>
                             </div>

                             <div>
                               <Label htmlFor="address" className="text-white">
                                 <MapPin className="h-4 w-4 inline mr-2" />
                                 Adress *
                               </Label>
                               <Input
                                 id="address"
                                 value={address}
                                 onChange={(e) => setAddress(e.target.value)}
                                 placeholder="Storgatan 1, 123 45 Stockholm"
                                 className="mt-1 bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10 placeholder:text-white/60"
                                 required
                               />
                             </div>

                             <div>
                               <Label htmlFor="website" className="text-white">
                                 <Globe className="h-4 w-4 inline mr-2" />
                                 Webbplats
                               </Label>
                               <Input
                                 id="website"
                                 value={website}
                                 onChange={(e) => setWebsite(e.target.value)}
                                 placeholder="https://exempel.se"
                                 className="mt-1 bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10 placeholder:text-white/60"
                               />
                             </div>

                             <div>
                               <Label htmlFor="companyDescription" className="text-white">Kort beskrivning</Label>
                               <Textarea
                                 id="companyDescription"
                                 value={companyDescription}
                                 onChange={(e) => setCompanyDescription(e.target.value)}
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
                          Lösenord
                        </Label>
                        <div className="relative mt-1">
                          <Input
                            id="password"
                            type={showPassword ? 'text' : 'password'}
                            value={password}
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
                      
                      <Button type="submit" className="w-full bg-parium-navy hover:bg-parium-navy/90 text-white" disabled={loading}>
                        {loading ? "Registrerar..." : "Registrera"}
                      </Button>
                    </form>
                  </TabsContent>
                </Tabs>

                {showResend && (
                  <div className="mt-4 p-4 bg-secondary/10 rounded-lg text-center border border-secondary/20">
                    <p className="text-sm mb-2 font-medium text-white">📧 Kolla din e-post för bekräftelselänk</p>
                    <div className="bg-orange-50 border border-orange-200 rounded p-2 mb-3">
                          <p className="text-xs text-white font-medium">⚠️ VIKTIGT</p>
                          <p className="text-xs text-white">Hittar du oss inte? Kolla skräpposten – vi kanske gömmer oss där.</p>
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