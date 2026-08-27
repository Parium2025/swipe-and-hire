import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertDialogContentNoFocus } from '@/components/ui/alert-dialog-no-focus';
import { Users, Plus, Star, Pencil, Trash2, FileText, Video, Image as ImageIcon, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useCandidateProfiles, MAX_CANDIDATE_PROFILES, type CandidateProfile, type CandidateProfileInput } from '@/hooks/useCandidateProfiles';
import CandidateProfileEditor from './CandidateProfileEditor';

interface Props {
  userId?: string;
}

/** "Mina profiler" – upp till 3 varianter av CV, video och bild att välja mellan vid ansökan. */
export function CandidateProfilesManager({ userId }: Props) {
  const { toast } = useToast();
  const {
    profiles, loading, canCreateMore,
    createProfile, updateProfile, deleteProfile, setDefaultProfile,
  } = useCandidateProfiles(userId);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<CandidateProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<CandidateProfile | null>(null);

  const openNew = () => { setEditing(null); setEditorOpen(true); };
  const openEdit = (p: CandidateProfile) => { setEditing(p); setEditorOpen(true); };

  const handleSave = async (input: CandidateProfileInput) => {
    setSaving(true);
    const res = editing
      ? await updateProfile(editing.id, input)
      : await createProfile(input);
    setSaving(false);

    if ('error' in res && res.error) {
      toast({ title: 'Kunde inte spara', description: res.error, variant: 'destructive' });
      return;
    }
    setEditorOpen(false);
    toast({ title: editing ? 'Profil uppdaterad' : 'Profil skapad', description: input.label });
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    const res = await deleteProfile(pendingDelete.id);
    setPendingDelete(null);
    if ('error' in res && res.error) {
      toast({ title: 'Kunde inte ta bort', description: res.error, variant: 'destructive' });
      return;
    }
    toast({ title: 'Profil borttagen' });
  };

  return (
    <div className="space-y-4 md:space-y-3 pt-4 md:pt-3 border-t border-white/10">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-white" />
          <Label className="text-base font-medium text-white">Mina profiler</Label>
        </div>
        <span className="text-xs text-white/60">{profiles.length}/{MAX_CANDIDATE_PROFILES}</span>
      </div>

      <p className="text-sm text-white">
        Skapa upp till {MAX_CANDIDATE_PROFILES} profiler med olika CV, video och bild. När du söker ett jobb väljer du
        vilken profil som ska skickas med – arbetsgivaren ser alltid exakt den versionen.
      </p>

      {!loading && profiles.length === 0 && (
        <p className="text-sm text-white">
          Du har inga extra profiler ännu. Ansökningar använder ditt vanliga CV och din vanliga video.
        </p>
      )}

      <div className="space-y-2">
        {profiles.map((p) => (
          <div
            key={p.id}
            className="rounded-lg border border-white/10 bg-white/5 p-3 backdrop-blur-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="break-words text-sm font-medium text-white">{p.label}</span>
                  {p.is_default && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[11px] text-white">
                      <Star className="h-3 w-3 fill-current" /> Standard
                    </span>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-3 text-[12px] text-white/70">
                  <span className={`inline-flex items-center gap-1 ${p.cv_url ? 'text-white' : ''}`}>
                    <FileText className="h-3.5 w-3.5" /> {p.cv_url ? 'CV' : 'Inget CV'}
                  </span>
                  <span className={`inline-flex items-center gap-1 ${p.video_url ? 'text-white' : ''}`}>
                    <Video className="h-3.5 w-3.5" /> {p.video_url ? 'Video' : 'Ingen video'}
                  </span>
                  <span className={`inline-flex items-center gap-1 ${p.profile_image_url ? 'text-white' : ''}`}>
                    <ImageIcon className="h-3.5 w-3.5" /> {p.profile_image_url ? 'Bild' : 'Ingen bild'}
                  </span>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                {!p.is_default && (
                  <button
                    type="button"
                    title="Gör till standard"
                    onClick={() => setDefaultProfile(p.id)}
                    className="rounded-full border border-white/15 bg-white/5 p-2 text-white transition-colors md:hover:bg-white/10"
                  >
                    <Star className="h-4 w-4" />
                  </button>
                )}
                <button
                  type="button"
                  title="Redigera"
                  onClick={() => openEdit(p)}
                  className="rounded-full border border-white/15 bg-white/5 p-2 text-white transition-colors md:hover:bg-white/10"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  title="Ta bort"
                  onClick={() => setPendingDelete(p)}
                  className="rounded-full border border-destructive/40 bg-destructive/20 p-2 text-white transition-colors md:hover:!bg-destructive/30"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Samma knappstruktur som "Visa filter" – ren <button> utan fokusring, så den inte blixtrar vid tryck. */}
      <button
        type="button"
        disabled={!canCreateMore}
        onClick={openNew}
        className="w-full h-11 px-5 inline-flex items-center justify-center gap-2 text-sm text-white rounded-full bg-white/10 border border-white/20 active:scale-[0.97] transition-all duration-200 touch-manipulation outline-none focus:outline-none focus-visible:outline-none disabled:opacity-50 disabled:active:scale-100"
      >
        <Plus className="h-4 w-4" />
        <span>{canCreateMore ? 'Ny profil' : `Max ${MAX_CANDIDATE_PROFILES} profiler`}</span>
      </button>

      <CandidateProfileEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        profile={editing}
        saving={saving}
        onSave={handleSave}
      />

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContentNoFocus className="border-white/20 text-white w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] sm:max-w-md sm:w-[28rem] p-4 sm:p-6 bg-white/10 backdrop-blur-sm rounded-xl shadow-lg mx-0">
          <AlertDialogHeader className="space-y-4 text-center">
            <div className="flex items-center justify-center gap-2.5">
              <div className="bg-red-500/20 p-2 rounded-full">
                <AlertTriangle className="h-4 w-4 text-white" />
              </div>
              <AlertDialogTitle className="text-white text-base md:text-lg font-semibold">
                Ta bort profilen
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-white text-sm leading-relaxed">
              {pendingDelete?.label} tas bort permanent. Ansökningar du redan skickat påverkas inte – de behåller sin
              egen kopia av CV, video och bild.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2 mt-4 sm:justify-center">
            <AlertDialogCancel className="btn-dialog-action flex-1 mt-0 flex items-center justify-center rounded-full bg-white/10 border-white/20 text-white text-sm transition-all duration-300 md:hover:bg-white/20 md:hover:text-white md:hover:border-white/50">
              Avbryt
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              variant="destructiveSoft"
              className="btn-dialog-action flex-1 text-sm flex items-center justify-center rounded-full"
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              Ta bort
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContentNoFocus>
      </AlertDialog>
    </div>
  );
}

export default CandidateProfilesManager;
