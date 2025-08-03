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
import { Eye, EyeOff, User, Building2 } from 'lucide-react';

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
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'job_seeker' | 'employer'>('job_seeker');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showResend, setShowResend] = useState(false);

  const { signIn, signUp, resendConfirmation } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setShowResend(false);

    try {
      if (isLogin) {
        const result = await signIn(email, password);
        if (result.error?.code === 'email_not_confirmed') {
          setShowResend(true);
        }
      } else {
        const result = await signUp(email, password, {
          role,
          first_name: firstName,
          last_name: lastName,
          phone: phone
        });
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

  if (isPasswordReset) {
    return (
      <div className="min-h-screen bg-gradient-parium flex items-center justify-center p-4">
        <Card className="w-full max-w-sm bg-background/95 backdrop-blur-sm">
          <CardHeader className="text-center">
            <img 
              src="/lovable-uploads/3e52da4e-167e-4ebf-acfb-6a70a68cfaef.png" 
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
    <div className="min-h-screen bg-gradient-parium flex flex-col">
      {/* Animated background elements */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/95 to-primary-dark"></div>
        
        {/* Animated floating elements */}
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
            <div className="mb-6">
              <div className="relative mx-auto w-fit">
                <div className="absolute inset-0 blur-xl bg-secondary/30 rounded-full"></div>
                <img 
                  src="/lovable-uploads/3e52da4e-167e-4ebf-acfb-6a70a68cfaef.png" 
                  alt="Parium" 
                  className="relative h-16 w-auto"
                />
              </div>
            </div>
            
            <h1 className="text-3xl font-bold text-primary-foreground mb-4">
              Välkommen till Parium
            </h1>
            <p className="text-primary-foreground/80 text-lg mb-8">
              Framtiden börjar med ett swipe
            </p>
          </div>

          {/* Auth form */}
          <div className="w-full max-w-sm">
            <Card className="bg-background/95 backdrop-blur-sm border border-white/10 shadow-2xl rounded-2xl">
              <CardContent className="p-6">
                <Tabs value={isLogin ? 'login' : 'signup'} onValueChange={(value) => setIsLogin(value === 'login')}>
                  <TabsList className="grid w-full grid-cols-2 mb-6">
                    <TabsTrigger value="login">Logga in</TabsTrigger>
                    <TabsTrigger value="signup">Registrera</TabsTrigger>
                  </TabsList>

                  <TabsContent value="login">
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div>
                        <Label htmlFor="email">E-post</Label>
                        <Input
                          id="email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="password">Lösenord</Label>
                        <div className="relative mt-1">
                          <Input
                            id="password"
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
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
                      <Button type="submit" className="w-full" disabled={loading}>
                        {loading ? 'Loggar in...' : 'Logga in'}
                      </Button>
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
                      <div>
                        <Label htmlFor="email">E-post</Label>
                        <Input
                          id="email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="phone">Telefon</Label>
                        <Input
                          id="phone"
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="password">Lösenord</Label>
                        <div className="relative mt-1">
                          <Input
                            id="password"
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
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
                      
                      <Button type="submit" className="w-full" disabled={loading}>
                        {loading ? 'Registrerar...' : 'Registrera'}
                      </Button>
                    </form>
                  </TabsContent>
                </Tabs>

                {showResend && (
                  <div className="mt-4 p-3 bg-secondary/10 rounded-lg text-center">
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
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthMobile;