import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { useEffect } from 'react';
import { Mail, Key, Linkedin, Users, Target, Zap } from 'lucide-react';
import modernMobileBg from '@/assets/modern-mobile-bg.jpg';
import AnimatedIntro from '@/components/AnimatedIntro';

const Auth = () => {
  const [showIntro, setShowIntro] = useState(true);
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState<'job_seeker' | 'employer'>('job_seeker');
  const [loading, setLoading] = useState(false);
  const [showResend, setShowResend] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [isPasswordReset, setIsPasswordReset] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const { signIn, signUp, signInWithLinkedIn, user, resendConfirmation, resetPassword, updatePassword } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    // Check if this is a password reset URL first
    const isReset = searchParams.get('reset') === 'true';
    setIsPasswordReset(isReset);
    
    // Only redirect logged-in users if it's NOT a password reset
    if (user && !isReset) {
      navigate('/');
    }
  }, [user, navigate, searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Reset states
    setShowResend(false);
    setShowResetPassword(false);

    try {
      if (isLogin) {
        const result = await signIn(email, password);
        
        if (result.error) {
          // Specific handling for different error types
          if (result.error.code === 'email_not_confirmed') {
            setShowResend(true);
          } else if (result.error.message === 'Invalid login credentials') {
            // For invalid credentials, show reset password option
            setShowResetPassword(true);
          }
        }
      } else {
        const result = await signUp(email, password, {
          role,
          first_name: firstName,
          last_name: lastName
        });
        
        // Only show resend if signup was successful (no error)
        if (!result.error) {
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

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      alert('Lösenorden matchar inte');
      return;
    }
    
    if (newPassword.length < 6) {
      alert('Lösenordet måste vara minst 6 tecken långt');
      return;
    }
    
    setLoading(true);
    const result = await updatePassword(newPassword);
    
    if (!result.error) {
      navigate('/');
    }
    
    setLoading(false);
  };

  const handleLinkedInLogin = async () => {
    setLoading(true);
    await signInWithLinkedIn();
    setLoading(false);
  };


  return (
    <div className="min-h-screen bg-background">
      {showIntro ? (
        <AnimatedIntro onComplete={() => setShowIntro(false)} />
      ) : (
        <>
          {/* Hero Section */}
          <div className="relative min-h-screen bg-gradient-parium overflow-hidden">
            {/* Modern animated mobile background */}
            <div className="absolute inset-0">
              <div 
                className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-30 animate-pulse"
                style={{ backgroundImage: `url(${modernMobileBg})` }}
              />
              <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/95 to-primary-dark"></div>
              
              {/* Blinkande ljus - högra hörnet */}
              <div className="absolute top-10 right-10 w-3 h-3 bg-secondary/40 rounded-full animate-pulse" style={{ animationDuration: '1.5s', animationIterationCount: 'infinite' }}></div>
              <div className="absolute top-16 right-20 w-2 h-2 bg-accent/30 rounded-full animate-pulse" style={{ animationDuration: '2s', animationIterationCount: 'infinite', animationDelay: '0.5s' }}></div>
              
              {/* Blinkande ljus - vänstra hörnet */}
              <div className="absolute top-12 left-8 w-3 h-3 bg-accent/40 rounded-full animate-pulse" style={{ animationDuration: '1.8s', animationIterationCount: 'infinite' }}></div>
              <div className="absolute top-6 left-16 w-2 h-2 bg-secondary/30 rounded-full animate-pulse" style={{ animationDuration: '2.2s', animationIterationCount: 'infinite', animationDelay: '0.7s' }}></div>
              
              {/* Små stjärnor */}
              <div className="absolute top-1/4 left-1/3 w-1 h-1 bg-accent/60 rounded-full animate-pulse" style={{ animationDuration: '3s', animationIterationCount: 'infinite' }}>
                <div className="absolute inset-0 bg-accent/40 rounded-full animate-ping" style={{ animationDuration: '3s', animationIterationCount: 'infinite' }}></div>
              </div>
              <div className="absolute top-1/3 right-1/3 w-1 h-1 bg-secondary/60 rounded-full animate-pulse" style={{ animationDuration: '2.5s', animationIterationCount: 'infinite', animationDelay: '1s' }}>
                <div className="absolute inset-0 bg-secondary/40 rounded-full animate-ping" style={{ animationDuration: '2.5s', animationIterationCount: 'infinite', animationDelay: '1s' }}></div>
              </div>
              <div className="absolute bottom-1/4 left-1/4 w-1 h-1 bg-accent/50 rounded-full animate-pulse" style={{ animationDuration: '4s', animationIterationCount: 'infinite', animationDelay: '2s' }}>
                <div className="absolute inset-0 bg-accent/30 rounded-full animate-ping" style={{ animationDuration: '4s', animationIterationCount: 'infinite', animationDelay: '2s' }}></div>
              </div>
              
              {/* Animated floating elements representing mobile interaction */}
              <div className="absolute top-20 left-10 w-4 h-4 bg-secondary/30 rounded-full animate-bounce" style={{ animationDuration: '2s', animationIterationCount: 'infinite' }}></div>
              <div className="absolute top-32 left-16 w-2 h-2 bg-accent/40 rounded-full animate-bounce" style={{ animationDuration: '2.5s', animationIterationCount: 'infinite', animationDelay: '0.5s' }}></div>
              <div className="absolute top-24 left-20 w-3 h-3 bg-secondary/20 rounded-full animate-bounce" style={{ animationDuration: '3s', animationIterationCount: 'infinite', animationDelay: '1s' }}></div>
              
              <div className="absolute bottom-40 right-20 w-5 h-5 bg-accent/30 rounded-full animate-bounce" style={{ animationDuration: '2.2s', animationIterationCount: 'infinite', animationDelay: '1.5s' }}></div>
              <div className="absolute bottom-32 right-16 w-3 h-3 bg-secondary/25 rounded-full animate-bounce" style={{ animationDuration: '2.8s', animationIterationCount: 'infinite', animationDelay: '2s' }}></div>
              <div className="absolute bottom-36 right-24 w-2 h-2 bg-accent/35 rounded-full animate-bounce" style={{ animationDuration: '2.3s', animationIterationCount: 'infinite', animationDelay: '2.5s' }}></div>
              
              {/* Swipe gesture indicators */}
              <div className="absolute top-1/2 left-1/4 w-8 h-1 bg-gradient-to-r from-transparent via-secondary/40 to-transparent animate-pulse transform rotate-45" style={{ animationDuration: '3s', animationIterationCount: 'infinite', animationDelay: '0.3s' }}></div>
              <div className="absolute top-1/2 right-1/4 w-8 h-1 bg-gradient-to-r from-transparent via-accent/40 to-transparent animate-pulse transform -rotate-45" style={{ animationDuration: '4s', animationIterationCount: 'infinite', animationDelay: '1.3s' }}></div>
            </div>
            
            <div className="relative z-10 min-h-screen flex">
              {/* Left side - Hero content */}
              <div className="hidden lg:flex lg:w-1/2 flex-col justify-center px-12 text-primary-foreground">
                <div className="max-w-lg animate-fade-in">
                  {/* Logo with glow effect */}
                  <div className="mb-8">
                    <div className="relative">
                      <div className="absolute inset-0 blur-2xl bg-secondary/30 rounded-full"></div>
                      <img 
                        src="/lovable-uploads/3e52da4e-167e-4ebf-acfb-6a70a68cfaef.png" 
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
              <div className="w-full lg:w-1/2 flex items-center justify-center p-4 lg:p-12">
                <div className="w-full max-w-md animate-scale-in">
                  {/* Glassmorphism card */}
                  <div className="relative">
                    {/* Card glow effect */}
                    <div className="absolute -inset-1 bg-gradient-to-r from-secondary/20 to-accent/20 rounded-3xl blur-lg"></div>
                    
                    <Card className="relative bg-background/80 backdrop-blur-2xl border border-white/10 shadow-2xl rounded-3xl overflow-hidden">
                      {/* Header with modern gradient */}
                      <div className="relative bg-gradient-to-r from-secondary/5 to-accent/5 border-b border-white/10">
                        <CardHeader className="text-center pb-6 pt-8">
                          <div className="mb-6">
                            <div className="relative mx-auto w-fit">
                              <div className="absolute inset-0 blur-xl bg-secondary/20 rounded-full"></div>
                              <img 
                                src="/lovable-uploads/3e52da4e-167e-4ebf-acfb-6a70a68cfaef.png" 
                                alt="Parium" 
                                className="relative h-14 w-auto"
                              />
                            </div>
                          </div>
                          
                          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
                            Välkommen till 
                            <span className="inline-block ml-1">
                              <span className="inline-block opacity-0 animate-fade-in" style={{ animationDelay: '0.1s', animationFillMode: 'forwards' }}>P</span>
                              <span className="inline-block opacity-0 animate-fade-in" style={{ animationDelay: '0.2s', animationFillMode: 'forwards' }}>a</span>
                              <span className="inline-block opacity-0 animate-fade-in" style={{ animationDelay: '0.3s', animationFillMode: 'forwards' }}>r</span>
                              <span className="inline-block opacity-0 animate-fade-in" style={{ animationDelay: '0.4s', animationFillMode: 'forwards' }}>i</span>
                              <span className="inline-block opacity-0 animate-fade-in" style={{ animationDelay: '0.5s', animationFillMode: 'forwards' }}>u</span>
                              <span className="inline-block opacity-0 animate-fade-in" style={{ animationDelay: '0.6s', animationFillMode: 'forwards' }}>m</span>
                            </span>
                          </CardTitle>
                          
                          <CardDescription className="text-muted-foreground/80 text-lg mt-2">
                            {isPasswordReset ? 'Återställ ditt lösenord' : 'Din framtid väntar på dig'}
                          </CardDescription>
                        </CardHeader>
                      </div>
                  <CardContent className="p-8 pt-6">
                    {isPasswordReset ? (
                      // Password Reset Form
                      <div className="space-y-4">
                        <div className="text-center mb-6">
                          <h3 className="text-lg font-semibold">Återställ ditt lösenord</h3>
                          <p className="text-sm text-muted-foreground">
                            Ange ditt nya lösenord nedan
                          </p>
                        </div>
                        
                        <form onSubmit={handlePasswordReset} className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="newPassword">Nytt lösenord</Label>
                            <Input
                              id="newPassword"
                              type="password"
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              required
                              minLength={6}
                              placeholder="Minst 6 tecken"
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label htmlFor="confirmPassword">Bekräfta lösenord</Label>
                            <Input
                              id="confirmPassword"
                              type="password"
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              required
                              minLength={6}
                              placeholder="Ange lösenordet igen"
                            />
                          </div>
                          
                          <Button 
                            type="submit" 
                            className="w-full" 
                            disabled={loading}
                          >
                            {loading ? 'Uppdaterar...' : 'Uppdatera lösenord'}
                          </Button>
                        </form>
                      </div>
                    ) : (
                      // Normal Login/Signup Forms
                      <>
                        {/* LinkedIn Login Button */}
                        <div className="mb-6">
                          <Button 
                            onClick={handleLinkedInLogin}
                            variant="outline"
                            className="w-full flex items-center gap-3 py-6 bg-[#0077B5] hover:bg-[#0066A3] text-white border-[#0077B5] hover:border-[#0066A3] transition-all duration-200"
                            disabled={loading}
                          >
                            <Linkedin className="h-5 w-5" />
                            {loading ? 'Ansluter...' : 'Fortsätt med LinkedIn'}
                          </Button>
                          
                          <div className="relative my-6">
                            <div className="absolute inset-0 flex items-center">
                              <div className="w-full h-px bg-gradient-to-r from-transparent via-border/50 to-transparent"></div>
                            </div>
                            <div className="relative flex justify-center">
                              <span className="bg-background/80 backdrop-blur-sm px-4 py-1 text-xs uppercase text-muted-foreground/70 rounded-full border border-border/20">
                                Eller med e-post
                              </span>
                            </div>
                          </div>
                        </div>

                        <Tabs value={isLogin ? 'login' : 'signup'} className="w-full">
                          <TabsList className="grid w-full grid-cols-2 mb-6">
                            <TabsTrigger 
                              value="login" 
                              onClick={() => setIsLogin(true)}
                              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                            >
                              Logga in
                            </TabsTrigger>
                            <TabsTrigger 
                              value="signup" 
                              onClick={() => setIsLogin(false)}
                              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                            >
                              Registrera
                            </TabsTrigger>
                          </TabsList>
                          
                          <TabsContent value="login">
                            <form onSubmit={handleSubmit} className="space-y-4">
                              <div className="space-y-2">
                                <Label htmlFor="email">E-post</Label>
                                <Input
                                  id="email"
                                  type="email"
                                  value={email}
                                  onChange={(e) => setEmail(e.target.value)}
                                  required
                                  className="transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="password">Lösenord</Label>
                                <Input
                                  id="password"
                                  type="password"
                                  value={password}
                                  onChange={(e) => setPassword(e.target.value)}
                                  required
                                  className="transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                                />
                              </div>
                              <Button 
                                type="submit" 
                                className="w-full py-6 bg-primary hover:bg-primary/90 transition-all duration-200" 
                                disabled={loading}
                              >
                                {loading ? 'Loggar in...' : 'Logga in'}
                              </Button>
                            </form>
                          </TabsContent>
                          
                          <TabsContent value="signup">
                            <form onSubmit={handleSubmit} className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label htmlFor="firstName">Förnamn</Label>
                                  <Input
                                    id="firstName"
                                    value={firstName}
                                    onChange={(e) => setFirstName(e.target.value)}
                                    required
                                    className="transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="lastName">Efternamn</Label>
                                  <Input
                                    id="lastName"
                                    value={lastName}
                                    onChange={(e) => setLastName(e.target.value)}
                                    required
                                    className="transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                                  />
                                </div>
                              </div>
                              
                              <div className="space-y-2">
                                <Label htmlFor="signup-email">E-post</Label>
                                <Input
                                  id="signup-email"
                                  type="email"
                                  value={email}
                                  onChange={(e) => setEmail(e.target.value)}
                                  required
                                  className="transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                                />
                              </div>
                              
                              <div className="space-y-2">
                                <Label htmlFor="signup-password">Lösenord</Label>
                                <Input
                                  id="signup-password"
                                  type="password"
                                  value={password}
                                  onChange={(e) => setPassword(e.target.value)}
                                  required
                                  minLength={6}
                                  className="transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                                />
                              </div>
                              
                              <div className="space-y-3">
                                <Label>Jag är</Label>
                                <RadioGroup
                                  value={role}
                                  onValueChange={(value: 'job_seeker' | 'employer') => setRole(value)}
                                >
                                  <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="job_seeker" id="job_seeker" />
                                    <Label htmlFor="job_seeker">Jobbsökare</Label>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="employer" id="employer" />
                                    <Label htmlFor="employer">Arbetsgivare</Label>
                                  </div>
                                </RadioGroup>
                              </div>
                              
                              <Button 
                                type="submit" 
                                className="w-full py-6 bg-primary hover:bg-primary/90 transition-all duration-200" 
                                disabled={loading}
                              >
                                {loading ? 'Registrerar...' : 'Registrera konto'}
                              </Button>
                            </form>
                          </TabsContent>
                        </Tabs>
                        
                        {showResend && email && (
                          <div className="mt-4 p-4 bg-accent rounded-lg border border-border">
                            <div className="flex items-center gap-2 mb-2">
                              <Mail size={16} className="text-secondary" />
                              <span className="text-sm font-medium">E-post inte bekräftad</span>
                            </div>
                            <p className="text-sm text-muted-foreground mb-3">
                              Du behöver bekräfta din e-post ({email}) innan du kan logga in.
                            </p>
                            <Button 
                              onClick={handleResendConfirmation}
                              variant="outline" 
                              size="sm"
                              disabled={loading}
                              className="w-full"
                            >
                              {loading ? 'Skickar...' : 'Skicka ny bekräftelsemail'}
                            </Button>
                          </div>
                        )}
                        
                        {showResetPassword && email && (
                          <div className="mt-4 p-4 bg-accent rounded-lg border border-border">
                            <div className="flex items-center gap-2 mb-2">
                              <Key size={16} className="text-secondary" />
                              <span className="text-sm font-medium">Problem med lösenord?</span>
                            </div>
                            <p className="text-sm text-muted-foreground mb-3">
                              Om du har glömt ditt lösenord kan du återställa det här.
                            </p>
                            <Button 
                              onClick={() => resetPassword(email)}
                              variant="outline" 
                              size="sm"
                              disabled={loading}
                              className="w-full"
                            >
                              Återställ lösenord
                            </Button>
                          </div>
                        )}
                      </>
                    )}
                  </CardContent>
                    </Card>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Mobile Hero Content - only visible on mobile */}
          <div className="lg:hidden bg-accent/50 p-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-primary mb-4">
                Hitta din perfekta jobbmatch
              </h2>
              <div className="flex justify-center">
                <div className="space-y-3">
                  <div className="flex items-center text-muted-foreground">
                    <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                      <Target className="h-5 w-5 text-secondary" />
                    </div>
                    <span className="text-sm ml-3">Smart matchmaking</span>
                  </div>
                  <div className="flex items-center text-muted-foreground">
                    <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                      <Users className="h-5 w-5 text-secondary" />
                    </div>
                    <span className="text-sm ml-3">Direktkontakt med företag</span>
                  </div>
                  <div className="flex items-center text-muted-foreground">
                    <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                      <Zap className="h-5 w-5 text-secondary" />
                    </div>
                    <span className="text-sm ml-3">Snabb ansökningsprocess</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Auth;