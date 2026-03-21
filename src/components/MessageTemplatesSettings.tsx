import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { MessageSquareText, Plus, Trash2, Save, Loader2, Star, GripVertical } from 'lucide-react';

interface MessageTemplate {
  id: string;
  employer_id: string;
  category: string;
  title: string;
  content: string;
  is_default: boolean;
  order_index: number;
  created_at: string;
  updated_at: string;
}

const DEFAULT_TEMPLATES = [
  {
    title: 'Professionellt avslag',
    content: 'Hej! Tack för att du sökte tjänsten "{job_title}". Efter noggrann genomgång av alla ansökningar har vi tyvärr valt att gå vidare med andra kandidater. Vi uppskattar ditt intresse och önskar dig lycka till i din jobbsökning! 🙏',
  },
  {
    title: 'Kort och vänligt',
    content: 'Hej! Vi vill meddela att tjänsten "{job_title}" nu är tillsatt. Tyvärr gick du inte vidare denna gång, men tack för ditt intresse! Vi sparar din profil och kontaktar dig gärna vid framtida möjligheter.',
  },
  {
    title: 'Uppmuntrande',
    content: 'Hej! Tack för din ansökan till "{job_title}". Konkurrensen var hård och vi har valt att gå vidare med en annan kandidat. Din profil var intressant och vi uppmuntrar dig att söka igen hos oss framöver. Lycka till! ✨',
  },
  {
    title: 'Med framtida möjligheter',
    content: 'Hej! Tjänsten "{job_title}" har nu tillsatts. Även om du inte gick vidare denna gång vill vi gärna behålla kontakten – vi kan komma att söka liknande profiler framöver. Tack för ditt intresse och tveka inte att höra av dig om du ser fler tjänster hos oss!',
  },
];

export function MessageTemplatesSettings() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ title: '', content: '' });
  const [showNew, setShowNew] = useState(false);
  const [newForm, setNewForm] = useState({ title: '', content: '' });

  useEffect(() => {
    if (user) fetchTemplates();
  }, [user]);

  const fetchTemplates = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('employer_message_templates')
      .select('*')
      .eq('employer_id', user.id)
      .eq('category', 'rejection')
      .order('order_index', { ascending: true });

    if (error) {
      console.error('Error fetching templates:', error);
    } else {
      setTemplates(data || []);
    }
    setLoading(false);
  };

  const seedDefaults = async () => {
    if (!user) return;
    setSaving(true);
    const toInsert = DEFAULT_TEMPLATES.map((t, i) => ({
      employer_id: user.id,
      category: 'rejection',
      title: t.title,
      content: t.content,
      is_default: i === 0,
      order_index: i,
    }));

    const { error } = await supabase
      .from('employer_message_templates')
      .insert(toInsert);

    if (error) {
      toast.error('Kunde inte skapa mallar');
    } else {
      toast.success('Standardmallar skapade!');
      fetchTemplates();
    }
    setSaving(false);
  };

  const handleSetDefault = async (templateId: string) => {
    if (!user) return;
    // Remove default from all
    await supabase
      .from('employer_message_templates')
      .update({ is_default: false })
      .eq('employer_id', user.id)
      .eq('category', 'rejection');

    // Set new default
    await supabase
      .from('employer_message_templates')
      .update({ is_default: true })
      .eq('id', templateId);

    setTemplates(prev =>
      prev.map(t => ({ ...t, is_default: t.id === templateId }))
    );
    toast.success('Standardmall uppdaterad');
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editForm.title.trim() || !editForm.content.trim()) return;
    setSaving(true);
    const { error } = await supabase
      .from('employer_message_templates')
      .update({ title: editForm.title.trim(), content: editForm.content.trim() })
      .eq('id', editingId);

    if (error) {
      toast.error('Kunde inte spara');
    } else {
      setTemplates(prev =>
        prev.map(t =>
          t.id === editingId ? { ...t, title: editForm.title.trim(), content: editForm.content.trim() } : t
        )
      );
      setEditingId(null);
      toast.success('Mall uppdaterad');
    }
    setSaving(false);
  };

  const handleCreate = async () => {
    if (!user || !newForm.title.trim() || !newForm.content.trim()) return;
    setSaving(true);
    const { error } = await supabase
      .from('employer_message_templates')
      .insert({
        employer_id: user.id,
        category: 'rejection',
        title: newForm.title.trim(),
        content: newForm.content.trim(),
        is_default: templates.length === 0,
        order_index: templates.length,
      });

    if (error) {
      toast.error('Kunde inte skapa mall');
    } else {
      setNewForm({ title: '', content: '' });
      setShowNew(false);
      toast.success('Mall skapad');
      fetchTemplates();
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from('employer_message_templates')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Kunde inte ta bort');
    } else {
      setTemplates(prev => prev.filter(t => t.id !== id));
      toast.success('Mall borttagen');
    }
  };

  return (
    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-6 md:p-4">
      <div className="flex items-center gap-2 mb-4">
        <MessageSquareText className="h-4 w-4 text-white" />
        <h3 className="text-sm font-medium text-white">Meddelandemallar</h3>
      </div>
      <p className="text-xs text-white mb-4">
        Skapa professionella svarsmallar som skickas automatiskt till kandidater när ett jobb avslutas.
        Mallen markerad med ⭐ används som standard. Använd <code className="text-white">{'{job_title}'}</code> för att infoga jobbtiteln.
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-white/40" />
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-6 space-y-3">
          <p className="text-sm text-white">Inga mallar ännu</p>
          <Button
            variant="glass"
            onClick={seedDefaults}
            disabled={saving}
            className="text-sm"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
            Skapa 4 standardmallar
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((template) => (
            <div
              key={template.id}
              className="bg-white/5 border border-white/10 rounded-lg p-3 space-y-2"
            >
              {editingId === template.id ? (
                <div className="space-y-2">
                  <Input
                    value={editForm.title}
                    onChange={(e) => setEditForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="Mallnamn"
                    className="bg-white/5 border-white/10 text-white text-sm h-8"
                  />
                  <Textarea
                    value={editForm.content}
                    onChange={(e) => setEditForm(f => ({ ...f, content: e.target.value }))}
                    placeholder="Meddelandetext..."
                    className="bg-white/5 border-white/10 text-white text-sm min-h-[80px]"
                  />
                  <div className="flex gap-2">
                    <Button variant="glass" size="sm" onClick={handleSaveEdit} disabled={saving}>
                      {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                      <span className="ml-1">Spara</span>
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setEditingId(null)} className="text-white/60">
                      Avbryt
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleSetDefault(template.id)}
                        className={`transition-colors ${template.is_default ? 'text-white' : 'text-white hover:text-white'}`}
                        title={template.is_default ? 'Standardmall' : 'Gör till standard'}
                      >
                        <Star className="h-4 w-4" fill={template.is_default ? 'currentColor' : 'none'} />
                      </button>
                      <span className="text-sm font-medium text-white">{template.title}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingId(template.id);
                          setEditForm({ title: template.title, content: template.content });
                        }}
                        className="text-white h-7 px-2 text-xs"
                      >
                        Redigera
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(template.id)}
                        className="text-white h-7 px-2"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-white line-clamp-2">{template.content}</p>
                </>
              )}
            </div>
          ))}

          {/* Add new template */}
          {showNew ? (
            <div className="bg-white/5 border border-white/10 rounded-lg p-3 space-y-2">
              <Input
                value={newForm.title}
                onChange={(e) => setNewForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Namn på mallen"
                className="bg-white/5 border-white/10 text-white text-sm h-8"
              />
              <Textarea
                value={newForm.content}
                onChange={(e) => setNewForm(f => ({ ...f, content: e.target.value }))}
                placeholder="Meddelandetext... Använd {job_title} för jobbtiteln"
                className="bg-white/5 border-white/10 text-white text-sm min-h-[80px]"
              />
              <div className="flex gap-2">
                <Button variant="glass" size="sm" onClick={handleCreate} disabled={saving || !newForm.title.trim() || !newForm.content.trim()}>
                  {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                  <span className="ml-1">Skapa</span>
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowNew(false)} className="text-white">
                  Avbryt
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowNew(true)}
              className="text-white w-full justify-center border border-dashed border-white/10"
            >
              <Plus className="h-3 w-3 mr-1" />
              Lägg till mall
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
