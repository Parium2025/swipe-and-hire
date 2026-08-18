import { useMemo, useState } from 'react';
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DialogContentNoFocus } from '@/components/ui/dialog-no-focus';
import { Button } from '@/components/ui/button';
import { ResolvedAvatar } from '@/components/ui/resolved-avatar';
import { TeamMember } from '@/hooks/useTeamMembers';
import { UserCheck, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useQueryClient } from '@tanstack/react-query';
import { useCandidateLists, useTeamCandidateLists } from '@/hooks/useCandidateLists';

export interface CandidateToAdd {
  applicationId: string;
  applicantId: string;
  jobId?: string | null;
}

interface AddToColleagueListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamMembers: TeamMember[];
  /** Enstaka kandidat (bakåtkompatibelt) */
  applicationId?: string;
  applicantId?: string;
  jobId?: string;
  candidateName: string;
  /** Bulk: flera kandidater samtidigt. Har företräde framför fälten ovan. */
  candidates?: CandidateToAdd[];
  onAdded?: () => void;
}

export function AddToColleagueListDialog({
  open,
  onOpenChange,
  teamMembers,
  applicationId,
  applicantId,
  jobId,
  candidateName,
  candidates,
  onAdded,
}: AddToColleagueListDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState<string | null>(null);

  const rows: CandidateToAdd[] = useMemo(() => {
    if (candidates && candidates.length > 0) return candidates;
    if (applicationId && applicantId) return [{ applicationId, applicantId, jobId: jobId ?? null }];
    return [];
  }, [candidates, applicationId, applicantId, jobId]);

  const { lists: ownLists } = useCandidateLists(user?.id ?? null, { ensureDefault: true });
  const teamOwnerIds = useMemo(() => teamMembers.map((m) => m.userId), [teamMembers]);
  const teamLists = useTeamCandidateLists(teamOwnerIds);

  const handleAdd = async (recruiterId: string, listId: string | null, key: string, isOwnList: boolean) => {
    if (rows.length === 0) return;
    setIsAdding(key);
    try {
      // 1) Hitta första giltiga steget i mållistan (annars hamnar korten i ett steg som inte visas)
      const { data: stageSettings } = await supabase
        .from('user_stage_settings')
        .select('stage_key, order_index')
        .eq('user_id', recruiterId)
        .eq('list_id', listId)
        .gt('order_index', -1)
        .order('order_index', { ascending: true })
        .limit(1);

      const defaultStage = stageSettings?.[0]?.stage_key || 'to_contact';

      // 2) Kolla vilka kandidater som redan finns hos mottagaren (per person, inte per ansökan)
      const applicantIds = Array.from(new Set(rows.map((r) => r.applicantId)));
      const { data: existing } = await supabase
        .from('my_candidates')
        .select('id, applicant_id, application_id, list_id')
        .eq('recruiter_id', recruiterId)
        .in('applicant_id', applicantIds);

      const existingByApplicant = new Map<string, { id: string; list_id: string | null }[]>();
      (existing ?? []).forEach((e) => {
        const arr = existingByApplicant.get(e.applicant_id) ?? [];
        arr.push({ id: e.id, list_id: e.list_id });
        existingByApplicant.set(e.applicant_id, arr);
      });

      let added = 0;
      let moved = 0;
      let duplicates = 0;

      for (const applicantId of applicantIds) {
        const current = existingByApplicant.get(applicantId);

        if (current && current.length > 0) {
          const alreadyInTarget = current.every((c) => c.list_id === listId);
          if (alreadyInTarget) {
            duplicates += 1;
            continue;
          }
          // Flytta befintliga kort till den valda listan (en kandidat = en lista)
          const { error: moveError } = await supabase
            .from('my_candidates')
            .update({ list_id: listId, stage: defaultStage })
            .in('id', current.map((c) => c.id));
          if (moveError) throw moveError;
          moved += 1;
          continue;
        }

        const row = rows.find((r) => r.applicantId === applicantId)!;
        const { error } = await supabase.from('my_candidates').insert({
          recruiter_id: recruiterId,
          applicant_id: row.applicantId,
          application_id: row.applicationId,
          job_id: row.jobId || null,
          list_id: listId,
          stage: defaultStage,
        });

        if (error) {
          if (error.code === '23505') {
            duplicates += 1;
            continue;
          }
          throw error;
        }
        added += 1;
      }

      queryClient.invalidateQueries({ queryKey: ['my-candidates'] });
      queryClient.invalidateQueries({ queryKey: ['candidate-list-counts'] });

      const target = isOwnList ? 'din lista' : 'kollegans lista';

      if (added === 0 && moved === 0) {
        toast.error(
          applicantIds.length === 1
            ? `Kandidaten finns redan i ${target}`
            : `Alla valda kandidater finns redan i listan`,
        );
      } else {
        const parts: string[] = [];
        if (added > 0) parts.push(`${added} tillagd${added !== 1 ? 'a' : ''}`);
        if (moved > 0) parts.push(`${moved} flyttad${moved !== 1 ? 'e' : ''}`);
        if (duplicates > 0) parts.push(`${duplicates} fanns redan`);

        toast.success(
          applicantIds.length === 1 && moved === 0 && duplicates === 0
            ? `Kandidat tillagd i ${target}`
            : `${parts.join(', ')}`,
        );
        onAdded?.();
      }

      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || 'Kunde inte lägga till kandidaten');
    } finally {
      setIsAdding(null);
    }
  };

  const buttonClass =
    'w-full justify-start gap-3 h-auto py-3 bg-white/5 border-white/20 text-white hover:bg-white/10 hover:text-white transition-colors duration-300 outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 [-webkit-tap-highlight-color:transparent]';

  const title = rows.length > 1 ? `Lägg till ${rows.length} kandidater` : 'Lägg till kandidat';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContentNoFocus className="bg-card-parium border-white/20 max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Users className="h-5 w-5" />
            {title}
          </DialogTitle>
          <DialogDescription className="text-white">
            {rows.length > 1 ? (
              <>Välj vilken lista kandidaterna ska läggas till i.</>
            ) : (
              <>
                Välj vilken lista <span className="font-medium text-white">{candidateName}</span> ska läggas till i.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 mt-4 max-h-[55vh] overflow-y-auto pr-1">
          {/* Egna listor */}
          {user &&
            (ownLists.length > 0
              ? ownLists.map((list) => (
                  <Button
                    key={list.id}
                    variant="outline"
                    className={buttonClass}
                    onClick={() => handleAdd(user.id, list.id, `own:${list.id}`, true)}
                    onPointerDown={(e) => e.preventDefault()}
                    disabled={isAdding !== null}
                  >
                    <UserCheck className="h-5 w-5 text-white flex-shrink-0" />
                    <div className="text-left min-w-0">
                      <div className="font-medium break-words">{list.name}</div>
                      <div className="text-xs text-white">Min lista</div>
                    </div>
                    {isAdding === `own:${list.id}` && (
                      <div className="ml-auto animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full" />
                    )}
                  </Button>
                ))
              : (
                  <Button
                    variant="outline"
                    className={buttonClass}
                    onClick={() => handleAdd(user.id, null, 'own:default', true)}
                    onPointerDown={(e) => e.preventDefault()}
                    disabled={isAdding !== null}
                  >
                    <UserCheck className="h-5 w-5 text-white flex-shrink-0" />
                    <div className="text-left">
                      <div className="font-medium">Mina kandidater</div>
                      <div className="text-xs text-white">Min lista</div>
                    </div>
                    {isAdding === 'own:default' && (
                      <div className="ml-auto animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full" />
                    )}
                  </Button>
                ))}

          {/* Kollegornas listor */}
          {teamMembers.map((member) => {
            const memberLists = teamLists[member.userId] ?? [];
            const entries = memberLists.length > 0
              ? memberLists.map((l) => ({ id: l.id as string | null, name: l.name }))
              : [{ id: null as string | null, name: 'Kandidatlista' }];

            return entries.map((entry) => {
              const key = `${member.userId}:${entry.id ?? 'default'}`;
              return (
                <Button
                  key={key}
                  variant="outline"
                  className={buttonClass}
                  onClick={() => handleAdd(member.userId, entry.id, key, false)}
                  onPointerDown={(e) => e.preventDefault()}
                  disabled={isAdding !== null}
                >
                  <ResolvedAvatar
                    src={member.profileImageUrl}
                    mediaType="profile-image"
                    fallback={`${member.firstName?.[0] || ''}${member.lastName?.[0] || ''}`}
                    className="h-8 w-8 flex-shrink-0"
                    fallbackClassName="text-xs bg-white/20"
                  />
                  <div className="text-left min-w-0">
                    <div className="font-medium break-words">{entry.name}</div>
                    <div className="text-xs text-white">
                      {member.firstName} {member.lastName}
                    </div>
                  </div>
                  {isAdding === key && (
                    <div className="ml-auto animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full" />
                  )}
                </Button>
              );
            });
          })}
        </div>
      </DialogContentNoFocus>
    </Dialog>
  );
}
