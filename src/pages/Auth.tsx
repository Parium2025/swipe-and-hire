import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useDevice } from '@/hooks/use-device';
import AnimatedIntro from '@/components/AnimatedIntro';
import AuthMobile from '@/components/AuthMobile';
import AuthTablet from '@/components/AuthTablet';
import AuthDesktop from '@/components/AuthDesktop';

const Auth = () => {
  const [showIntro, setShowIntro] = useState(() => {
    return !sessionStorage.getItem('parium-intro-seen');
  });
  const [isPasswordReset, setIsPasswordReset] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const { user, updatePassword } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const device = useDevice();

  useEffect(() => {
    const isReset = searchParams.get('reset') === 'true';
    setIsPasswordReset(isReset);
    
    if (user && !isReset) {
      navigate('/');
    }
  }, [user, navigate, searchParams]);

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