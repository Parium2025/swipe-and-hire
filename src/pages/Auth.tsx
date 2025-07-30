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
import heroImage from '@/assets/hero-auth.jpg';
import AnimatedIntro from '@/components/AnimatedIntro';

const Auth = () => {
  const [showIntro, setShowIntro] = useState(true);
  const [showWelcome, setShowWelcome] = useState(true);
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

  // Welcome Screen Component
  const WelcomeScreen = () => (
    <div className="min-h-screen bg-gradient-parium relative overflow-hidden">
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${heroImage})` }}
      >
        <div className="absolute inset-0 bg-primary/90"></div>
      </div>
      
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center text-center px-4">
        <div className="max-w-4xl mx-auto">
          {/* Logo */}
          <div className="mb-8">
            <img 
              src="/lovable-uploads/3e52da4e-167e-4ebf-acfb-6a70a68cfaef.png" 
              alt="Parium" 
              className="h-16 md:h-20 w-auto mx-auto"
            />
          </div>
          
          {/* Main Heading */}
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-primary-foreground mb-6 leading-tight">
            Din karriär.
            <br />
            <span className="text-secondary">Dina villkor.</span>
          </h1>
          
          {/* Subtitle */}
          <p className="text-xl md:text-2xl text-primary-foreground/90 mb-12 max-w-3xl mx-auto">
            Parium förenar talanger med framtidens arbetsplatser. Upptäck möjligheter som matchar exakt vad du söker.
          </p>
          
          {/* Feature highlights */}
          <div className="grid md:grid-cols-3 gap-8 mb-12 max-w-4xl mx-auto">
            <div className="bg-background/10 backdrop-blur-sm rounded-2xl p-6 border border-primary-foreground/20">
              <div className="bg-secondary/20 p-3 rounded-xl w-fit mx-auto mb-4">
                <Target className="h-8 w-8 text-secondary" />
              </div>
              <h3 className="text-lg font-semibold text-primary-foreground mb-2">Smart Matchning</h3>
              <p className="text-primary-foreground/80 text-sm">AI-driven matchning baserat på dina färdigheter och mål</p>
            </div>
            
            <div className="bg-background/10 backdrop-blur-sm rounded-2xl p-6 border border-primary-foreground/20">
              <div className="bg-secondary/20 p-3 rounded-xl w-fit mx-auto mb-4">
                <Users className="h-8 w-8 text-secondary" />
              </div>
              <h3 className="text-lg font-semibold text-primary-foreground mb-2">Direktkontakt</h3>
              <p className="text-primary-foreground/80 text-sm">Kommunicera direkt med arbetsgivare och beslutsfattare</p>
            </div>
            
            <div className="bg-background/10 backdrop-blur-sm rounded-2xl p-6 border border-primary-foreground/20">
              <div className="bg-secondary/20 p-3 rounded-xl w-fit mx-auto mb-4">
                <Zap className="h-8 w-8 text-secondary" />
              </div>
              <h3 className="text-lg font-semibold text-primary-foreground mb-2">Snabb Process</h3>
              <p className="text-primary-foreground/80 text-sm">Från matchning till intervju på rekordtid</p>
            </div>
          </div>
          
          {/* CTA Button */}
          <Button 
            onClick={() => setShowWelcome(false)}
            size="lg"
            className="bg-secondary hover:bg-secondary/90 text-secondary-foreground px-12 py-6 text-lg font-semibold rounded-full shadow-2xl hover:shadow-secondary/25 transition-all duration-300 transform hover:scale-105"
          >
            Kom igång nu
          </Button>
          
          {/* Bottom tagline */}
          <p className="text-primary-foreground/60 text-sm mt-8">
            Redan medlem? <button 
              onClick={() => setShowWelcome(false)} 
              className="text-secondary hover:text-secondary/80 underline transition-colors"
            >
              Logga in här
            </button>
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {showIntro ? (
        <AnimatedIntro onComplete={() => setShowIntro(false)} />
      ) : showWelcome ? (
        <WelcomeScreen />
      ) : (
        <>
          {/* Hero Section */}
          <div className="relative min-h-screen lg:min-h-[60vh] bg-gradient-parium">
            <div 
              className="absolute inset-0 bg-cover bg-center bg-no-repeat"
              style={{ backgroundImage: `url(${heroImage})` }}
            >
              <div className="absolute inset-0 bg-primary/80"></div>
            </div>
            
            <div className="relative z-10 min-h-screen lg:min-h-[60vh] flex">
              {/* Left side - Hero content */}
              <div className="hidden lg:flex lg:w-1/2 flex-col justify-center px-12 text-primary-foreground">
                <div className="max-w-lg">
                  <h1 className="text-5xl font-bold mb-6 leading-tight">
                    Hitta din <span className="text-secondary">perfekta</span> match
                  </h1>
                  <p className="text-xl mb-8 text-primary-foreground/90">
                    Parium kopplar samman talanger med företag genom intelligent matchmaking. 
                    Upptäck karriärmöjligheter som passar just dig.
                  </p>
                  
                  <div className="grid grid-cols-1 gap-4 mb-8">
                    <div className="flex items-center gap-3">
                      <div className="bg-secondary/20 p-2 rounded-lg">
                        <Target className="h-5 w-5 text-secondary" />
                      </div>
                      <span className="text-primary-foreground/90">Smart matchmaking baserat på dina färdigheter</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="bg-secondary/20 p-2 rounded-lg">
                        <Users className="h-5 w-5 text-secondary" />
                      </div>
                      <span className="text-primary-foreground/90">Direktkontakt med ledande företag</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="bg-secondary/20 p-2 rounded-lg">
                        <Zap className="h-5 w-5 text-secondary" />
                      </div>
                      <span className="text-primary-foreground/90">Snabb och enkel ansökningsprocess</span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Right side - Auth form */}
              <div className="w-full lg:w-1/2 flex items-center justify-center p-4 lg:p-12">
                <Card className="w-full max-w-md bg-background/95 backdrop-blur-sm border-0 shadow-2xl">
                  <CardHeader className="text-center pb-4">
                    <div className="mb-4">
                      <img 
                        src="/lovable-uploads/3e52da4e-167e-4ebf-acfb-6a70a68cfaef.png" 
                        alt="Parium" 
                        className="h-12 w-auto mx-auto"
                      />
                    </div>
                    <CardTitle className="text-2xl font-bold text-primary">Välkommen till Parium</CardTitle>
                    <CardDescription className="text-muted-foreground">
                      {isPasswordReset ? 'Återställ ditt lösenord' : 'Börja din karriärresa idag'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
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
                              <Separator className="w-full" />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                              <span className="bg-background px-2 text-muted-foreground">
                                Eller fortsätt med e-post
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
          
          {/* Mobile Hero Content - only visible on mobile */}
          <div className="lg:hidden bg-accent/50 p-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-primary mb-4">
                Hitta din perfekta match
              </h2>
              <div className="grid grid-cols-1 gap-3 max-w-sm mx-auto">
                <div className="flex items-center gap-3">
                  <Target className="h-5 w-5 text-secondary" />
                  <span className="text-sm text-muted-foreground">Smart matchmaking</span>
                </div>
                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-secondary" />
                  <span className="text-sm text-muted-foreground">Direktkontakt med företag</span>
                </div>
                <div className="flex items-center gap-3">
                  <Zap className="h-5 w-5 text-secondary" />
                  <span className="text-sm text-muted-foreground">Snabb ansökningsprocess</span>
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