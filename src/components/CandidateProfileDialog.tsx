import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ApplicationData } from '@/hooks/useApplicationsData';
import { Mail, Phone, MapPin, Briefcase, Calendar, FileText, Video } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CandidateProfileDialogProps {
  application: ApplicationData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusUpdate: () => void;
}

const statusConfig = {
  pending: { label: 'Ny', className: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  reviewing: { label: 'Granskas', className: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' },
  accepted: { label: 'Accepterad', className: 'bg-green-500/20 text-green-300 border-green-500/30' },
  rejected: { label: 'Avvisad', className: 'bg-red-500/20 text-red-300 border-red-500/30' },
};

export const CandidateProfileDialog = ({
  application,
  open,
  onOpenChange,
  onStatusUpdate,
}: CandidateProfileDialogProps) => {
  if (!application) return null;

  const initials = `${application.first_name?.[0] || ''}${application.last_name?.[0] || ''}`.toUpperCase();
  const currentStatus = statusConfig[application.status as keyof typeof statusConfig] || statusConfig.pending;

  const updateStatus = async (newStatus: string) => {
    const { error } = await supabase
      .from('job_applications')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', application.id);

    if (error) {
      toast.error('Kunde inte uppdatera status');
    } else {
      toast.success('Status uppdaterad');
      onStatusUpdate();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-background/95 backdrop-blur-xl border-white/10">
        <DialogHeader>
          <div className="flex items-start gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={application.profile_image_url || undefined} />
              <AvatarFallback className="bg-primary/20 text-primary text-lg">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <DialogTitle className="text-2xl text-foreground">
                {application.first_name} {application.last_name}
              </DialogTitle>
              <p className="text-muted-foreground mt-1">{application.job_title}</p>
              <Badge variant="outline" className={currentStatus.className + ' mt-2'}>
                {currentStatus.label}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 mt-6">
          {/* Contact Information */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">Kontaktinformation</h3>
            <div className="space-y-2">
              {application.email && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  <a href={`mailto:${application.email}`} className="hover:text-foreground transition-colors">
                    {application.email}
                  </a>
                </div>
              )}
              {application.phone && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-4 w-4" />
                  <a href={`tel:${application.phone}`} className="hover:text-foreground transition-colors">
                    {application.phone}
                  </a>
                </div>
              )}
              {application.location && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  <span>{application.location}</span>
                </div>
              )}
            </div>
          </div>

          {/* Personal Information */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">Personlig information</h3>
            <div className="grid grid-cols-2 gap-4">
              {application.age && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>{application.age} år</span>
                </div>
              )}
              {application.employment_status && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Briefcase className="h-4 w-4" />
                  <span>{application.employment_status}</span>
                </div>
              )}
            </div>
            {application.availability && (
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Tillgänglighet:</span> {application.availability}
              </p>
            )}
          </div>

          {/* Bio */}
          {application.bio && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">Om kandidaten</h3>
              <p className="text-muted-foreground whitespace-pre-wrap">{application.bio}</p>
            </div>
          )}

          {/* Custom Answers */}
          {application.custom_answers && Object.keys(application.custom_answers).length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">Ansökningssvar</h3>
              <div className="space-y-3">
                {Object.entries(application.custom_answers).map(([question, answer]) => (
                  <div key={question} className="bg-white/5 p-4 rounded-lg border border-white/10">
                    <p className="text-sm font-medium text-foreground mb-2">{question}</p>
                    <p className="text-sm text-muted-foreground">{String(answer)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CV & Documents */}
          {application.cv_url && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">Dokument</h3>
              <a
                href={application.cv_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors text-foreground"
              >
                <FileText className="h-4 w-4" />
                Visa CV
              </a>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-4 border-t border-white/10">
            <Button
              onClick={() => updateStatus('reviewing')}
              variant="outline"
              className="bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-300 border-yellow-500/30"
              disabled={application.status === 'reviewing'}
            >
              Sätt som granskas
            </Button>
            <Button
              onClick={() => updateStatus('accepted')}
              variant="outline"
              className="bg-green-500/10 hover:bg-green-500/20 text-green-300 border-green-500/30"
              disabled={application.status === 'accepted'}
            >
              Acceptera
            </Button>
            <Button
              onClick={() => updateStatus('rejected')}
              variant="outline"
              className="bg-red-500/10 hover:bg-red-500/20 text-red-300 border-red-500/30"
              disabled={application.status === 'rejected'}
            >
              Avvisa
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
