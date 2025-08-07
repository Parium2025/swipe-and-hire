-- Ta bort användaren fredrikandits@gmail.com från systemet
-- Detta är en enkel SQL-operation för att rensa upp testdata

-- Ta bort relaterade poster först
DELETE FROM public.profiles WHERE user_id = 'efc9d724-6890-46d5-9cf4-8d3a765c3897';
DELETE FROM public.user_roles WHERE user_id = 'efc9d724-6890-46d5-9cf4-8d3a765c3897';
DELETE FROM public.email_confirmations WHERE user_id = 'efc9d724-6890-46d5-9cf4-8d3a765c3897';

-- Ta bort användaren från auth.users (detta kommer trigga kaskaduppdateringar)
DELETE FROM auth.users WHERE id = 'efc9d724-6890-46d5-9cf4-8d3a765c3897' AND email = 'fredrikandits@gmail.com';