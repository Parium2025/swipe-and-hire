import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { TeamMember } from '@/hooks/useTeamMembers';
import { UserCheck, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

interface AddToColleagueListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamMembers: TeamMember[];
  applicationId: string;
  applicantId: string;
  jobId?: string;
  candidateName: string;
}

export function AddToColleagueListDialog({
  open,
  onOpenChange,
  teamMembers,
  applicationId,
  applicantId,
  jobId,
  candidateName,
}: AddToColleagueListDialogProps) {
  const { user } = useAuth();
  const [isAdding, setIsAdding] = useState<string | null>(null);

  const handleAddToList = async (recruiterId: string, isOwnList: boolean) => {
    setIsAdding(recruiterId);
    try {
      const { error } = await supabase
        .from('my_candidates')
        .insert({
          recruiter_id: recruiterId,
          applicant_id: applicantId,
          application_id: applicationId,
          job_id: jobId || null,
          stage: 'to_contact',
        });

      if (error) {
        if (error.code === '23505') {
          toast.error(isOwnList ? 'Kandidaten finns redan i din lista' : 'Kandidaten finns redan i kollegans lista');
        } else {
          throw error;
        }
        return;
      }

      toast.success(isOwnList ? 'Kandidat tillagd i din lista' : 'Kandidat tillagd i kollegans lista');
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || 'Kunde inte lägga till kandidaten');
    } finally {
      setIsAdding(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card-parium border-white/20 max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Users className="h-5 w-5" />
            Lägg till kandidat
          </DialogTitle>
          <DialogDescription className="text-white/70">
            Välj vems kandidatlista <span className="font-medium text-white">{candidateName}</span> ska läggas till i.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 mt-4">
          {/* Own list */}
          {user && (
            <Button
              variant="outline"
              className="w-full justify-start gap-3 h-auto py-3 bg-white/5 border-white/20 text-white hover:bg-white/10 hover:text-white"
              onClick={() => handleAddToList(user.id, true)}
              disabled={isAdding !== null}
            >
              <UserCheck className="h-5 w-5 text-fuchsia-400" />
              <div className="text-left">
                <div className="font-medium">Min lista</div>
                <div className="text-xs text-white/60">Lägg till i din kandidatlista</div>
              </div>
              {isAdding === user.id && (
                <div className="ml-auto animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full" />
              )}
            </Button>
          )}

          {/* Team members */}
          {teamMembers.map(member => (
            <Button
              key={member.userId}
              variant="outline"
              className="w-full justify-start gap-3 h-auto py-3 bg-white/5 border-white/20 text-white hover:bg-white/10 hover:text-white"
              onClick={() => handleAddToList(member.userId, false)}
              disabled={isAdding !== null}
            >
              <Avatar className="h-8 w-8">
                <AvatarImage src={member.profileImageUrl || undefined} />
                <AvatarFallback className="text-xs bg-white/20">
                  {member.firstName?.[0]}{member.lastName?.[0]}
                </AvatarFallback>
              </Avatar>
              <div className="text-left">
                <div className="font-medium">{member.firstName} {member.lastName}</div>
                <div className="text-xs text-white/60">Lägg till i kollegans lista</div>
              </div>
              {isAdding === member.userId && (
                <div className="ml-auto animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full" />
              )}
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
