import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Flag, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

type Report = {
  report_id: string; target_type: 'review' | 'company_reply' | 'message'; review_id: string;
  message_id: string | null; content: string | null; company_name: string | null;
  reason: string | null; report_count: number; created_at: string;
};

const TYPE_LABEL: Record<Report['target_type'], string> = {
  review: 'Recension', company_reply: 'Bolagets svar', message: 'Inlägg i tråd',
};

/** Pariums administratör granskar anmälda recensioner, bolagssvar och trådinlägg. */
export function ReviewReportsAdmin() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['admin-review-reports'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_list_review_reports' as never);
      if (error) throw error;
      return (data ?? []) as unknown as Report[];
    },
  });

  const resolve = async (id: string, remove: boolean) => {
    setBusy(id);
    const { error } = await supabase.rpc('admin_resolve_review_report' as never, { _report_id: id, _remove: remove } as never);
    setBusy(null);
    if (error) { toast({ title: 'Åtgärden misslyckades', description: 'Försök igen om en stund.', variant: 'destructive' }); return; }
    toast({ title: remove ? 'Innehållet är borttaget' : 'Anmälan är avfärdad', description: remove ? 'Innehållet syns inte längre för någon.' : 'Innehållet ligger kvar.' });
    void qc.invalidateQueries({ queryKey: ['admin-review-reports'] });
  };

  return (
    <Card className="bg-white/10 backdrop-blur-sm border-white/20">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Flag className="h-5 w-5" />
          Anmälda recensioner ({reports.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-white" />
        ) : reports.length === 0 ? (
          <p className="text-sm text-white">Inga öppna anmälningar.</p>
        ) : reports.map((r) => (
          <div key={r.report_id} className="border border-white/10 rounded-lg p-3 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{TYPE_LABEL[r.target_type]}</Badge>
              {r.company_name && <span className="text-sm text-white">{r.company_name}</span>}
              <span className="text-xs text-white/60 ml-auto">
                {Number(r.report_count)} {Number(r.report_count) === 1 ? 'anmälan' : 'anmälningar'} · {new Date(r.created_at).toLocaleDateString('sv-SE')}
              </span>
            </div>
            <p className="text-sm text-white whitespace-pre-line [overflow-wrap:anywhere]">{r.content || 'Innehållet saknar text.'}</p>
            {r.reason && <p className="text-xs text-white/80 [overflow-wrap:anywhere]">Anledning: {r.reason}</p>}
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" className="text-white" disabled={busy === r.report_id} onClick={() => resolve(r.report_id, false)}>Avfärda</Button>
              <Button size="sm" variant="destructive" disabled={busy === r.report_id} onClick={() => resolve(r.report_id, true)}>
                {busy === r.report_id && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Ta bort innehållet
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
