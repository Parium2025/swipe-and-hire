import { supabase } from '@/integrations/supabase/client';
import { resolveCandidateMedia } from '@/lib/candidateMedia';
import { syncProfileMediaVersions } from '@/lib/profileMediaVersions';
import type { MyCandidateData } from '@/hooks/useMyCandidatesData';

/**
 * Delad hydrering för "Mina kandidater".
 *
 * Både den vanliga listningen och sökningen returnerar samma magra rader ur
 * `my_candidates`. Att berika dem (ansökan + profilmedia + aktivitet) såg
 * tidigare ut på två nästan identiska ställen i `useMyCandidatesData` — vilket
 * gjorde att buggfixar behövde göras dubbelt. Nu finns logiken exakt en gång.
 */
export interface RawMyCandidateRow {
  id: string;
  application_id: string;
  applicant_id: string;
  job_id: string | null;
  stage: string;
  notes: string | null;
  rating: number | null;
  created_at: string;
  updated_at: string;
}

const APPLICATION_FIELDS = `
  id, applicant_id, first_name, last_name, email, phone, location, bio,
  cv_url, age, employment_status, work_schedule, availability, custom_answers, questions_snapshot,
  candidate_profile_label, profile_image_snapshot_url, video_snapshot_url,
  status, applied_at, viewed_at, job_postings!inner(title)
`;

export async function hydrateMyCandidateRows(
  userId: string,
  rows: RawMyCandidateRow[],
): Promise<MyCandidateData[]> {
  if (rows.length === 0) return [];

  const applicationIds = [...new Set(rows.map(r => r.application_id))];
  const applicantIds = [...new Set(rows.map(r => r.applicant_id))];

  // Ansökningarna (fryst ögonblicksbild) + media + aktivitet hämtas parallellt.
  const [appsRes, mediaRes, activityRes, ratingsRes] = await Promise.all([
    supabase.from('job_applications').select(APPLICATION_FIELDS).in('id', applicationIds),
    supabase.rpc('get_applicant_profile_media_batch', {
      p_applicant_ids: applicantIds,
      p_employer_id: userId,
    }),
    supabase.rpc('get_applicant_latest_activity', {
      p_applicant_ids: applicantIds,
      p_employer_id: userId,
    }),
    // Betyget är per KANDIDAT (candidate_ratings), inte per rad i my_candidates.
    // Ligger samma kandidat i två listor hade bara den rad man satte betyg på
    // fått värdet — den andra visade noll stjärnor i dialogen.
    supabase
      .from('candidate_ratings')
      .select('applicant_id, rating')
      .eq('recruiter_id', userId)
      .in('applicant_id', applicantIds),
  ]);

  if (appsRes.error) throw appsRes.error;
  // Media är en obligatorisk del av kandidatkortet. Ett tillfälligt RPC-fel får
  // inte tyst bli null och sedan cachas som initialer.
  if (mediaRes.error) throw mediaRes.error;

  const ratingMap = new Map<string, number>(
    (ratingsRes.data || []).map((r: any) => [r.applicant_id, r.rating as number]),
  );

  const appMap = new Map((appsRes.data || []).map(app => [app.id, app]));

  const mediaMap: Record<string, {
    profile_image_url: string | null;
    video_url: string | null;
    is_profile_video: boolean | null;
    last_active_at: string | null;
  }> = {};
  if (Array.isArray(mediaRes.data)) {
    for (const row of mediaRes.data as any[]) {
      mediaMap[row.applicant_id] = {
        profile_image_url: row.profile_image_url,
        video_url: row.video_url,
        is_profile_video: row.is_profile_video,
        last_active_at: row.last_active_at || null,
      };
    }
    // Auto-invalidera bildcachen när kandidaten bytt profilbild/video
    syncProfileMediaVersions(mediaRes.data as any);
  }

  const activityMap: Record<string, { latest_application_at: string | null; last_active_at: string | null }> = {};
  if (Array.isArray(activityRes.data)) {
    for (const item of activityRes.data as any[]) {
      activityMap[item.applicant_id] = {
        latest_application_at: item.latest_application_at,
        last_active_at: item.last_active_at,
      };
    }
  }

  return rows.map(row => {
    const app = appMap.get(row.application_id) as any;
    const liveMedia = mediaMap[row.applicant_id] || {
      profile_image_url: null,
      video_url: null,
      is_profile_video: null,
      last_active_at: null,
    };
    const media = resolveCandidateMedia(app, liveMedia);
    const activity = activityMap[row.applicant_id] || { latest_application_at: null, last_active_at: null };

    return {
      id: row.id,
      recruiter_id: userId,
      applicant_id: row.applicant_id,
      application_id: row.application_id,
      job_id: row.job_id,
      stage: row.stage,
      notes: row.notes,
      rating: ratingMap.get(row.applicant_id) ?? row.rating ?? 0,
      created_at: row.created_at,
      updated_at: row.updated_at,
      first_name: app?.first_name || null,
      last_name: app?.last_name || null,
      email: app?.email || null,
      phone: app?.phone || null,
      location: app?.location || null,
      bio: app?.bio || null,
      cv_url: app?.cv_url || null,
      age: app?.age || null,
      employment_status: app?.employment_status || null,
      work_schedule: app?.work_schedule || null,
      availability: app?.availability || null,
      custom_answers: app?.custom_answers || null,
      questions_snapshot: app?.questions_snapshot || null,
      status: app?.status || 'pending',
      job_title: app?.job_postings?.title || null,
      profile_image_url: media.profile_image_url,
      video_url: media.video_url,
      is_profile_video: media.is_profile_video,
      applied_at: app?.applied_at || null,
      viewed_at: app?.viewed_at || null,
      latest_application_at: activity.latest_application_at,
      last_active_at: activity.last_active_at ?? liveMedia.last_active_at,
    } satisfies MyCandidateData;
  });
}
