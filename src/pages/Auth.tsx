import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useDevice } from '@/hooks/use-device';
import AnimatedIntro from '@/components/AnimatedIntro';
import AuthMobile from '@/components/AuthMobile';
import AuthTablet from '@/components/AuthTablet';
import AuthDesktop from '@/components/AuthDesktop';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, AlertCircle } from 'lucide-react';

const Auth = () => {
  const [showIntro, setShowIntro] = useState(() => {
    return !sessionStorage.getItem('parium-intro-seen');
  });
  const [isPasswordReset, setIsPasswordReset] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [confirmationStatus, setConfirmationStatus] = useState<'none' | 'success' | 'already-confirmed' | 'error'>('none');
  const [confirmationMessage, setConfirmationMessage] = useState('');

  const { user, updatePassword, confirmEmail } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const device = useDevice();

  useEffect(() => {
    const isReset = searchParams.get('reset') === 'true';
    const confirmed = searchParams.get('confirmed');
    
    console.log('Auth useEffect - URL params:', { isReset, confirmed, currentUrl: window.location.href });
    
    // Hantera bekräftelsestatusmeddelanden från redirect
    if (confirmed === 'success') {
      setConfirmationStatus('success');
      setConfirmationMessage('🎉 Fantastiskt! Ditt konto har aktiverats och du kan nu logga in i Parium.');
      console.log('Showing success confirmation message');
    } else if (confirmed === 'already') {
      setConfirmationStatus('already-confirmed');
      setConfirmationMessage('✅ Perfekt! Ditt konto är redan aktiverat och redo att användas.');
      console.log('Showing already confirmed message');
    }
    
    setIsPasswordReset(isReset);
    
    // Endast navigera om användaren är inloggad OCH det inte är password reset
    if (user && !isReset && confirmationStatus === 'none' && !confirmed) {
      console.log('User is logged in, navigating to home');
      navigate('/');
    }
  }, [user, navigate, searchParams, confirmationStatus]);

  const handleEmailConfirmation = async (token: string) => {
    console.log('Starting email confirmation with token:', token);
    
    try {
      const result = await confirmEmail(token);
      console.log('Email confirmation successful:', result);
      setConfirmationStatus('success');
      setConfirmationMessage(result.message);
    } catch (error: any) {
      console.log('Email confirmation error:', error);
      const errorMessage = error.message || 'Ett fel inträffade vid bekräftelse av e-post';
      
      // Kolla om det är "redan bekräftad" felet
      if (errorMessage.includes('redan bekräftad') || errorMessage.includes('already')) {
        console.log('Account already confirmed');
        setConfirmationStatus('already-confirmed');
        setConfirmationMessage('Ditt konto är redan aktiverat. Du kan logga in direkt.');
      } else if (errorMessage.includes('utgången') || errorMessage.includes('expired')) {
        console.log('Confirmation link expired');
        setConfirmationStatus('error');
        setConfirmationMessage('Bekräftelselänken har gått ut. Du kan registrera dig igen med samma e-postadress.');
      } else {
        console.log('Other confirmation error');
        setConfirmationStatus('error');
        setConfirmationMessage('Denna bekräftelselänk är inte längre giltig. Kontakta support om problemet kvarstår.');
      }
    }
    
    // Ta bort confirm parametern från URL
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.delete('confirm');
    const newUrl = `/auth?${newSearchParams.toString()}`;
    console.log('Navigating to:', newUrl);
    navigate(newUrl, { replace: true });
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
    
    const result = await updatePassword(newPassword);
    
    if (!result.error) {
      navigate('/');
    }
  };

  if (showIntro) {
    return (
      <AnimatedIntro onComplete={() => {
        setShowIntro(false);
        sessionStorage.setItem('parium-intro-seen', 'true');
      }} />
    );
  }

  // Visa bekräftelsestatus om det finns en
  if (confirmationStatus !== 'none') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary via-primary-glow to-primary-dark flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-glass backdrop-blur-md border-white/20">
          <CardContent className="p-8 text-center">
            {confirmationStatus === 'success' && (
              <>
                <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-primary-foreground mb-4">
                  Konto aktiverat!
                </h2>
                <p className="text-primary-foreground/80 mb-6">
                  {confirmationMessage}
                </p>
                <Button 
                  onClick={() => {
                    setConfirmationStatus('none');
                    navigate('/auth', { replace: true });
                  }}
                  className="w-full"
                >
                  Logga in
                </Button>
              </>
            )}
            
            {confirmationStatus === 'already-confirmed' && (
              <>
                <CheckCircle className="h-16 w-16 text-blue-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-primary-foreground mb-4">
                  Redan aktiverat
                </h2>
                <p className="text-primary-foreground/80 mb-6">
                  {confirmationMessage}
                </p>
                <Button 
                  onClick={() => {
                    setConfirmationStatus('none');
                    navigate('/auth', { replace: true });
                  }}
                  className="w-full"
                >
                  Logga in
                </Button>
              </>
            )}
            
            {confirmationStatus === 'error' && (
              <>
                <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-primary-foreground mb-4">
                  Ett fel inträffade
                </h2>
                <p className="text-primary-foreground/80 mb-6">
                  {confirmationMessage}
                </p>
                <Button 
                  onClick={() => {
                    setConfirmationStatus('none');
                    navigate('/auth', { replace: true });
                  }}
                  className="w-full"
                >
                  Försök igen
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Använd rätt komponent baserat på skärmstorlek
  if (device === 'mobile') {
    return (
      <AuthMobile
        isPasswordReset={isPasswordReset}
        newPassword={newPassword}
        setNewPassword={setNewPassword}
        confirmPassword={confirmPassword}
        setConfirmPassword={setConfirmPassword}
        handlePasswordReset={handlePasswordReset}
      />
    );
  }

  if (device === 'tablet') {
    return (
      <AuthTablet
        isPasswordReset={isPasswordReset}
        newPassword={newPassword}
        setNewPassword={setNewPassword}
        confirmPassword={confirmPassword}
        setConfirmPassword={setConfirmPassword}
        handlePasswordReset={handlePasswordReset}
      />
    );
  }

  return (
    <AuthDesktop
      isPasswordReset={isPasswordReset}
      newPassword={newPassword}
      setNewPassword={setNewPassword}
      confirmPassword={confirmPassword}
      setConfirmPassword={setConfirmPassword}
      handlePasswordReset={handlePasswordReset}
    />
  );
};

export default Auth;