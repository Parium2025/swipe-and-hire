import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useHasActivePlan } from '@/hooks/useHasActivePlan';

export interface LibraryImage {
  id: string;
  storage_path: string;
  file_name: string | null;
  uploaded_by: string;
  created_at: string;
  url: string;
}

const publicUrl = (path: string) =>
  path.startsWith('http') ? path : supabase.storage.from('job-images').getPublicUrl(path).data.publicUrl;

/**
 * Bolagets gemensamma bildbibliotek (Växa och Pro).
 * Varje originalbild som laddas upp till en annons sparas här och kan
 * återanvändas av alla i samma organisation.
 */
export function useOrgImageLibrary() {
  const { user } = useAuth();
  const { tier, isOwner, loading: planLoading } = useHasActivePlan();
  const hasAccess = isOwner || tier === 'vaxa' || tier === 'pro';
  const qc = useQueryClient();

  const orgQuery = useQuery({
    queryKey: ['user-organization-id', user?.id],
    queryFn: async () => {
      const { data } = await supabase.rpc('get_user_organization_id', { p_user_id: user!.id });
      return (data as string | null) ?? null;
    },
    enabled: !!user && hasAccess,
    staleTime: 5 * 60_000,
  });
  const organizationId = orgQuery.data ?? null;
  const key = ['org-image-library', organizationId];

  const listQuery = useQuery({
    queryKey: key,
    queryFn: async (): Promise<LibraryImage[]> => {
      const { data, error } = await supabase
        .from('org_image_library')
        .select('id, storage_path, file_name, uploaded_by, created_at')
        .eq('organization_id', organizationId!)
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []).map((r) => ({ ...r, url: publicUrl(r.storage_path) }));
    },
    enabled: !!organizationId && hasAccess,
    staleTime: 30_000,
  });

  const addToLibrary = useCallback(
    async (storagePath: string, fileName?: string) => {
      if (!user || !hasAccess || !organizationId || !storagePath || storagePath.startsWith('http')) return;
      const { error } = await supabase
        .from('org_image_library')
        .upsert(
          { organization_id: organizationId, storage_path: storagePath, uploaded_by: user.id, file_name: fileName ?? null },
          { onConflict: 'organization_id,storage_path', ignoreDuplicates: true },
        );
      if (error) console.warn('[imageLibrary] add failed:', error.message);
      else qc.invalidateQueries({ queryKey: ['org-image-library', organizationId] });
    },
    [user, hasAccess, organizationId, qc],
  );

  const removeFromLibrary = useCallback(
    async (id: string) => {
      const previous = qc.getQueryData<LibraryImage[]>(key);
      qc.setQueryData<LibraryImage[]>(key, (old) => (old ?? []).filter((i) => i.id !== id));
      const { error } = await supabase.from('org_image_library').delete().eq('id', id);
      if (error) {
        qc.setQueryData(key, previous);
        throw error;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [qc, organizationId],
  );

  return {
    hasAccess: hasAccess && !!organizationId,
    loading: planLoading || orgQuery.isLoading || listQuery.isLoading,
    images: listQuery.data ?? [],
    addToLibrary,
    removeFromLibrary,
  };
}
