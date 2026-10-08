import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ReportContentButton } from '@/components/ReportContentButton';

type Message = { id: string; review_id: string; author_kind: 'reviewer' | 'company'; body: string; created_at: string };

const ERRORS: Record<string, string> = {
  not_authorized: 'Du har inte behörighet att svara i den här tråden.',
  no_company_reply: 'Tråden öppnas först när bolaget har svarat.',
  rate_limited: 'Du skickar för många svar. Vänta en stund och försök igen.',
  thread_full: 'Tråden har nått maxantalet svar.',
  message_too_long: 'Svaret får vara högst 1 000 tecken.',
};

/**
 * Tråd under bolagets svar. Bara recensenten och bolagets admin kan skriva;
 * alla inloggade läser. Behörigheten avgörs alltid i databasen.
 */
export function ReviewThread({ reviewId, canPost, viewer }: { reviewId: string; canPost: boolean; viewer: 'company' | 'reviewer' | null }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [draft, setDraft] = useState('');
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const key = ['review-thread', user?.id ?? 'anon', reviewId];

  const { data } = useQuery({
    queryKey: key,
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async () => {
      const [{ data: msgs, error }, { data: mine }] = await Promise.all([
        supabase.from('company_review_messages').select('id, review_id, author_kind, body, created_at').eq('review_id', reviewId).order('created_at'),
        supabase.rpc('my_company_review_message_ids', { _review_ids: [reviewId] }),
      ]);
      if (error) throw error;
      return { messages: (msgs ?? []) as Message[], mine: new Set<string>(((mine ?? []) as unknown as string[])) };
    },
  });
  const messages = data?.messages ?? [];

  const send = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    const { error } = await supabase.rpc('post_company_review_message', { _review_id: reviewId, _body: body });
    setSending(false);
    if (error) {
      const code = Object.keys(ERRORS).find((k) => error.message.includes(k));
      toast({ title: 'Kunde inte skicka svaret', description: code ? ERRORS[code] : 'Försök igen om en stund.', variant: 'destructive' });
      return;
    }
    setDraft('');
    setOpen(false);
    void qc.invalidateQueries({ queryKey: key });
  };

  const remove = async (id: string) => {
    const { error } = await supabase.rpc('delete_company_review_message', { _message_id: id });
    if (error) { toast({ title: 'Kunde inte ta bort svaret', description: 'Försök igen om en stund.', variant: 'destructive' }); return; }
    void qc.invalidateQueries({ queryKey: key });
  };

  const label = (m: Message) => {
    if (data?.mine.has(m.id)) return 'Du';
    if (m.author_kind === 'company') return viewer === 'company' ? 'Bolaget (kollega)' : 'Bolaget';
    return 'Recensenten';
  };

  if (!messages.length && !canPost) return null;

  return (
    <div className="mt-2 ml-3 pl-3 space-y-2">
      {messages.map((m) => (
        <div key={m.id} className="border-l-2 border-white/20 pl-3 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-white">{label(m)}</p>
            {!data?.mine.has(m.id) && <ReportContentButton target="message" reviewId={reviewId} messageId={m.id} />}
            {data?.mine.has(m.id) && (
              <button type="button" onClick={() => remove(m.id)} className="p-1.5 rounded-md text-white hover:bg-white/10 transition-colors" aria-label="Ta bort svar">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <p className="text-sm text-white whitespace-pre-line [overflow-wrap:anywhere]">{m.body}</p>
          <p className="text-xs text-white/60">{new Date(m.created_at).toLocaleDateString('sv-SE')}</p>
        </div>
      ))}
      {canPost && (open ? (
        <div className="space-y-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={viewer === 'company' ? 'Skriv ett svar till jobbsökaren…' : 'Skriv ett svar till bolaget…'}
            maxLength={1000}
            autoResize={false}
            className="h-[100px] min-h-[100px] max-h-[100px] overflow-y-auto bg-white/5 border-white/10 text-white text-base md:text-sm resize-none placeholder:text-white/40"
          />
          <div className="flex justify-end">
            <span className="text-[11px] tabular-nums text-white">{draft.length.toLocaleString('sv-SE')} / 1 000 tecken</span>
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => { setOpen(false); setDraft(''); }} disabled={sending} className="text-white">Avbryt</Button>
            <Button type="button" size="sm" onClick={send} disabled={sending || !draft.trim()} className="bg-white/10 hover:bg-white/15 border border-white/10 text-white">
              {sending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Skicka svar
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)} className="text-white px-2 h-8">Svara</Button>
      ))}
    </div>
  );
}
