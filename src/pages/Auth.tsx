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
import { Mail, Key, Linkedin } from 'lucide-react';

const Auth = () => {
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
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Parium</CardTitle>
          <CardDescription>
            Jobbmatchning på ett nytt sätt
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
                  className="w-full flex items-center gap-3 py-6 bg-[#0077B5] hover:bg-[#0066A3] text-white border-[#0077B5] hover:border-[#0066A3]"
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
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger 
                    value="login" 
                    onClick={() => setIsLogin(true)}
                  >
                    Logga in
                  </TabsTrigger>
                  <TabsTrigger 
                    value="signup" 
                    onClick={() => setIsLogin(false)}
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
                      />
                    </div>
                    <Button 
                      type="submit" 
                      className="w-full" 
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
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastName">Efternamn</Label>
                        <Input
                          id="lastName"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          required
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
                      className="w-full" 
                      disabled={loading}
                    >
                      {loading ? 'Registrerar...' : 'Registrera konto'}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
              
              {showResend && email && (
                <div className="mt-4 p-4 bg-muted rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Mail size={16} />
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
                <div className="mt-4 p-4 bg-muted rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Key size={16} />
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
  );
};

export default Auth;