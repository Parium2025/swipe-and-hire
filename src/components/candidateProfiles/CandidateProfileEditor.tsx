import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import FileUpload from '@/components/FileUpload';
import { FileText, Video, Image as ImageIcon, Trash2 } from 'lucide-react';
import type { CandidateProfile, CandidateProfileInput } from '@/hooks/useCandidateProfiles';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile?: CandidateProfile | null;
  saving?: boolean;
  onSave: (input: CandidateProfileInput) => void;
}

/** Samma solida kortyta som profilsidans sektioner – ingen streckad ram. */
const DROPZONE = 'rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm px-4 py-5 md:hover:bg-white/10';

/** Dialog för att skapa eller redigera en kandidatprofil (namn, CV, video, bild). */
export function CandidateProfileEditor({ open, onOpenChange, profile, saving, onSave }: Props) {
  const [label, setLabel] = useState('');
  const [cvUrl, setCvUrl] = useState<string | null>(null);
  const [cvFilename, setCvFilename] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLabel(profile?.label ?? '');
    setCvUrl(profile?.cv_url ?? null);
    setCvFilename(profile?.cv_filename ?? null);
    setVideoUrl(profile?.video_url ?? null);
    setImageUrl(profile?.profile_image_url ?? null);
  }, [open, profile]);

  const labelFilled = label.trim().length > 0;

  const row = (
    icon: React.ReactNode,
    title: string,
    value: string | null,
    valueLabel: string,
    onClear: () => void,
    upload: React.ReactNode,
  ) => (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {icon}
        <Label className="text-sm font-medium text-white">{title}</Label>
      </div>
      {value ? (
        <div className="flex min-h-11 items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-2">
          <span className="flex-1 truncate text-sm text-white">{valueLabel}</span>
          <button
            type="button"
            onClick={onClear}
            title="Ta bort"
            className="rounded-full border border-destructive/40 bg-destructive/20 p-2 text-white transition-colors md:hover:!bg-destructive/30"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ) : (
        upload
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg bg-card-parium border-0 text-white">
        <DialogHeader>
          <DialogTitle className="text-white">{profile ? 'Redigera profil' : 'Ny profil'}</DialogTitle>
          <DialogDescription className="text-white">
            Dina personuppgifter är alltid desamma. Här väljer du bara vilket CV, vilken video och vilken bild som ska
            följa med när du söker jobb.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label className="text-sm font-medium text-white">
              Profilnamn <span className={labelFilled ? 'text-white' : 'text-destructive'}>*</span>
            </Label>
            <Input
              value={label}
              placeholder="T.ex. Lagermedarbetare"
              onChange={(e) => setLabel(e.target.value)}
              className="bg-white/5 border-white/20 text-white placeholder:text-white/50 focus:ring-0 focus-visible:ring-0 focus:ring-offset-0 focus-visible:ring-offset-0"
            />
            <p className="text-xs text-white">
              Namnet är bara till för dig, så att du snabbt hittar rätt profil när du söker jobb.
            </p>
          </div>

          {row(
            <FileText className="h-4 w-4 text-white" />,
            'CV',
            cvUrl,
            cvFilename || 'CV uppladdat',
            () => { setCvUrl(null); setCvFilename(null); },
            <FileUpload
              mediaType="cv"
              uploadType="document"
              acceptedFileTypes={['application/pdf', '.pdf', '.doc', '.docx', '.rtf', '.odt', '.txt']}
              maxFileSize={50 * 1024 * 1024}
              onFileUploaded={(url, fileName) => { setCvUrl(url); setCvFilename(fileName); }}
              onFileRemoved={() => { setCvUrl(null); setCvFilename(null); }}
            />,
          )}

          {row(
            <Video className="h-4 w-4 text-white" />,
            'Presentationsvideo',
            videoUrl,
            'Video uppladdad',
            () => setVideoUrl(null),
            <FileUpload
              mediaType="profile-video"
              uploadType="video"
              acceptedFileTypes={['video/*']}
              maxFileSize={50 * 1024 * 1024}
              onFileUploaded={(url) => setVideoUrl(url)}
              onFileRemoved={() => setVideoUrl(null)}
            />,
          )}

          {row(
            <ImageIcon className="h-4 w-4 text-white" />,
            'Profilbild',
            imageUrl,
            'Bild uppladdad',
            () => setImageUrl(null),
            <FileUpload
              mediaType="profile-image"
              uploadType="image"
              acceptedFileTypes={['image/*']}
              maxFileSize={50 * 1024 * 1024}
              onFileUploaded={(url) => setImageUrl(url)}
              onFileRemoved={() => setImageUrl(null)}
            />,
          )}
        </div>

        <DialogFooter className="flex-col items-stretch gap-2 sm:flex-col sm:space-x-0">
          <Button
            variant="glass"
            className="w-full h-12 text-sm"
            disabled={!labelFilled || saving}
            onClick={() => onSave({
              label,
              cv_url: cvUrl,
              cv_filename: cvFilename,
              video_url: videoUrl,
              profile_image_url: imageUrl,
            })}
          >
            {saving ? 'Sparar…' : 'Spara profil'}
          </Button>
          <Button variant="glass" className="w-full h-12 text-sm" onClick={() => onOpenChange(false)}>
            Avbryt
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CandidateProfileEditor;
