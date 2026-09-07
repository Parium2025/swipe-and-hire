DELETE FROM public.outreach_templates
WHERE is_default = true
  AND name IN (
    'Chat · varm uppdatering',
    'E-post · professionell uppdatering',
    'Push · kort uppdatering',
    'Intervju · premiummejl',
    'Intervju · premiumpush'
  );