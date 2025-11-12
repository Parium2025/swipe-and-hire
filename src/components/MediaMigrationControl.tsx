import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { RefreshCw, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export function MediaMigrationControl() {
  const [isMigrating, setIsMigrating] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    migratedProfiles: number;
    migratedCVs: number;
    errors: string[];
    message?: string;
  } | null>(null);
  const { toast } = useToast();

  const runMigration = async () => {
    setIsMigrating(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('migrate-media', {
        body: {}
      });

      if (error) {
        console.error('Migration error:', error);
        toast({
          title: 'Migrering misslyckades',
          description: error.message,
          variant: 'destructive'
        });
        setResult({
          success: false,
          migratedProfiles: 0,
          migratedCVs: 0,
          errors: [error.message]
        });
      } else {
        console.log('Migration result:', data);
        setResult(data);
        toast({
          title: 'Migrering klar!',
          description: data.message || 'Media har migrerats till rätt buckets.'
        });
      }
    } catch (error) {
      console.error('Migration error:', error);
      toast({
        title: 'Fel vid migrering',
        description: error instanceof Error ? error.message : 'Något gick fel',
        variant: 'destructive'
      });
      setResult({
        success: false,
        migratedProfiles: 0,
        migratedCVs: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      });
    } finally {
      setIsMigrating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Media-migrering</CardTitle>
        <CardDescription>
          Migrera befintlig media till rätt buckets med konsekvent storage paths
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Denna migrering kommer att:
          </p>
          <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
            <li>Konvertera profilbilder och cover-bilder till storage paths i profile-media bucket (PUBLIC)</li>
            <li>Konvertera profilvideor till storage paths i job-applications bucket (PRIVATE)</li>
            <li>Konvertera CV:n till storage paths i job-applications bucket (PRIVATE)</li>
            <li>Ta bort alla temporära URL:er från databasen</li>
          </ul>
        </div>

        <Button
          onClick={runMigration}
          disabled={isMigrating}
          className="w-full"
        >
          {isMigrating ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Migrerar...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Kör migrering
            </>
          )}
        </Button>

        {result && (
          <Alert variant={result.success && result.errors.length === 0 ? 'default' : 'destructive'}>
            {result.success && result.errors.length === 0 ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : result.errors.length > 0 ? (
              <AlertCircle className="h-4 w-4" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            <AlertTitle>
              {result.success && result.errors.length === 0
                ? 'Migrering klar!'
                : result.errors.length > 0
                ? 'Migrering klar med varningar'
                : 'Migrering misslyckades'}
            </AlertTitle>
            <AlertDescription className="space-y-2">
              <div className="text-sm">
                <p>Migrerade profiler: {result.migratedProfiles}</p>
                <p>Migrerade CV:n: {result.migratedCVs}</p>
              </div>
              {result.errors.length > 0 && (
                <div className="text-sm space-y-1">
                  <p className="font-semibold">Fel:</p>
                  <ul className="list-disc list-inside">
                    {result.errors.slice(0, 5).map((error, i) => (
                      <li key={i}>{error}</li>
                    ))}
                  </ul>
                  {result.errors.length > 5 && (
                    <p className="text-xs">... och {result.errors.length - 5} fler fel</p>
                  )}
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
