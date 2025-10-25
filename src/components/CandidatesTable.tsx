import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ApplicationData } from '@/hooks/useApplicationsData';
import { formatDistanceToNow } from 'date-fns';
import { sv } from 'date-fns/locale';
import { CandidateProfileDialog } from './CandidateProfileDialog';

interface CandidatesTableProps {
  applications: ApplicationData[];
  onUpdate: () => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
}

const statusConfig = {
  pending: { label: 'Ny', className: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  reviewing: { label: 'Granskas', className: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' },
  accepted: { label: 'Accepterad', className: 'bg-green-500/20 text-green-300 border-green-500/30' },
  rejected: { label: 'Avvisad', className: 'bg-red-500/20 text-red-300 border-red-500/30' },
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
        <p className="text-white max-w-sm">
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
            <TableRow className="border-white/10 hover:bg-white/5">
              <TableHead className="text-foreground">Kandidat</TableHead>
              <TableHead className="text-foreground">Tjänst</TableHead>
              <TableHead className="text-foreground">Status</TableHead>
              <TableHead className="text-foreground">Ansökt</TableHead>
              <TableHead className="text-foreground">Senaste aktivitet</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {applications.map((application) => {
              const initials = `${application.first_name?.[0] || ''}${application.last_name?.[0] || ''}`.toUpperCase();
              const status = statusConfig[application.status as keyof typeof statusConfig] || statusConfig.pending;
              
              return (
                <TableRow
                  key={application.id}
                  className="border-white/10 hover:bg-white/5 cursor-pointer transition-colors"
                  onClick={() => handleRowClick(application)}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={application.profile_image_url || undefined} />
                        <AvatarFallback className="bg-primary/20 text-primary">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
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
                    <Badge variant="outline" className={status.className}>
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
          <button
            onClick={onLoadMore}
            disabled={isLoadingMore}
            className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {isLoadingMore ? 'Laddar fler...' : 'Visa fler kandidater'}
          </button>
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
