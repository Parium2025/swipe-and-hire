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
  
  // Get signed URLs for profile media
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-gradient-to-b from-[#1a2942] to-[#0f1a2a] border-white/10">
        <DialogHeader className="sr-only">
          <DialogTitle>Kandidatprofil: {application.first_name} {application.last_name}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Header with circular profile image/video */}
          <div className="flex flex-col items-center text-center space-y-4">
            {/* Circular Profile Image/Video - Larger */}
            <div className="relative">
              {isProfileVideo && videoUrl ? (
                <div className="w-40 h-40 md:w-48 md:h-48 rounded-full overflow-hidden border-4 border-white/20 shadow-xl">
                  <ProfileVideo
                    videoUrl={videoUrl}
                    coverImageUrl={profileImageUrl || undefined}
                    userInitials={initials}
                    className="w-full h-full"
                    showCountdown={true}
                    showProgressBar={false}
                  />
                </div>
              ) : (
                <Avatar className="w-40 h-40 md:w-48 md:h-48 border-4 border-white/20 shadow-xl">
                  <AvatarImage 
                    src={profileImageUrl || undefined} 
                    alt={`${application.first_name} ${application.last_name}`}
                    className="object-cover"
                  />
                  <AvatarFallback className="bg-white/10 text-white text-4xl md:text-5xl font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
            
            {/* Name and Job */}
            <div>
              <h2 className="text-2xl font-semibold text-white">
                {application.first_name} {application.last_name}
              </h2>
              <p className="text-white/70 mt-1">{application.job_title}</p>
              <Badge variant="outline" className={`${currentStatus.className} mt-2`}>
                {currentStatus.label}
              </Badge>
            </div>
          </div>

          {/* Info sections in glass cards */}
          <div className="grid gap-4">
            {/* Contact Information */}
            <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-4">
              <h3 className="text-xs font-semibold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                <User className="h-3.5 w-3.5" />
                Kontaktinformation
              </h3>
              <div className="grid sm:grid-cols-2 gap-3">
                {application.email && (
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-white/50 shrink-0" />
                    <a 
                      href={`mailto:${application.email}`} 
                      className="text-sm text-white hover:text-white/80 transition-colors truncate"
                    >
                      {application.email}
                    </a>
                  </div>
                )}
                {application.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-white/50 shrink-0" />
                    <a 
                      href={`tel:${application.phone}`} 
                      className="text-sm text-white hover:text-white/80 transition-colors"
                    >
                      {application.phone}
                    </a>
                  </div>
                )}
                {application.location && (
                  <div className="flex items-center gap-3">
                    <MapPin className="h-4 w-4 text-white/50 shrink-0" />
                    <span className="text-sm text-white">{application.location}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Personal Information */}
            <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-4">
              <h3 className="text-xs font-semibold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                <Briefcase className="h-3.5 w-3.5" />
                Personlig information
              </h3>
              <div className="grid sm:grid-cols-2 gap-3">
                {application.age && (
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-white/50 shrink-0" />
                    <span className="text-sm text-white">{application.age} år</span>
                  </div>
                )}
                {application.employment_status && (
                  <div className="flex items-center gap-3">
                    <Briefcase className="h-4 w-4 text-white/50 shrink-0" />
                    <span className="text-sm text-white">{application.employment_status}</span>
                  </div>
                )}
                {application.availability && (
                  <div className="flex items-center gap-3">
                    <Clock className="h-4 w-4 text-white/50 shrink-0" />
                    <span className="text-sm text-white">{application.availability}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Bio */}
            {application.bio && (
              <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-4">
                <h3 className="text-xs font-semibold text-white uppercase tracking-wider mb-3">
                  Om kandidaten
                </h3>
                <p className="text-sm text-white whitespace-pre-wrap leading-relaxed">
                  {application.bio}
                </p>
              </div>
            )}

            {/* Questions & Answers */}
            {hasCustomAnswers && (
              <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden">
                <button 
                  onClick={() => setQuestionsExpanded(!questionsExpanded)}
                  className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
                >
                  <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
                    Frågor ({Object.keys(customAnswers).length})
                  </h3>
                  {questionsExpanded ? (
                    <ChevronUp className="h-4 w-4 text-white/50" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-white/50" />
                  )}
                </button>
                
                {questionsExpanded && (
                  <div className="px-4 pb-4 space-y-4">
                    {Object.entries(customAnswers).map(([question, answer]) => (
                      <div 
                        key={question} 
                        className="border-t border-white/5 pt-4 first:border-t-0 first:pt-0"
                      >
                        <p className="text-sm font-medium text-white mb-1">{question}</p>
                        <p className="text-sm text-white/70">
                          {String(answer) || <span className="opacity-50 italic">Inget svar</span>}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* CV Button */}
            {application.cv_url && (
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
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl transition-all text-white"
              >
                <FileText className="h-5 w-5" />
                <span className="font-medium">Visa CV</span>
              </button>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap justify-center gap-3 pt-4 border-t border-white/10">
            <Button
              onClick={() => updateStatus('reviewing')}
              variant="glassYellow"
              disabled={application.status === 'reviewing'}
              size="lg"
            >
              Granska
            </Button>
            <Button
              onClick={() => updateStatus('accepted')}
              variant="glassGreen"
              disabled={application.status === 'accepted'}
              size="lg"
            >
              Acceptera
            </Button>
            <Button
              onClick={() => updateStatus('rejected')}
              variant="glassRed"
              disabled={application.status === 'rejected'}
              size="lg"
            >
              Avvisa
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
