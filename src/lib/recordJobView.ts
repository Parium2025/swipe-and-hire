import { supabase } from '@/integrations/supabase/client';

/**
 * Multi-signal device detection for analytics
 */
function detectDeviceType(): 'mobile' | 'tablet' | 'desktop' {
  const width = window.innerWidth;
  const ua = navigator.userAgent.toLowerCase();
  const hasTouchScreen = navigator.maxTouchPoints > 0;
  const hasCoarsePointer = window.matchMedia?.('(pointer: coarse)')?.matches ?? false;
  const isTabletUA = /ipad|tablet|playbook|silk|kindle|nexus\s?(7|9|10)/i.test(ua);
  const isIPadOS = /macintosh/i.test(ua) && hasTouchScreen;

  if (!hasTouchScreen && !hasCoarsePointer && width >= 1024) return 'desktop';
  if (isTabletUA || isIPadOS || (hasTouchScreen && width >= 768 && width < 1366)) return 'tablet';
  if (hasTouchScreen || hasCoarsePointer || width < 768) return 'mobile';
  return width < 768 ? 'mobile' : width < 1024 ? 'tablet' : 'desktop';
}

/**
 * Records a job view — safe to call multiple times; the DB function handles deduplication.
 * Fire-and-forget: errors are logged but never thrown.
 */
export async function recordJobView(jobId: string, userId: string): Promise<void> {
  try {
    const deviceType = detectDeviceType();
    const { error } = await supabase.rpc('record_job_view', {
      p_job_id: jobId,
      p_user_id: userId,
      p_device_type: deviceType,
    });
    if (error) console.error('recordJobView error:', error.message);
  } catch (err) {
    console.error('recordJobView failed:', err);
  }
}
