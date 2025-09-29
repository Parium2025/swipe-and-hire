import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, Download } from 'lucide-react';
import { checkForUpdates, applyUpdate, onUpdateAvailable } from '@/utils/registerServiceWorker';
import { toast } from 'sonner';

export const UpdateButton = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    // Listen for updates
    onUpdateAvailable(() => {
      setUpdateAvailable(true);
      toast.success('Ny version tillgänglig!', {
        description: 'Tryck på uppdatera-knappen för att ladda den nya versionen.'
      });
    });
  }, []);

  const handleCheckForUpdates = async () => {
    setChecking(true);
    toast.info('Kollar efter uppdateringar...', {
      description: 'Detta kan ta några sekunder'
    });

    try {
      await checkForUpdates();
      
      // Wait a moment for the update check to complete
      setTimeout(() => {
        if (!updateAvailable) {
          toast.success('Appen är redan uppdaterad!', {
            description: 'Du har den senaste versionen'
          });
        }
        setChecking(false);
      }, 2000);
    } catch (error) {
      toast.error('Kunde inte kolla efter uppdateringar', {
        description: 'Försök igen om en stund'
      });
      setChecking(false);
    }
  };

  const handleApplyUpdate = () => {
    toast.success('Uppdaterar appen...', {
      description: 'Appen kommer att laddas om'
    });
    
    setTimeout(() => {
      applyUpdate();
      window.location.reload();
    }, 500);
  };

  if (updateAvailable) {
    return (
      <Button
        onClick={handleApplyUpdate}
        variant="default"
        size="sm"
        className="bg-green-600 hover:bg-green-700 text-white px-2 py-1 h-8 text-xs"
      >
        <Download className="h-3 w-3 mr-1" />
        Uppdatera
      </Button>
    );
  }

  return (
    <Button
      onClick={handleCheckForUpdates}
      variant="outline"
      size="sm"
      disabled={checking}
      className="border-white/20 text-white hover:bg-white/20 bg-white/5 px-2 py-1 h-8 text-xs"
    >
      <RefreshCw className={`h-3 w-3 mr-1 ${checking ? 'animate-spin' : ''}`} />
      {checking ? 'Kollar...' : 'Uppdatera'}
    </Button>
  );
};
