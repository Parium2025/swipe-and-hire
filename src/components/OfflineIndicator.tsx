import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { Alert, AlertDescription } from '@/components/ui/alert';

export const OfflineIndicator = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 px-4 pt-4">
      <Alert variant="destructive" className="border-destructive/50 bg-destructive/10 text-foreground">
        <AlertDescription className="text-center font-medium">
          Offline - visar sparad data
        </AlertDescription>
      </Alert>
    </div>
  );
};
