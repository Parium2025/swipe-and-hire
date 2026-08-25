import { supabase } from '@/integrations/supabase/client';
import { prefetchMediaUrl } from '@/hooks/useMediaUrl';

/**
 * Förvärmning av teammedlemmarnas profilbilder (aktivitetslogg, delningsdialog,
 * "Mina kandidater"-header).
 *
 * Kallstart var den enda kvarvarande luckan: signerad URL saknades i cache vid
 * första öppningen, så avatarerna "poppade in" efter initialerna. Här hämtar vi
 * organisationens medlemmar direkt vid app-start och signerar + dekodar bilderna
 * i exakt de storlekar TeamMemberAvatar begär (xs/sm/md), så första framen redan
 * har bilden i blob-cachen.
 */

// Samma pixelstorlekar som TeamMemberAvatar använder
const AVATAR_SIZES = [20, 32, 40] as const;

const warmed = new Set<string>();

export async function warmTeamAvatars(
  userId: string,
  organizationId?: string | null
): Promise<void> {
  try {
    const conn = (navigator as unknown as {
      connection?: { saveData?: boolean; effectiveType?: string };
    }).connection;
    if (conn?.saveData) return;
    if (conn?.effectiveType && /(^|-)2g$/.test(conn.effectiveType)) return;

    let memberIds: string[] = [userId];

    if (organizationId) {
      const { data: members } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('organization_id', organizationId)
        .eq('is_active', true);
      if (members?.length) {
        memberIds = [...new Set([userId, ...members.map((m) => m.user_id)])];
      }
    }

    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, profile_image_url')
      .in('user_id', memberIds.slice(0, 100));

    const paths = (profiles || [])
      .map((p) => p.profile_image_url)
      .filter((p): p is string => !!p && p.trim() !== '');

    for (const path of paths) {
      for (const size of AVATAR_SIZES) {
        const key = `${path}|${size}`;
        if (warmed.has(key)) continue;
        warmed.add(key);
        // Best-effort, sekventiellt per bild för att inte tränga undan
        // synliga bilder i signed-url-kön.
        await prefetchMediaUrl(path, 'profile-image', 86400, {
          width: size,
          height: size,
          resize: 'cover',
        }).catch(() => {
          warmed.delete(key);
        });
      }
    }
  } catch {
    /* warmup får aldrig störa UI */
  }
}

/**
 * Förvärmning av avatarer som dyker upp i en aktivitetslogg (kan inkludera
 * personer utanför organisationen, t.ex. tidigare kollegor).
 */
export function warmActivityAvatars(imagePaths: (string | null | undefined)[]): void {
  const unique = [...new Set(imagePaths.filter((p): p is string => !!p && p.trim() !== ''))];
  for (const path of unique) {
    for (const size of AVATAR_SIZES) {
      const key = `${path}|${size}`;
      if (warmed.has(key)) continue;
      warmed.add(key);
      void prefetchMediaUrl(path, 'profile-image', 86400, {
        width: size,
        height: size,
        resize: 'cover',
      }).catch(() => {
        warmed.delete(key);
      });
    }
  }
}
