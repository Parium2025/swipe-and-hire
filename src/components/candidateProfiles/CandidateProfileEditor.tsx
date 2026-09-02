import React, { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import FileUpload from '@/components/FileUpload';
import ProfileVideo from '@/components/ProfileVideo';
import ImageEditor from '@/components/ImageEditor';
import { UploadInlineProgress } from '@/components/ui/upload-inline-progress';
import { FileText, Camera, Video, Play, Trash2, Loader2, CheckCircle, RotateCcw } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useMediaUrl } from '@/hooks/useMediaUrl';
import { deleteMedia, uploadMedia, type MediaType } from '@/lib/mediaManager';
import { useVideoPoster } from '@/hooks/useVideoPoster';
import { looksLikeVideoFile } from '@/lib/videoInput';
import type { CandidateProfile, CandidateProfileInput } from '@/hooks/useCandidateProfiles';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile?: CandidateProfile | null;
  saving?: boolean;
  onSave: (input: CandidateProfileInput) => Promise<boolean>;
}

/** Samma solida kortyta som profilsidans sektioner – ingen streckad ram. */
const DROPZONE = 'rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm px-4 py-5 md:hover:bg-white/10';

/** Samma pillerknapp som "Anpassa din bild" på Min profil. */
const PILL =
  'bg-white/5 backdrop-blur-sm border border-white/10 text-white md:hover:bg-white/10 md:hover:border-white/50 disabled:opacity-50 px-4 py-1.5 text-sm font-medium rounded-full transition-colors outline-none focus:outline-none focus-visible:outline-none';

/** Dialog för att skapa eller redigera en kandidatprofil (namn, CV, media). */
export function CandidateProfileEditor({ open, onOpenChange, profile, saving, onSave }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [label, setLabel] = useState('');
  const [cvUrl, setCvUrl] = useState<string | null>(null);
  const [cvFilename, setCvFilename] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deletedMedia, setDeletedMedia] = useState<{ videoUrl: string | null; imageUrl: string | null; coverUrl: string | null } | null>(null);
  const [deletedCover, setDeletedCover] = useState<string | null>(null);
  const [deletedCv, setDeletedCv] = useState<{ url: string; filename: string | null } | null>(null);
  const uploadedPathsRef = useRef(new Map<string, MediaType>());

  const [editorSrc, setEditorSrc] = useState('');
  const [editorTarget, setEditorTarget] = useState<'profile-image' | 'cover-image' | null>(null);

  const mediaInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const signedImage = useMediaUrl(imageUrl ?? undefined, 'profile-image');
  const signedVideo = useMediaUrl(videoUrl ?? undefined, 'profile-video');
  const signedCover = useMediaUrl(coverUrl ?? undefined, 'cover-image');
  const posterUrl = useVideoPoster(videoUrl);

  useEffect(() => {
    if (!open) return;
    setLabel(profile?.label ?? '');
    setCvUrl(profile?.cv_url ?? null);
    setCvFilename(profile?.cv_filename ?? null);
    setVideoUrl(profile?.video_url ?? null);
    setImageUrl(profile?.profile_image_url ?? null);
    setCoverUrl(profile?.cover_image_url ?? null);
    setEditorSrc('');
    setEditorTarget(null);
    setDeletedMedia(null);
    setDeletedCover(null);
    setDeletedCv(null);
    uploadedPathsRef.current.clear();
  }, [open, profile]);

  const labelFilled = label.trim().length > 0;

  const uploadFile = async (file: File, type: 'profile-image' | 'profile-video' | 'cover-image') => {
    if (!user?.id) return null;
    setUploading(true);
    const { storagePath, error } = await uploadMedia(file, type, user.id);
    setUploading(false);
    if (error || !storagePath) {
      toast({ title: 'Uppladdningen misslyckades', description: error?.message ?? 'Försök igen.', variant: 'destructive' });
      return null;
    }
    uploadedPathsRef.current.set(storagePath, type);
    return storagePath;
  };

  const cleanupNewUploads = async (keep: Set<string> = new Set()) => {
    const removals = Array.from(uploadedPathsRef.current.entries())
      .filter(([path]) => !keep.has(path))
      .map(([path, type]) => deleteMedia(path, type));
    await Promise.allSettled(removals);
    uploadedPathsRef.current.clear();
  };

  const resetToSavedProfile = () => {
    setLabel(profile?.label ?? '');
    setCvUrl(profile?.cv_url ?? null);
    setCvFilename(profile?.cv_filename ?? null);
    setVideoUrl(profile?.video_url ?? null);
    setImageUrl(profile?.profile_image_url ?? null);
    setCoverUrl(profile?.cover_image_url ?? null);
    setDeletedMedia(null);
    setDeletedCover(null);
    setDeletedCv(null);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      void cleanupNewUploads();
      resetToSavedProfile();
    }
    onOpenChange(nextOpen);
  };

  const handleSaveProfile = async () => {
    const input: CandidateProfileInput = {
      label,
      cv_url: cvUrl,
      cv_filename: cvFilename,
      video_url: videoUrl,
      profile_image_url: imageUrl,
      cover_image_url: coverUrl,
    };
    const saved = await onSave(input);
    if (saved) {
      const referenced = new Set([cvUrl, videoUrl, imageUrl, coverUrl].filter((path): path is string => !!path));
      await cleanupNewUploads(referenced);
      uploadedPathsRef.current.clear();
      return;
    }
    await cleanupNewUploads();
    resetToSavedProfile();
  };

  /** Bild eller video till profilen – samma flöde som på Min profil. */
  const handleMediaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (looksLikeVideoFile(file)) {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      let done = false;
      const finish = (fn: () => void) => { if (done) return; done = true; try { URL.revokeObjectURL(video.src); } catch { /* ignore */ } fn(); };
      video.onloadedmetadata = () => finish(async () => {
        if (!Number.isFinite(video.duration) || video.duration <= 0) {
          toast({ title: 'Ogiltig videofil', description: 'Videon har ingen giltig längd. Välj en annan fil.', variant: 'destructive' });
          return;
        }
        if (video.duration > 60) {
          toast({ title: 'Videon är för lång', description: `Videon är ${Math.round(video.duration)} sekunder. Max 60 sekunder tillåtet.`, variant: 'destructive' });
          return;
        }
        const path = await uploadFile(file, 'profile-video');
        if (path) { setVideoUrl(path); setImageUrl(null); }
      });
      video.onerror = () => finish(() => {
        toast({ title: 'Ogiltig videofil', description: 'Filen är skadad eller har ett format som inte stöds.', variant: 'destructive' });
      });
      try { video.src = URL.createObjectURL(file); } catch {
        toast({ title: 'Fel vid filhantering', description: 'Kunde inte läsa videofilen.', variant: 'destructive' });
      }
      return;
    }

    if (file.type.startsWith('image/')) {
      setEditorSrc(URL.createObjectURL(file));
      setEditorTarget('profile-image');
    }
  };

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !file.type.startsWith('image/')) return;
    setEditorSrc(URL.createObjectURL(file));
    setEditorTarget('cover-image');
  };

  const handleEditorSave = async (blob: Blob) => {
    const target = editorTarget;
    if (!target) return;
    const file = new File([blob], target === 'cover-image' ? 'cover-image.jpg' : 'profile-image.jpg', { type: 'image/jpeg' });
    const path = await uploadFile(file, target);
    if (path) {
      if (target === 'cover-image') setCoverUrl(path);
      else { setImageUrl(path); setVideoUrl(null); }
    }
    setEditorTarget(null);
    setEditorSrc('');
  };

  const openExistingInEditor = (src: string | null, target: 'profile-image' | 'cover-image') => {
    if (!src) return;
    setEditorSrc(src);
    setEditorTarget(target);
  };

  const hasVideo = !!videoUrl;
  const hasImage = !!imageUrl;

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
<DialogContent
          className="max-h-[85vh] overflow-y-auto sm:max-w-lg bg-card-parium border-0 text-white"
          // På pekskärmar ska inte namnfältet autofokuseras – då åker tangentbordet
          // upp direkt när dialogen öppnas. På desktop behålls autofokus.
          onOpenAutoFocus={(e) => {
            if (window.matchMedia('(pointer: coarse)').matches) e.preventDefault();
          }}
        >
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

            {/* Profilbild/Profilvideo – identiskt system som på Min profil. */}
            <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-4 space-y-4">
              <div className="text-center space-y-1">
                <h3 className="text-base font-semibold text-white">Profilbild/Profilvideo</h3>
                <p className="text-sm text-white">
                  Ladda upp en kort profilbild/profilvideo och gör ditt första intryck minnesvärt.
                </p>
              </div>

              {!hasVideo && !hasImage && (
                <div className="flex items-center justify-center space-x-4">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full border-4 border-white/10 p-2 bg-white/5 backdrop-blur-sm">
                      <div className="relative w-full h-full rounded-full bg-gradient-to-b from-primary/30 to-primary/50 overflow-hidden flex items-center justify-center">
                        <Video className="h-5 w-5 text-white" />
                      </div>
                    </div>
                  </div>
                  <div className="text-white text-sm font-medium">eller</div>
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full border-4 border-white/10 p-2 bg-white/5 backdrop-blur-sm">
                      <div className="relative w-full h-full rounded-full bg-gradient-to-b from-primary/30 to-primary/50 overflow-hidden flex items-center justify-center">
                        <Camera className="h-5 w-5 text-white" />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-col items-center space-y-4">
                <div className="relative">
                  {hasVideo ? (
                    <ProfileVideo
                      videoUrl={signedVideo ?? ''}
                      coverImageUrl={signedCover ?? undefined}
                      posterUrl={posterUrl}
                      alt="Profilvideo"
                      className="w-32 h-32 border-4 border-white/10 rounded-full overflow-hidden"
                      countdownVariant="circle"
                    />
                  ) : (
                    <div className="cursor-pointer" onClick={() => mediaInputRef.current?.click()}>
                      <Avatar className="h-32 w-32 border-4 border-white/10">
                        {signedImage ? <AvatarImage src={signedImage} alt="Profilbild" className="object-cover" /> : null}
                        {!signedImage && (
                          <AvatarFallback className="text-4xl font-semibold bg-white/20 text-white">
                            <Camera className="h-8 w-8" />
                          </AvatarFallback>
                        )}
                      </Avatar>
                    </div>
                  )}

                  {deletedMedia ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setVideoUrl(deletedMedia.videoUrl);
                        setImageUrl(deletedMedia.imageUrl);
                        setCoverUrl(deletedMedia.coverUrl);
                        setDeletedMedia(null);
                      }}
                      aria-label="Återställ media"
                      className="absolute -top-3 -right-3 rounded-full bg-white/20 p-2 text-white outline-none backdrop-blur-sm transition-colors [-webkit-tap-highlight-color:transparent] focus:ring-0 focus-visible:ring-0 md:hover:bg-white/30"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </button>
                  ) : (hasVideo || hasImage) && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletedMedia({ videoUrl, imageUrl, coverUrl });
                        setVideoUrl(null);
                        setImageUrl(null);
                        setCoverUrl(null);
                      }}
                      aria-label="Ta bort media"
                      className="absolute -top-3 -right-3 rounded-full border border-destructive/40 bg-destructive/20 p-2 text-white outline-none transition-colors [-webkit-tap-highlight-color:transparent] focus:ring-0 focus-visible:ring-0 md:hover:!bg-destructive/30"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}

                  <input
                    ref={mediaInputRef}
                    type="file"
                    accept="image/*,video/*,.mp4,.m4v,.mov,.webm,.3gp,.3g2,.mkv"
                    onChange={handleMediaChange}
                    className="hidden"
                    disabled={uploading}
                  />
                </div>

                <div className="space-y-2 text-center">
                  {uploading ? (
                    <UploadInlineProgress />
                  ) : (
                    <button
                      type="button"
                      onClick={() => mediaInputRef.current?.click()}
                      className="text-white text-sm outline-none focus:outline-none focus-visible:outline-none"
                    >
                      Klicka här för att välja en bild eller video (max 60 sekunder)
                    </button>
                  )}

                  {hasVideo && !uploading && (
                    <div className="flex justify-center">
                      <Badge variant="outline" className="bg-white/20 text-white border-white/20 px-3 py-1 rounded-full">
                        Video uppladdad!
                      </Badge>
                    </div>
                  )}

                  {hasImage && !uploading && (
                    <div className="flex flex-col items-center space-y-2">
                      <Badge variant="outline" className="bg-white/20 text-white border-white/20 px-3 py-1 rounded-full">
                        Bild uppladdad!
                      </Badge>
                      <button type="button" onClick={() => openExistingInEditor(signedImage, 'profile-image')} className={PILL}>
                        Anpassa din bild
                      </button>
                    </div>
                  )}
                </div>

                {/* Cover-bild – visas när profilen har en video, precis som på Min profil. */}
                {hasVideo && (
                  <div className="flex flex-col items-center space-y-3 mt-2 p-4 rounded-lg bg-white/5 w-full">
                    {coverUrl && (
                      <button
                        type="button"
                        onClick={() => openExistingInEditor(signedCover, 'cover-image')}
                        className={`${PILL} w-[180px]`}
                      >
                        Anpassa din bild
                      </button>
                    )}

                    <div className="relative flex items-center justify-center w-[180px]">
                      <button
                        type="button"
                        onClick={() => coverInputRef.current?.click()}
                        disabled={uploading}
                        className={`${PILL} w-full`}
                      >
                        {coverUrl ? 'Ändra cover-bild' : 'Lägg till cover-bild'}
                      </button>
                      {deletedCover ? (
                        <button
                          type="button"
                          onClick={() => { setCoverUrl(deletedCover); setDeletedCover(null); }}
                          aria-label="Återställ cover-bild"
                          className="absolute -right-10 rounded-full bg-white/20 p-2 text-white outline-none backdrop-blur-sm transition-colors [-webkit-tap-highlight-color:transparent] focus:ring-0 focus-visible:ring-0 md:hover:bg-white/30"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </button>
                      ) : coverUrl && (
                        <button
                          type="button"
                          onClick={() => { setDeletedCover(coverUrl); setCoverUrl(null); }}
                          aria-label="Ta bort cover-bild"
                          className="absolute -right-10 rounded-full border border-destructive/40 bg-destructive/20 p-2 text-white outline-none transition-colors [-webkit-tap-highlight-color:transparent] focus:ring-0 focus-visible:ring-0 md:hover:!bg-destructive/30"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverChange} disabled={uploading} />

                    {coverUrl && !uploading && (
                      <Badge variant="outline" className="w-[180px] bg-white/20 text-white border-white/20 text-sm font-normal whitespace-nowrap px-3 py-1 rounded-full flex items-center justify-center">
                        Cover-bild uppladdad!
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* CV */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-white" />
                <Label className="text-sm font-medium text-white">CV</Label>
              </div>
              {cvUrl ? (
                <div className="flex min-h-11 items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-2">
                  <span className="flex-1 truncate text-sm text-white">{cvFilename || 'CV uppladdat'}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setDeletedCv({ url: cvUrl, filename: cvFilename });
                      setCvUrl(null);
                      setCvFilename(null);
                    }}
                    aria-label="Ta bort CV"
                    className="rounded-full border border-destructive/40 bg-destructive/20 p-2 text-white transition-colors md:hover:!bg-destructive/30"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ) : deletedCv ? (
                <div className="flex min-h-11 items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-2">
                  <span className="flex-1 text-sm text-white">CV markerat för borttagning.</span>
                  <button
                    type="button"
                    onClick={() => { setCvUrl(deletedCv.url); setCvFilename(deletedCv.filename); setDeletedCv(null); }}
                    aria-label="Återställ CV"
                    className="rounded-full bg-white/20 p-2 text-white transition-colors md:hover:bg-white/30"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <FileUpload
                  mediaType="cv"
                  uploadType="document"
                  acceptedFileTypes={['application/pdf', '.pdf', '.doc', '.docx', '.rtf', '.odt', '.txt']}
                  maxFileSize={50 * 1024 * 1024}
                  dropzoneClassName={DROPZONE}
                  onFileUploaded={(url, fileName) => {
                    uploadedPathsRef.current.set(url, 'cv');
                    setCvUrl(url);
                    setCvFilename(fileName);
                  }}
                  onFileRemoved={() => { setCvUrl(null); setCvFilename(null); }}
                />
              )}
            </div>
          </div>

          <DialogFooter className="flex-col items-stretch gap-2 sm:flex-col sm:space-x-0">
            <button
              type="button"
              disabled={!labelFilled || saving || uploading}
              onClick={() => void handleSaveProfile()}
              className="w-full h-11 px-5 inline-flex items-center justify-center gap-2 text-sm font-medium text-white rounded-full bg-green-600/80 md:hover:bg-green-600 border border-transparent transition-colors duration-150 touch-manipulation outline-none ring-0 focus:outline-none focus:ring-0 focus:ring-offset-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 disabled:bg-green-600/60 disabled:opacity-70"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
              {saving ? 'Sparar…' : 'Spara profil'}
            </button>
            <button
              type="button"
              onClick={() => handleOpenChange(false)}
              className="w-full h-11 px-5 inline-flex items-center justify-center text-sm text-white rounded-full bg-white/5 border border-white/20 md:hover:bg-white/10 transition-colors duration-150 touch-manipulation outline-none ring-0 focus:outline-none focus:ring-0 focus:ring-offset-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
            >
              Avbryt
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ImageEditor
        isOpen={!!editorTarget && !!editorSrc}
        onClose={() => { setEditorTarget(null); setEditorSrc(''); }}
        imageSrc={editorSrc}
        onSave={handleEditorSave}
        aspectRatio={1}
        isCircular
      />
    </>
  );
}

export default CandidateProfileEditor;
