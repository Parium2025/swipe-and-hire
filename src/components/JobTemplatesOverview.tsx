import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useOnline } from '@/hooks/useOnlineStatus';
import { Plus, Edit, Trash2, Calendar, Loader2, Star, StarOff, AlertTriangle } from 'lucide-react';
import { SKELETON_COUNT_KEYS, readCachedCount, writeCachedCount } from '@/lib/skeletonCounts';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertDialogContentNoFocus } from '@/components/ui/alert-dialog-no-focus';
import { TruncatedText } from '@/components/TruncatedText';
import CreateTemplateWizard from '@/components/CreateTemplateWizard';

interface JobTemplate {
  id: string;
  name: string;
  title: string;
  description: string;
  requirements?: string;
  location: string;
  employment_type?: string;
  work_schedule?: string;
  salary_min?: number;
  salary_max?: number;
  contact_email?: string;
  application_instructions?: string;
  category?: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

const JobTemplatesOverview = () => {
  const [templates, setTemplates] = useState<JobTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<JobTemplate | null>(null);

  const { user } = useAuth();
  const { toast } = useToast();
  const { isOnline, showOfflineToast } = useOnline();

  const fetchTemplates = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('job_templates')
        .select('*')
        .eq('employer_id', user.id)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        toast({
          title: "Fel vid hämtning av mallar",
          description: error.message,
          variant: "destructive"
        });
        return;
      }

      setTemplates(data || []);
      writeCachedCount(SKELETON_COUNT_KEYS.jobTemplates, (data || []).length);
    } catch (error) {
      toast({
        title: "Ett fel uppstod",
        description: "Kunde inte hämta jobbmallar.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, [user]);

  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const { id: templateId, name: templateName } = deleteTarget;
    setDeleteTarget(null);
    

    try {
      const { error } = await supabase
        .from('job_templates')
        .delete()
        .eq('id', templateId);

      if (error) {
        toast({
          title: "Fel vid borttagning",
          description: error.message,
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Mall borttagen",
        description: `Mallen "${templateName}" har tagits bort.`
      });

      fetchTemplates();
    } catch (error) {
      toast({
        title: "Ett fel uppstod",
        description: "Kunde inte ta bort mallen.",
        variant: "destructive"
      });
    }
  };

  const toggleDefault = async (templateId: string) => {
    
    try {
      // First, remove default status from all templates
      await supabase
        .from('job_templates')
        .update({ is_default: false })
        .eq('employer_id', user?.id);

      // Then set the selected template as default
      const { error } = await supabase
        .from('job_templates')
        .update({ is_default: true })
        .eq('id', templateId);

      if (error) {
        toast({
          title: "Fel vid uppdatering",
          description: error.message,
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Standardmall uppdaterad",
        description: "Den nya standardmallen har sparats."
      });

      fetchTemplates();
    } catch (error) {
      toast({
        title: "Ett fel uppstod",
        description: "Kunde inte uppdatera standardmall.",
        variant: "destructive"
      });
    }
  };

  const startEdit = (template: JobTemplate) => {
    setEditingTemplate(template);
    setShowEditDialog(true);
  };

  const formatSalary = (min?: number, max?: number) => {
    if (!min && !max) return 'Ej angivet';
    if (min && max) return `${min.toLocaleString()} - ${max.toLocaleString()} kr/mån`;
    if (min) return `Från ${min.toLocaleString()} kr/mån`;
    if (max) return `Upp till ${max.toLocaleString()} kr/mån`;
    return 'Ej angivet';
  };

  if (loading) {
    const skeletonCount = readCachedCount(SKELETON_COUNT_KEYS.jobTemplates, 3, 6);
    return (
      <div className="space-y-6 animate-pulse">
        {/* Header row */}
        <div className="flex justify-between items-center">
          <div className="space-y-2">
            <div className="h-6 w-32 bg-white/10 rounded" />
            <div className="h-3 w-56 bg-white/10 rounded" />
          </div>
          <div className="h-9 w-32 rounded-md bg-white/10" />
        </div>

        {/* Template cards */}
        <div className="space-y-4">
          {[...Array(skeletonCount)].map((_, i) => (
            <div key={i} className="bg-white/10 border border-white/20 rounded-lg p-6 space-y-4">
              <div className="flex justify-between items-start gap-3">
                <div className="flex-1 space-y-2">
                  <div className="h-5 w-48 bg-white/10 rounded" />
                  <div className="h-3 w-64 bg-white/10 rounded" />
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="h-8 w-8 rounded-md bg-white/10" />
                  <div className="h-8 w-20 rounded-md bg-white/10" />
                  <div className="h-8 w-20 rounded-md bg-white/10" />
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="h-3 w-full bg-white/10 rounded" />
                <div className="h-3 w-4/5 bg-white/10 rounded" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[...Array(4)].map((_, j) => (
                  <div key={j} className="h-3 w-32 bg-white/10 rounded" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-white tracking-tight">Jobbmallar</h1>
          <p className="text-sm text-white mt-1">
            Hantera dina återanvändbara jobbmallar
          </p>
        </div>
        <Button 
          onClick={() => setShowCreateDialog(true)}
          onMouseDown={(e) => e.currentTarget.blur()}
          onMouseUp={(e) => e.currentTarget.blur()}
          className="flex items-center gap-2 transition-colors duration-300 focus:outline-none focus:ring-0"
        >
          Skapa ny mall
          <Plus size={16} />
        </Button>
      </div>

      {/* Templates Grid */}
      <div className="space-y-4">
        {templates.length === 0 ? (
          <Card className="bg-white/10 border-white/20">
            <CardContent className="text-center py-12">
              <h3 className="text-lg font-semibold mb-2 text-white">Inga mallar än</h3>
              <p className="text-white mb-4">
                Skapa din första jobbmall för att effektivisera ditt rekryteringsarbete.
              </p>
              <Button 
                onClick={() => setShowCreateDialog(true)}
                onMouseDown={(e) => e.currentTarget.blur()}
                onMouseUp={(e) => e.currentTarget.blur()}
                className="transition-colors duration-300 focus:outline-none focus:ring-0"
              >
                Skapa första mallen
                <Plus size={16} className="ml-2" />
              </Button>
            </CardContent>
          </Card>
        ) : (
          templates.map((template) => (
            <Card key={template.id} className="bg-white/10 border-white/20">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <TruncatedText text={template.name} className="line-clamp-2 text-xl font-semibold leading-none tracking-tight text-white" />
                      {template.is_default && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-sm font-medium bg-blue-500/20 text-blue-200 border border-blue-400/30">
                          <Star size={12} className="mr-1" />
                          Standard
                        </span>
                      )}
                    </div>
                    <TruncatedText text={`${template.title} • ${template.location}`} className="line-clamp-2 text-sm text-white" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleDefault(template.id)}
                      onMouseDown={(e) => e.currentTarget.blur()}
                      onMouseUp={(e) => e.currentTarget.blur()}
                      className="bg-white/10 border-white/20 text-white transition-colors duration-300 md:hover:bg-white/20 focus:outline-none focus:ring-0"
                      title={template.is_default ? "Ta bort som standard" : "Sätt som standard"}
                    >
                      {template.is_default ? <StarOff size={14} /> : <Star size={14} />}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => startEdit(template)}
                      onMouseDown={(e) => e.currentTarget.blur()}
                      onMouseUp={(e) => e.currentTarget.blur()}
                      className="bg-white/10 border-white/20 text-white transition-colors duration-300 md:hover:bg-white/20 md:hover:text-white md:hover:border-white/20 focus:outline-none focus:ring-0"
                    >
                      <Edit size={14} className="mr-1" />
                      Redigera
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeleteTarget({ id: template.id, name: template.name })}
                      onMouseDown={(e) => e.currentTarget.blur()}
                      onMouseUp={(e) => e.currentTarget.blur()}
                      className="border-destructive/40 bg-destructive/20 text-white transition-colors duration-300 md:hover:!border-destructive/50 md:hover:!bg-destructive/30 md:hover:!text-white focus:outline-none focus:ring-0"
                    >
                      <Trash2 size={14} className="mr-1" />
                      Ta bort
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-white mb-4 line-clamp-2">
                  {template.description}
                </p>
                
                <div className="grid grid-cols-2 gap-4 text-sm text-white">
                  <div>
                    <span className="font-medium">Lön:</span> {formatSalary(template.salary_min, template.salary_max)}
                  </div>
                  <div>
                    <span className="font-medium">Anställningsform:</span> {template.employment_type || 'Ej angivet'}
                  </div>
                  <div>
                    <span className="font-medium">Arbetstider:</span> {template.work_schedule || 'Ej angivet'}
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar size={12} />
                    <span>Skapad: {new Date(template.created_at).toLocaleDateString('sv-SE')}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <CreateTemplateWizard
        open={showCreateDialog || showEditDialog}
        onOpenChange={(open) => {
          if (!open) {
            setShowCreateDialog(false);
            setShowEditDialog(false);
            setEditingTemplate(null);
          }
        }}
        templateToEdit={editingTemplate}
        onTemplateCreated={() => {
          setShowCreateDialog(false);
          setShowEditDialog(false);
          setEditingTemplate(null);
          void fetchTemplates();
        }}
      />
    </div>
      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContentNoFocus
          elevated
          className="border-white/20 text-white w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] sm:max-w-md sm:w-[28rem] p-4 sm:p-6 bg-white/10 rounded-xl shadow-lg mx-0"
        >
          <AlertDialogHeader className="space-y-4 text-center">
            <div className="flex items-center justify-center gap-2.5">
              <div className="bg-red-500/20 p-2 rounded-full">
                <AlertTriangle className="h-4 w-4 text-white" />
              </div>
              <AlertDialogTitle className="text-white text-base md:text-lg font-semibold">
                Ta bort mall
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-white text-sm leading-relaxed">
              Är du säker på att du vill ta bort mallen &quot;{deleteTarget?.name}&quot;? Denna åtgärd går inte att ångra.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row justify-center gap-2 mt-4">
            <AlertDialogCancel
              onClick={() => setDeleteTarget(null)}
              className="btn-dialog-action mt-0 rounded-full border-white/30 text-white bg-white/10 hover:bg-white/20"
            >
              Avbryt
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              variant="destructiveSoft"
              className="btn-dialog-action rounded-full"
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              Ta bort
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContentNoFocus>
      </AlertDialog>
    </>
  );
};

export default JobTemplatesOverview;