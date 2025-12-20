import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ApplicationData } from '@/hooks/useApplicationsData';
import { Mail, Phone, MapPin, Briefcase, Calendar, FileText, User, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { openCvFile } from '@/utils/cvUtils';
import { useMediaUrl } from '@/hooks/useMediaUrl';
import ProfileVideo from '@/components/ProfileVideo';
import { useState } from 'react';

function useProfileImageUrl(path: string | null | undefined) {
  return useMediaUrl(path, 'profile-image');
}

function useVideoUrl(path: string | null | undefined) {
  return useMediaUrl(path, 'profile-video');
}

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
  const [questionsExpanded, setQuestionsExpanded] = useState(true);
  
  // Move hooks to top level - they'll receive null/undefined when no application
  const profileImageUrl = useProfileImageUrl(application?.profile_image_url);
  const videoUrl = useVideoUrl(application?.video_url);
  
  if (!application) return null;

  const initials = `${application.first_name?.[0] || ''}${application.last_name?.[0] || ''}`.toUpperCase();
  const currentStatus = statusConfig[application.status as keyof typeof statusConfig] || statusConfig.pending;
  const isProfileVideo = application.is_profile_video && application.video_url;

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

  const customAnswers = application.custom_answers || {};
  const hasCustomAnswers = Object.keys(customAnswers).length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-background/95 backdrop-blur-xl border-white/10 p-0">
        {/* Header with job title and status */}
        <DialogHeader className="p-6 pb-0">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl md:text-2xl font-semibold text-foreground tracking-tight">
                {application.first_name} {application.last_name}
              </DialogTitle>
              <p className="text-muted-foreground mt-1">{application.job_title}</p>
            </div>
            <Badge variant="outline" className={currentStatus.className}>
              {currentStatus.label}
            </Badge>
          </div>
        </DialogHeader>

        <div className="p-6 pt-4 space-y-6">
          {/* Large Profile Image/Video Section */}
          <div className="flex justify-center">
            <div className="w-full max-w-md aspect-[3/4] rounded-2xl overflow-hidden bg-muted/30 border border-white/10">
              {isProfileVideo && videoUrl ? (
                <ProfileVideo
                  videoUrl={videoUrl}
                  coverImageUrl={profileImageUrl || undefined}
                  userInitials={initials}
                  className="w-full h-full"
                  showCountdown={true}
                  showProgressBar={true}
                />
              ) : profileImageUrl ? (
                <img 
                  src={profileImageUrl} 
                  alt={`${application.first_name} ${application.last_name}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center">
                  <span className="text-6xl font-bold text-foreground/70">{initials}</span>
                </div>
              )}
            </div>
          </div>

          {/* Glass info sections */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Contact Information Card */}
            <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-4 space-y-3">
              <h3 className="text-xs font-semibold text-primary uppercase tracking-wider flex items-center gap-2">
                <User className="h-3.5 w-3.5" />
                Kontaktinformation
              </h3>
              <div className="space-y-2.5">
                {application.email && (
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                    <a 
                      href={`mailto:${application.email}`} 
                      className="text-sm text-foreground hover:text-primary transition-colors truncate"
                    >
                      {application.email}
                    </a>
                  </div>
                )}
                {application.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                    <a 
                      href={`tel:${application.phone}`} 
                      className="text-sm text-foreground hover:text-primary transition-colors"
                    >
                      {application.phone}
                    </a>
                  </div>
                )}
                {application.location && (
                  <div className="flex items-center gap-3">
                    <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm text-foreground">{application.location}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Personal Information Card */}
            <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-4 space-y-3">
              <h3 className="text-xs font-semibold text-primary uppercase tracking-wider flex items-center gap-2">
                <Briefcase className="h-3.5 w-3.5" />
                Personlig information
              </h3>
              <div className="space-y-2.5">
                {application.age && (
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm text-foreground">{application.age} år</span>
                  </div>
                )}
                {application.employment_status && (
                  <div className="flex items-center gap-3">
                    <Briefcase className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm text-foreground">{application.employment_status}</span>
                  </div>
                )}
                {application.availability && (
                  <div className="flex items-center gap-3">
                    <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm text-foreground">{application.availability}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bio Section */}
          {application.bio && (
            <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-4 space-y-3">
              <h3 className="text-xs font-semibold text-primary uppercase tracking-wider">Om kandidaten</h3>
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{application.bio}</p>
            </div>
          )}

          {/* Questions & Answers Section - Collapsible */}
          {hasCustomAnswers && (
            <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden">
              <button 
                onClick={() => setQuestionsExpanded(!questionsExpanded)}
                className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
              >
                <h3 className="text-xs font-semibold text-primary uppercase tracking-wider">
                  Frågor ({Object.keys(customAnswers).length})
                </h3>
                {questionsExpanded ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
              
              {questionsExpanded && (
                <div className="px-4 pb-4 space-y-4">
                  {Object.entries(customAnswers).map(([question, answer], index) => (
                    <div 
                      key={question} 
                      className="border-t border-white/5 pt-4 first:border-t-0 first:pt-0"
                    >
                      <p className="text-sm font-medium text-foreground mb-1.5">{question}</p>
                      <p className="text-sm text-muted-foreground italic">
                        {String(answer) || <span className="opacity-50">Inget svar</span>}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* CV Button */}
          {application.cv_url && (
            <div className="flex justify-center">
              <button
                onClick={async (e) => {
                  e.preventDefault();
                  await openCvFile({
                    cvUrl: application.cv_url,
                    onSuccess: (message) => {
                      toast.success(message || 'CV öppnat i ny flik');
                    },
                    onError: (error) => {
                      toast.error(error.message || 'Kunde inte öppna CV');
                    }
                  });
                }}
                className="inline-flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl transition-all text-foreground cursor-pointer"
              >
                <FileText className="h-5 w-5" />
                <span className="font-medium">Visa CV</span>
              </button>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap justify-center gap-3 pt-4 border-t border-white/10">
            <Button
              onClick={() => updateStatus('reviewing')}
              variant="glassYellow"
              disabled={application.status === 'reviewing'}
              className="min-w-[140px]"
            >
              Granska
            </Button>
            <Button
              onClick={() => updateStatus('accepted')}
              variant="glassGreen"
              disabled={application.status === 'accepted'}
              className="min-w-[140px]"
            >
              Acceptera
            </Button>
            <Button
              onClick={() => updateStatus('rejected')}
              variant="glassRed"
              disabled={application.status === 'rejected'}
              className="min-w-[140px]"
            >
              Avvisa
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
