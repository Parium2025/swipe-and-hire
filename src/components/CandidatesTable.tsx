import { useMemo, useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ApplicationData } from '@/hooks/useApplicationsData';
import { formatDistanceToNow } from 'date-fns';
import { sv } from 'date-fns/locale';
import { CandidateProfileDialog } from './CandidateProfileDialog';
import { CandidateAvatar } from './CandidateAvatar';
import { Button } from '@/components/ui/button';

interface CandidatesTableProps {
  applications: ApplicationData[];
  onUpdate: () => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
}

const statusConfig = {
  pending: { label: 'Ny', className: 'bg-blue-500/20 text-blue-300 border-blue-500/30 group-hover:backdrop-brightness-90 hover:bg-blue-500/30 hover:backdrop-brightness-110 transition-all duration-300' },
  reviewing: { label: 'Granskas', className: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30 group-hover:backdrop-brightness-90 hover:bg-yellow-500/30 hover:backdrop-brightness-110 transition-all duration-300' },
  accepted: { label: 'Accepterad', className: 'bg-green-500/20 text-green-300 border-green-500/30 group-hover:backdrop-brightness-90 hover:bg-green-500/30 hover:backdrop-brightness-110 transition-all duration-300' },
  rejected: { label: 'Avvisad', className: 'bg-red-500/20 text-red-300 border-red-500/30 group-hover:backdrop-brightness-90 hover:bg-red-500/30 hover:backdrop-brightness-110 transition-all duration-300' },
};

export function CandidatesTable({ 
  applications, 
  onUpdate, 
  onLoadMore,
  hasMore = false,
  isLoadingMore = false 
}: CandidatesTableProps) {
  const [selectedApplication, setSelectedApplication] = useState<ApplicationData | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleRowClick = (application: ApplicationData) => {
    setSelectedApplication(application);
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setTimeout(() => setSelectedApplication(null), 300);
  };

  if (applications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <div className="bg-white/5 rounded-full p-6 mb-4">
          <svg
            className="h-12 w-12 text-muted-foreground"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">Inga kandidater än</h3>
        <p className="text-sm text-white max-w-sm">
          När någon söker till dina jobbannonser kommer deras ansökningar att visas här.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-lg border border-white/10 bg-white/5 backdrop-blur-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-white/10 hover:bg-white/5 hover:border-white/50">
              <TableHead className="text-white">Kandidat</TableHead>
              <TableHead className="text-white">Tjänst</TableHead>
              <TableHead className="text-white">Status</TableHead>
              <TableHead className="text-white">Ansökt</TableHead>
              <TableHead className="text-white">Senaste aktivitet</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {applications.map((application) => {
              const status = statusConfig[application.status as keyof typeof statusConfig] || statusConfig.pending;
              
              return (
                <TableRow
                  key={application.id}
                  className="group border-white/10 hover:bg-white/5 hover:border-white/50 cursor-pointer transition-all duration-150 active:bg-white/10 active:scale-[0.99]"
                  onClick={() => handleRowClick(application)}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <CandidateAvatar
                        profileImageUrl={application.profile_image_url}
                        videoUrl={application.video_url}
                        isProfileVideo={application.is_profile_video}
                        firstName={application.first_name}
                        lastName={application.last_name}
                      />
                      <div>
                        <div className="font-medium text-foreground">
                          {application.first_name} {application.last_name}
                        </div>
                        {application.email && (
                          <div className="text-sm text-muted-foreground">{application.email}</div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {application.job_title || 'Okänd tjänst'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="glass" className={status.className}>
                      {status.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDistanceToNow(new Date(application.applied_at), {
                      addSuffix: true,
                      locale: sv,
                    })}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDistanceToNow(new Date(application.updated_at), {
                      addSuffix: true,
                      locale: sv,
                    })}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      
      {hasMore && onLoadMore && (
        <div className="flex justify-center py-4">
          <Button
            onClick={onLoadMore}
            disabled={isLoadingMore}
            variant="glass"
          >
            {isLoadingMore ? 'Laddar fler...' : 'Visa fler kandidater'}
          </Button>
        </div>
      )}

      <CandidateProfileDialog
        application={selectedApplication}
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        onStatusUpdate={() => {
          onUpdate();
          handleDialogClose();
        }}
      />
    </>
  );
};
