
UPDATE public.subscription_plans SET description = 'För dig som rekryterar regelbundet.' WHERE tier = 'start';
UPDATE public.subscription_plans SET description = 'När teamet växer och volymen ökar.' WHERE tier = 'vaxa';
UPDATE public.subscription_plans SET description = 'För organisationer utan gränser.' WHERE tier = 'pro';
UPDATE public.subscription_plans SET name = 'Enkelannons', description = 'Publicera en enskild annons som ligger uppe i 14 dagar. Perfekt när ni bara söker en person och inte behöver ett löpande abonnemang.' WHERE tier = 'one_time';
