import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

export default function MigrateMedia() {
  const [isJobMigrating, setIsJobMigrating] = useState(false);
  const [isProfileMigrating, setIsProfileMigrating] = useState(false);
  const [jobResults, setJobResults] = useState<any>(null);
  const [profileResults, setProfileResults] = useState<any>(null);
  const { toast } = useToast();

  const migrateJobImages = async (dryRun: boolean = false) => {
    setIsJobMigrating(true);
    try {
      const { data, error } = await supabase.functions.invoke('migrate-job-images', {
        body: { dryRun }
      });

      if (error) throw error;

      setJobResults(data);
      toast({
        title: dryRun ? "Dry Run Completed" : "Migration Completed",
        description: `Migrated: ${data.migratedCount || 0}, Failed: ${data.failedCount || 0}`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Migration Failed",
        description: error.message,
      });
    } finally {
      setIsJobMigrating(false);
    }
  };

  const migrateProfileMedia = async (dryRun: boolean = false) => {
    setIsProfileMigrating(true);
    try {
      const { data, error } = await supabase.functions.invoke('migrate-profile-media', {
        body: { dryRun }
      });

      if (error) throw error;

      setProfileResults(data);
      toast({
        title: dryRun ? "Dry Run Completed" : "Migration Completed",
        description: `Processed: ${data.profilesProcessed}, Files moved: ${data.filesMovedOrPlanned}`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Migration Failed",
        description: error.message,
      });
    } finally {
      setIsProfileMigrating(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Media Migration Tool</h1>
      
      <Card className="p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Job Images Migration</h2>
        <p className="text-muted-foreground mb-4">
          Migrates job images from job-applications bucket to job-images bucket
        </p>
        <div className="flex gap-2 mb-4">
          <Button 
            onClick={() => migrateJobImages(true)}
            disabled={isJobMigrating}
            variant="outline"
          >
            {isJobMigrating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Dry Run
          </Button>
          <Button 
            onClick={() => migrateJobImages(false)}
            disabled={isJobMigrating}
          >
            {isJobMigrating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Run Migration
          </Button>
        </div>
        {jobResults && (
          <div className="bg-muted p-4 rounded-lg">
            <pre className="text-sm overflow-auto">
              {JSON.stringify(jobResults, null, 2)}
            </pre>
          </div>
        )}
      </Card>

      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Profile Media Migration</h2>
        <p className="text-muted-foreground mb-4">
          Migrates profile images and videos from job-applications bucket to profile-media bucket
        </p>
        <div className="flex gap-2 mb-4">
          <Button 
            onClick={() => migrateProfileMedia(true)}
            disabled={isProfileMigrating}
            variant="outline"
          >
            {isProfileMigrating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Dry Run
          </Button>
          <Button 
            onClick={() => migrateProfileMedia(false)}
            disabled={isProfileMigrating}
          >
            {isProfileMigrating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Run Migration
          </Button>
        </div>
        {profileResults && (
          <div className="bg-muted p-4 rounded-lg">
            <pre className="text-sm overflow-auto">
              {JSON.stringify(profileResults, null, 2)}
            </pre>
          </div>
        )}
      </Card>
    </div>
  );
}
