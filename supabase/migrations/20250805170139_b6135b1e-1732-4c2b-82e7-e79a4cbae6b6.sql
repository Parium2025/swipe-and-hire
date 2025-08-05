-- Ta bort användaren pariumab@gmail.com och all relaterad data
DO $$
DECLARE
    user_uuid uuid;
BEGIN
    -- Hitta användarens UUID baserat på e-post
    SELECT id INTO user_uuid 
    FROM auth.users 
    WHERE email = 'pariumab@gmail.com';
    
    IF user_uuid IS NOT NULL THEN
        -- Ta bort från profiles
        DELETE FROM public.profiles WHERE user_id = user_uuid;
        
        -- Ta bort från user_roles
        DELETE FROM public.user_roles WHERE user_id = user_uuid;
        
        -- Ta bort från email_confirmations
        DELETE FROM public.email_confirmations WHERE user_id = user_uuid;
        
        -- Ta bort från auth.users (detta bör göras sist)
        DELETE FROM auth.users WHERE id = user_uuid;
        
        RAISE NOTICE 'User pariumab@gmail.com and all related data deleted successfully';
    ELSE
        RAISE NOTICE 'User pariumab@gmail.com not found';
    END IF;
END $$;