import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTeamMembers } from '@/hooks/useTeamMembers';

export interface TeamCandidateInfo {
  applicant_id: string;
  application_id: string;
  recruiter_id: string;
  recruiter_name: string;
  rating: number;
  stage: string;
  notes: string | null;
}

/** Account-scoped persisted team info so "Added by colleague" badges render on the first frame after cold starts. */
export const TEAM_CANDIDATE_INFO_CACHE_PREFIX = 'parium_team_candidate_info_v1_';
function readPersisted(userId: string | undefined): Record<string, TeamCandidateInfo[]> {
  if (!userId) return {};
  try {
    const parsed = JSON.parse(localStorage.getItem(TEAM_CANDIDATE_INFO_CACHE_PREFIX + userId) || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, TeamCandidateInfo[]>
      : {};
  } catch { return {}; }
}
function writePersisted(userId: string, appIds: string[], fresh: Record<string, TeamCandidateInfo[]>) {
  try {
    const merged = readPersisted(userId);
    for (const id of appIds) {
      if (fresh[id]) merged[id] = fresh[id]; else delete merged[id];
    }
    const keys = Object.keys(merged);
    const trimmed: Record<string, TeamCandidateInfo[]> = {};
    keys.slice(-3000).forEach(k => { trimmed[k] = merged[k]; });
    localStorage.setItem(TEAM_CANDIDATE_INFO_CACHE_PREFIX + userId, JSON.stringify(trimmed));
  } catch { /* ignore quota */ }
}

/**
 * Hook to fetch info about which team members have added specific candidates
 * Uses persistent candidate_ratings and candidate_notes tables (survives remove/re-add)
 * Used to show "Added by colleague X" indicators, ratings, and notes in the candidates table
 */
export function useTeamCandidateInfo(applications: Array<{ id: string; applicant_id: string }>) {
  const { user } = useAuth();
  const { teamMembers } = useTeamMembers();
  const applicationIds = useMemo(() => applications.map(a => a.id), [applications]);
  const applicantKey = useMemo(() => [...new Set(applications.map(a => a.applicant_id).filter(Boolean))].sort().join(','), [applications]);
  const memberNamesKey = useMemo(() => teamMembers.map(m => `${m.userId}:${m.firstName ?? ''}:${m.lastName ?? ''}`).sort().join('|'), [teamMembers]);

  const { data: teamCandidates, isLoading } = useQuery({
    queryKey: ['team-candidate-info', user?.id, [...applicationIds].sort().join(','), applicantKey, memberNamesKey],
    queryFn: async () => {
      if (!user || applicationIds.length === 0) return {};

      // Raderna har redan applicant_id. En separat ansökningshämtning efter
      // att listan ritats ut fördröjde märkena varje gång vyn öppnades.
      const appToApplicant = Object.fromEntries(applications.map(a => [a.id, a.applicant_id]));
      const lookupApplicantIds = [...new Set(applications.map(a => a.applicant_id).filter(Boolean))];

      // Samma auktoriserade medlemslista som för övriga organisationsvyer.
      const { data: members, error: memberError } = await supabase.rpc('get_my_organization_member_profiles');
      if (memberError) throw memberError;
      const ownMembership = members?.find(m => m.user_id === user.id && m.is_active);
      const memberIds = ownMembership?.organization_id
        ? [...new Set((members ?? []).filter(m => m.is_active && m.organization_id === ownMembership.organization_id).map(m => m.user_id))]
        : [user.id];

      const myCandidatesData: Array<{ applicant_id: string; application_id: string; recruiter_id: string; rating: number | null; stage: string; notes: string | null }> = [];
      const seenRows = new Set<string>();
      const pushRows = (rows: typeof myCandidatesData | null) => {
        (rows ?? []).forEach(r => {
          const k = `${r.recruiter_id}:${r.applicant_id}`;
          if (!seenRows.has(k)) { seenRows.add(k); myCandidatesData.push(r); }
        });
      };
      const fetchBy = async (column: 'application_id' | 'applicant_id', values: string[]) => {
        for (let i = 0; i < values.length; i += 100) {
          const ids = values.slice(i, i + 100);
          for (let offset = 0; ; offset += 1000) {
            const { data, error } = await supabase
              .from('my_candidates')
              .select('applicant_id, application_id, recruiter_id, rating, stage, notes')
              .in(column, ids)
              .in('recruiter_id', memberIds)
              .range(offset, offset + 999);
            if (error) throw error;
            pushRows(data as any);
            if (!data || data.length < 1000) break;
          }
        }
      };
      // Legacy-rader utan applicant_id täcks av ansöknings-ID:t. De två
      // oberoende uppslagen behöver inte vänta på varandra.
      await Promise.all([fetchBy('applicant_id', lookupApplicantIds), fetchBy('application_id', applicationIds)]);

      const applicantIds = [...new Set(myCandidatesData.map(c => c.applicant_id))];
      if (applicantIds.length === 0) return {};

      // applicant -> alla visade ansökningar för den personen
      const applicantToApps: Record<string, string[]> = {};
      applicationIds.forEach(id => {
        const a = appToApplicant[id];
        if (a) (applicantToApps[a] ||= []).push(id);
      });

      // Fetch persistent ratings and notes in parallel
      // Create a lookup map for persistent ratings: applicant_id -> recruiter_id -> rating
      const persistentRatingMap: Record<string, Record<string, number>> = {};
      const persistentNotesMap: Record<string, Record<string, string>> = {};
      await Promise.all(applicantIds.reduce<Promise<void>[]>((requests, _, i) => {
        if (i % 100 !== 0) return requests;
        const ids = applicantIds.slice(i, i + 100);
        requests.push((async () => { for (let offset = 0; ; offset += 1000) {
          const { data: ratings, error } = await supabase.from('candidate_ratings')
            .select('applicant_id, recruiter_id, rating').in('applicant_id', ids).in('recruiter_id', memberIds).range(offset, offset + 999);
          if (error) throw error;
          ratings?.forEach(r => {
        if (!persistentRatingMap[r.applicant_id]) {
          persistentRatingMap[r.applicant_id] = {};
        }
        persistentRatingMap[r.applicant_id][r.recruiter_id] = r.rating;
      });
          if (!ratings || ratings.length < 1000) break;
        } })());
        requests.push((async () => { for (let offset = 0; ; offset += 1000) {
          const { data: notes, error } = await supabase.from('candidate_notes')
            .select('applicant_id, employer_id, note').is('job_id', null).in('applicant_id', ids).in('employer_id', memberIds).range(offset, offset + 999);
          if (error) throw error;
          notes?.forEach(n => {
        if (!persistentNotesMap[n.applicant_id]) {
          persistentNotesMap[n.applicant_id] = {};
        }
        persistentNotesMap[n.applicant_id][n.employer_id] = n.note;
      });
          if (!notes || notes.length < 1000) break;
        } })());
        return requests;
      }, []));

      // Create a map of application_id -> array of team members who have added it
      const infoMap: Record<string, TeamCandidateInfo[]> = {};

      // Create a recruiter name lookup
      const recruiterNames: Record<string, string> = {};
      teamMembers.forEach(member => {
        recruiterNames[member.userId] = `${member.firstName || ''} ${member.lastName || ''}`.trim() || 'Kollega';
      });
      // Add current user
      recruiterNames[user.id] = 'Du';

      myCandidatesData?.forEach(candidate => {
        const recruiterName = recruiterNames[candidate.recruiter_id] || 'Kollega';
        const persistentRating = persistentRatingMap[candidate.applicant_id]?.[candidate.recruiter_id];
        const effectiveRating = persistentRating ?? candidate.rating ?? 0;
        const persistentNotes = persistentNotesMap[candidate.applicant_id]?.[candidate.recruiter_id];
        const effectiveNotes = persistentNotes ?? candidate.notes ?? null;

        const targets = new Set(applicantToApps[candidate.applicant_id] ?? []);
        if (applicationIds.includes(candidate.application_id)) targets.add(candidate.application_id);
        targets.forEach(appId => {
          (infoMap[appId] ||= []).push({
            applicant_id: candidate.applicant_id,
            application_id: candidate.application_id,
            recruiter_id: candidate.recruiter_id,
            recruiter_name: recruiterName,
            rating: effectiveRating,
            stage: candidate.stage,
            notes: effectiveNotes,
          });
        });
      });

      // Spara senaste teaminfo per konto så märket finns på plats från första steg vid kallstart.
      writePersisted(user.id, applicationIds, infoMap);
      return infoMap;
    },
    enabled: !!user && applicationIds.length > 0,
    staleTime: 30000,
  });

  // Senaste kända teaminfo för kontot: visas tills det nya svaret kommer fram
  // och när sidnumrering byter frågens nyckel under pågående hämtning.
  const persisted = useMemo(() => readPersisted(user?.id), [user?.id, teamCandidates]);

  return {
    teamCandidates: { ...persisted, ...teamCandidates },
    isLoading,
  };
}
