-- Ta bort relaterade poster för användare josefineborenstam@gmail.com
DELETE FROM public.email_confirmations WHERE user_id = 'b5d75811-6c80-42da-8f58-1fc1f7c5ed75';
DELETE FROM public.profiles WHERE user_id = 'b5d75811-6c80-42da-8f58-1fc1f7c5ed75';

-- Användaren kommer att tas bort från auth.users via admin funktionalitet