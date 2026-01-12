import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useTeamMembers } from '@/hooks/useTeamMembers';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useState } from 'react';
import { Loader2, Check, Users } from 'lucide-react';
import { useMediaUrl } from '@/hooks/useMediaUrl';

interface ShareCandidateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicantId: string;
  applicationId: string;
  jobId: string | null;
  candidateName: string;
}

function TeamMemberAvatar({ imageUrl }: { imageUrl: string | null }) {
  const resolvedUrl = useMediaUrl(imageUrl, 'profile-image');
  return (
    <Avatar className="h-10 w-10">
      <AvatarImage src={resolvedUrl || undefined} />
      <AvatarFallback className="bg-white/10 text-white">?</AvatarFallback>
    </Avatar>
  );
}

export function ShareCandidateDialog({
  open,
  onOpenChange,
  applicantId,
  applicationId,
  jobId,
  candidateName,
}: ShareCandidateDialogProps) {
  const { teamMembers, hasTeam, isLoading } = useTeamMembers();
  const [sharing, setSharing] = useState<string | null>(null);
  const [shared, setShared] = useState<Set<string>>(new Set());

  const handleShare = async (memberId: string, memberName: string) => {
    setSharing(memberId);
    try {
      // Check if already in their list
      const { data: existing } = await supabase
        .from('my_candidates')
        .select('id')
        .eq('recruiter_id', memberId)
        .eq('applicant_id', applicantId)
        .maybeSingle();

      if (existing) {
        toast.info(`${candidateName} finns redan i ${memberName}s lista`);
        setShared(prev => new Set([...prev, memberId]));
        return;
      }

      // Add to their my_candidates
      const { error } = await supabase
        .from('my_candidates')
        .insert({
          recruiter_id: memberId,
          applicant_id: applicantId,
          application_id: applicationId,
          job_id: jobId,
          stage: 'inbox',
        });

      if (error) throw error;

      setShared(prev => new Set([...prev, memberId]));
      toast.success(`${candidateName} delad med ${memberName}`);
    } catch (error) {
      console.error('Error sharing candidate:', error);
      toast.error('Kunde inte dela kandidat');
    } finally {
      setSharing(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-white/10 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Dela kandidat
          </DialogTitle>
          <DialogDescription className="text-white/60">
            Dela {candidateName} med en kollega
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-white/50" />
            </div>
          ) : !hasTeam ? (
            <p className="text-center text-white/50 py-4">
              Du har inga kollegor i samma organisation att dela med.
            </p>
          ) : (
            <div className="space-y-2">
              {teamMembers.map(member => {
                const fullName = [member.firstName, member.lastName].filter(Boolean).join(' ') || 'Okänd';
                const isShared = shared.has(member.userId);
                const isSharing = sharing === member.userId;

                return (
                  <div
                    key={member.userId}
                    className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <TeamMemberAvatar imageUrl={member.profileImageUrl} />
                      <span className="text-white font-medium">{fullName}</span>
                    </div>
                    <Button
                      size="sm"
                      variant={isShared ? 'outline' : 'glassBlue'}
                      disabled={isSharing || isShared}
                      onClick={() => handleShare(member.userId, fullName)}
                    >
                      {isSharing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : isShared ? (
                        <>
                          <Check className="h-4 w-4 mr-1" />
                          Delad
                        </>
                      ) : (
                        'Dela'
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Stäng
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
