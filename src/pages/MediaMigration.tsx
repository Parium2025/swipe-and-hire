import { MediaMigrationControl } from '@/components/MediaMigrationControl';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function MediaMigration() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Media-migrering</h1>
            <p className="text-muted-foreground">
              Migrera befintlig media till rätt buckets
            </p>
          </div>
        </div>

        <MediaMigrationControl />

        <div className="bg-muted/50 rounded-lg p-6 space-y-4">
          <h2 className="text-lg font-semibold">Om bucket-strategin</h2>
          <div className="space-y-3 text-sm text-muted-foreground">
            <div>
              <p className="font-medium text-foreground mb-1">PUBLIC buckets (endast företagsmedia):</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li><code className="text-xs bg-background px-1.5 py-0.5 rounded">company-logos</code> → Företagslogotyper</li>
                <li><code className="text-xs bg-background px-1.5 py-0.5 rounded">job-images</code> → Jobbannonsbilder</li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-foreground mb-1">PRIVATE bucket (all användar-media):</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li><code className="text-xs bg-background px-1.5 py-0.5 rounded">job-applications</code> → Profilvideor, profilbilder, cover-bilder, CV:n</li>
              </ul>
            </div>
            <div className="pt-2 border-t border-border">
              <p className="font-medium text-foreground mb-2">Så fungerar det:</p>
              <ol className="list-decimal list-inside space-y-1 ml-4">
                <li>Alla filer lagras som storage paths i databasen (aldrig URL:er)</li>
                <li>Vid visning genereras rätt typ av URL (public eller signed) automatiskt</li>
                <li>Public buckets = snabbare, ingen expiration</li>
                <li>Private buckets = säkrare, kontrollerad åtkomst</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
