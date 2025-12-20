import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ApplicationData } from '@/hooks/useApplicationsData';
import { Mail, Phone, MapPin, Briefcase, Calendar, FileText, User, Clock, ChevronDown, ChevronUp, StickyNote, Send, Trash2, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useMediaUrl } from '@/hooks/useMediaUrl';
import ProfileVideo from '@/components/ProfileVideo';
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Textarea } from '@/components/ui/textarea';
import { CvViewer } from '@/components/CvViewer';

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

interface CandidateNote {
  id: string;
  note: string;
  created_at: string;
}

export const CandidateProfileDialog = ({
  application,
  open,
  onOpenChange,
  onStatusUpdate,
}: CandidateProfileDialogProps) => {
  const { user } = useAuth();
  const [questionsExpanded, setQuestionsExpanded] = useState(true);
  const [notesExpanded, setNotesExpanded] = useState(true);
  const [notes, setNotes] = useState<CandidateNote[]>([]);
  const [newNote, setNewNote] = useState('');
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [cvOpen, setCvOpen] = useState(false);
  
  // Get signed URLs for profile media
  const profileImageUrl = useProfileImageUrl(application?.profile_image_url);
  const videoUrl = useVideoUrl(application?.video_url);
  const signedCvUrl = useMediaUrl(application?.cv_url, 'cv');

  // Fetch notes when dialog opens
  useEffect(() => {
    if (open && application && user) {
      fetchNotes();
    }
  }, [open, application?.id, user?.id]);

  const fetchNotes = async () => {
    if (!application || !user) return;
    setLoadingNotes(true);
    try {
      const { data, error } = await supabase
        .from('candidate_notes')
        .select('id, note, created_at')
        .eq('employer_id', user.id)
        .eq('applicant_id', application.applicant_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotes(data || []);
    } catch (error) {
      console.error('Error fetching notes:', error);
    } finally {
      setLoadingNotes(false);
    }
  };

  const saveNote = async () => {
    if (!newNote.trim() || !application || !user) return;
    setSavingNote(true);
    try {
      const { error } = await supabase
        .from('candidate_notes')
        .insert({
          employer_id: user.id,
          applicant_id: application.applicant_id,
          job_id: application.job_id,
          note: newNote.trim()
        });

      if (error) throw error;
      toast.success('Anteckning sparad');
      setNewNote('');
      fetchNotes();
    } catch (error) {
      console.error('Error saving note:', error);
      toast.error('Kunde inte spara anteckning');
    } finally {
      setSavingNote(false);
    }
  };

  const deleteNote = async (noteId: string) => {
    try {
      const { error } = await supabase
        .from('candidate_notes')
        .delete()
        .eq('id', noteId);

      if (error) throw error;
      toast.success('Anteckning borttagen');
      setNotes(notes.filter(n => n.id !== noteId));
    } catch (error) {
      console.error('Error deleting note:', error);
      toast.error('Kunde inte ta bort anteckning');
    }
  };
  
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-card-parium backdrop-blur-md border-white/20 text-white">
        <DialogHeader className="sr-only">
          <DialogTitle>Kandidatprofil: {application.first_name} {application.last_name}</DialogTitle>
          <DialogDescription>Visa kandidatens profilinformation och ansökan</DialogDescription>
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

          {/* Info sections - matching job dialog input style exactly */}
          <div className="grid gap-4">
            {/* Information */}
            <div className="bg-white/10 border border-white/20 rounded-xl p-4">
              <h3 className="text-xs font-semibold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                <User className="h-3.5 w-3.5" />
                Information
              </h3>
              <div className="grid sm:grid-cols-2 gap-3">
                {application.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-white shrink-0" />
                    <a
                      href={`mailto:${application.email}`}
                      className="text-sm text-white hover:text-white/80 transition-colors truncate"
                    >
                      {application.email}
                    </a>
                  </div>
                )}
                {application.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-white shrink-0" />
                    <a
                      href={`tel:${application.phone}`}
                      className="text-sm text-white hover:text-white/80 transition-colors"
                    >
                      {application.phone}
                    </a>
                  </div>
                )}
                {application.location && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-white shrink-0" />
                    <span className="text-sm text-white">{application.location}</span>
                  </div>
                )}
                {application.age && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-white shrink-0" />
                    <span className="text-sm text-white">{application.age} år</span>
                  </div>
                )}
              </div>
            </div>

            {/* Anställningsinformation */}
            {(application.employment_status || application.work_schedule || application.availability) && (
              <div className="bg-white/10 border border-white/20 rounded-xl p-4">
                <h3 className="text-xs font-semibold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Briefcase className="h-3.5 w-3.5" />
                  Anställningsinformation
                </h3>
                <div className="grid sm:grid-cols-2 gap-3">
                {application.employment_status && (
                    <div className="space-y-0.5">
                      <span className="text-xs text-white">Anställningsstatus</span>
                      <p className="text-sm text-white font-medium">{application.employment_status}</p>
                    </div>
                  )}
                  {application.work_schedule && (
                    <div className="space-y-0.5">
                      <span className="text-xs text-white">Hur mycket jobbar du idag?</span>
                      <p className="text-sm text-white font-medium">{application.work_schedule}</p>
                    </div>
                  )}
                  {application.availability && (
                    <div className="space-y-0.5 sm:col-span-2">
                      <span className="text-xs text-white">När kan du börja nytt jobb?</span>
                      <p className="text-sm text-white font-medium">{application.availability}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* CV Section - matching profile page style with dialog */}
            {application.cv_url && (
              <div className="bg-white/10 border border-white/20 rounded-xl p-4">
                <h3 className="text-xs font-semibold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5" />
                  CV
                </h3>
                <div className="w-full min-h-9 py-2.5 bg-white/5 border border-white/10 rounded-md flex items-center px-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setCvOpen(true)}
                    className="flex items-center gap-2 text-white transition-colors flex-1"
                  >
                    <FileText className="h-4 w-4 text-white shrink-0" />
                    <span className="text-sm">Visa CV</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCvOpen(true)}
                    className="text-white hover:text-white/80 transition-colors"
                    title="Öppna CV"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Presentation om kandidaten */}
            <div className="bg-white/10 border border-white/20 rounded-xl p-4">
              <h3 className="text-xs font-semibold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                <User className="h-3.5 w-3.5" />
                Presentation om {application.first_name || 'kandidaten'}
              </h3>
              {application.bio ? (
                <p className="text-sm text-white whitespace-pre-wrap leading-relaxed">
                  {application.bio}
                </p>
              ) : (
                <p className="text-sm text-white/50 italic">Ingen presentation angiven</p>
              )}
            </div>

            {/* Questions & Answers */}
            {hasCustomAnswers && (
              <div className="bg-white/10 border border-white/20 rounded-xl overflow-hidden">
                <button
                  onClick={() => setQuestionsExpanded(!questionsExpanded)}
                  className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
                >
                  <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
                    Frågor ({Object.keys(customAnswers).length})
                  </h3>
                  {questionsExpanded ? (
                    <ChevronUp className="h-4 w-4 text-white" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-white" />
                  )}
                </button>

                {questionsExpanded && (
                  <div className="px-4 pb-4 space-y-3">
                    {Object.entries(customAnswers).map(([question, answer]) => (
                      <div
                        key={question}
                        className="border-t border-white/10 pt-3 first:border-t-0 first:pt-0"
                      >
                        <p className="text-sm font-medium text-white mb-0.5">{question}</p>
                        <p className="text-sm text-white">
                          {String(answer) || <span className="opacity-50 italic">Inget svar</span>}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Notes Section */}
            <div className="bg-white/10 border border-white/20 rounded-xl overflow-hidden">
              <button 
                onClick={() => setNotesExpanded(!notesExpanded)}
                className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
              >
                <h3 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                  <StickyNote className="h-3.5 w-3.5" />
                  Anteckningar ({notes.length})
                </h3>
                {notesExpanded ? (
                  <ChevronUp className="h-4 w-4 text-white" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-white" />
                )}
              </button>
              
              {notesExpanded && (
                <div className="px-4 pb-4 space-y-3">
                  {/* Add new note */}
                  <div className="flex gap-2">
                    <Textarea
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      placeholder="Skriv en anteckning om kandidaten..."
                      className="flex-1 min-h-[60px] bg-white/5 border-white/20 text-white placeholder:text-white/40 resize-none"
                    />
                    <Button
                      onClick={saveNote}
                      disabled={!newNote.trim() || savingNote}
                      size="icon"
                      className="h-[60px] w-10 bg-white/10 hover:bg-white/20 border border-white/20"
                    >
                      <Send className="h-4 w-4 text-white" />
                    </Button>
                  </div>

                  {/* Existing notes */}
                  {loadingNotes ? (
                    <p className="text-sm text-white/50 text-center py-2">Laddar...</p>
                  ) : notes.length === 0 ? (
                    <p className="text-sm text-white/50 text-center py-2">Inga anteckningar ännu</p>
                  ) : (
                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                      {notes.map((note) => (
                        <div 
                          key={note.id}
                          className="bg-white/5 rounded-lg p-3 group relative"
                        >
                          <p className="text-sm text-white whitespace-pre-wrap pr-6">{note.note}</p>
                          <p className="text-xs text-white/40 mt-1">
                            {new Date(note.created_at).toLocaleDateString('sv-SE', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                          <button
                            onClick={() => deleteNote(note.id)}
                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-white/10 rounded"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-white/50 hover:text-red-400" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap justify-center gap-3 pt-4 border-t border-white/20">
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

      {/* CV Dialog - matching profile page exactly */}
      <Dialog open={cvOpen} onOpenChange={setCvOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden bg-transparent border-none shadow-none p-8">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-white text-2xl">CV</DialogTitle>
          </DialogHeader>
          {application?.cv_url && signedCvUrl && (
            <CvViewer 
              src={signedCvUrl} 
              fileName="cv.pdf" 
              height="70vh"
              onClose={() => setCvOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </Dialog>
  );
};
