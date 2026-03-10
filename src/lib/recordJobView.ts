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
 * OS detection from User-Agent string
 */
function detectOS(): string {
  const ua = navigator.userAgent;
  const hasTouchScreen = navigator.maxTouchPoints > 0;

  // iOS detection (iPhone/iPad/iPod)
  if (/iPad|iPhone|iPod/.test(ua)) return 'ios';
  // iPadOS reports as Macintosh but has touch
  if (/Macintosh/i.test(ua) && hasTouchScreen) return 'ios';
  // Android
  if (/Android/i.test(ua)) return 'android';
  // Windows
  if (/Windows NT/i.test(ua)) return 'windows';
  // macOS (after iPadOS check)
  if (/Macintosh|Mac OS X/i.test(ua)) return 'macos';
  // Linux (after Android check)
  if (/Linux/i.test(ua)) return 'linux';
  // ChromeOS
  if (/CrOS/i.test(ua)) return 'chromeos';

  return 'unknown';
}

/**
 * Records a job view — safe to call multiple times; the DB function handles deduplication.
 * Fire-and-forget: errors are logged but never thrown.
 */
export async function recordJobView(jobId: string, userId: string): Promise<void> {
  try {
    const deviceType = detectDeviceType();
    const osType = detectOS();
    const { error } = await supabase.rpc('record_job_view', {
      p_job_id: jobId,
      p_user_id: userId,
      p_device_type: deviceType,
      p_os_type: osType,
    } as any);
    if (error) console.error('recordJobView error:', error.message);
  } catch (err) {
    console.error('recordJobView failed:', err);
  }
}
