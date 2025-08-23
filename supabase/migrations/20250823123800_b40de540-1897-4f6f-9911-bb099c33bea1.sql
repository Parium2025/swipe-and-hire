-- Enable leaked password protection for better security
UPDATE auth.config 
SET 
  password_min_length = 6,
  password_required_characters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
  password_dictionary_protection_enabled = true
WHERE true;