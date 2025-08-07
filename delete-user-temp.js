// Tillfällig Edge Function anrop för att ta bort specifik användare
import { supabase } from './src/integrations/supabase/client.js';

async function deleteSpecificUser() {
  try {
    console.log('Attempting to delete user fredrikandits@gmail.com');
    
    const { data, error } = await supabase.functions.invoke('delete-user', {
      body: {
        email: 'fredrikandits@gmail.com'
      }
    });
    
    if (error) {
      console.error('Delete user error:', error);
      return;
    }
    
    console.log('Delete user result:', data);
  } catch (error) {
    console.error('Failed to delete user:', error);
  }
}

deleteSpecificUser();