import React, { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import FileUpload from '@/components/FileUpload';
import ProfileVideo from '@/components/ProfileVideo';
import ImageEditor from '@/components/ImageEditor';
import { UploadInlineProgress } from '@/components/ui/upload-inline-progress';
import { FileText, Camera, Trash2, Loader2, CheckCircle, Check, X, RotateCcw } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useMediaUrl } from '@/hooks/useMediaUrl';
import { uploadMedia, type MediaType, getOriginalImageUrl, uploadOriginalImage } from '@/lib/mediaManager';
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
  const uploadAbortRef = useRef<AbortController | null>(null);

  const [editorSrc, setEditorSrc] = useState('');
  const [editorTarget, setEditorTarget] = useState<'profile-image' | 'cover-image' | null>(null);

  const mediaInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const signedImage = useMediaUrl(imageUrl ?? undefined, 'profile-image');
  const signedVideo = useMediaUrl(videoUrl ?? undefined, 'profile-video');
  const signedCover = useMediaUrl(coverUrl ?? undefined, 'cover-image');
  const posterUrl = useVideoPoster(videoUrl);

  // Förhandsgranskningar från filväljaren är blob-URL:er. Släpp alltid den
  // föregående när användaren väljer om, sparar, stänger eller komponenten
  // avmonteras så långa bildredigeringssessioner inte läcker minne.
  useEffect(() => () => {
    if (editorSrc.startsWith('blob:')) URL.revokeObjectURL(editorSrc);
  }, [editorSrc]);

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
  // Sant när editorns källbild ännu inte finns sparad som original i lagringen.
  const persistOriginalRef = useRef(true);

  const uploadFile = async (file: File, type: 'profile-image' | 'profile-video' | 'cover-image') => {
    if (!user?.id) return null;
    const controller = new AbortController();
    uploadAbortRef.current?.abort();
    uploadAbortRef.current = controller;
    setUploading(true);
    const { storagePath, error } = await uploadMedia(file, type, user.id, { signal: controller.signal });
    setUploading(false);
    if (uploadAbortRef.current === controller) uploadAbortRef.current = null;
    if (error || !storagePath) {
      toast({ title: 'Uppladdningen misslyckades', description: error?.message ?? 'Försök igen.', variant: 'destructive' });
      return null;
    }
    uploadedPathsRef.current.set(storagePath, type);
    return storagePath;
  };

  const cleanupNewUploads = async (keep: Set<string> = new Set()) => {
    // Filer tas aldrig bort direkt från klienten. Referenssäker backendstädning
    // tar hand om övergivna uppladdningar efter säkerhetsfristen.
    void keep;
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
      uploadAbortRef.current?.abort();
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
        if (path) setVideoUrl(path);
      });
      video.onerror = () => finish(() => {
        toast({ title: 'Ogiltig videofil', description: 'Filen är skadad eller har ett format som inte stöds.', variant: 'destructive' });
      });
      try { video.src = URL.createObjectURL(file); } catch {
        toast({ title: 'Fel vid filhantering', description: 'Kunde inte läsa videofilen.', variant: 'destructive' });
      }
      return;
    }

    if (file.type.startsWith('image/') && file.type !== 'image/svg+xml' && !file.name.toLowerCase().endsWith('.svg')) {
      persistOriginalRef.current = true;
      setEditorSrc(URL.createObjectURL(file));
      setEditorTarget('profile-image');
    } else {
      toast({ title: 'Filtypen stöds inte', description: 'Välj JPEG, PNG eller WebP.', variant: 'destructive' });
    }
  };

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/') || file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) {
      toast({ title: 'Filtypen stöds inte', description: 'Välj JPEG, PNG eller WebP.', variant: 'destructive' });
      return;
    }
    persistOriginalRef.current = true;
    setEditorSrc(URL.createObjectURL(file));
    setEditorTarget('cover-image');
  };

  const handleEditorSave = async (blob: Blob) => {
    const target = editorTarget;
    const source = editorSrc;
    const shouldPersistOriginal = persistOriginalRef.current;
    if (!target) return;
    const file = new File([blob], target === 'cover-image' ? 'cover-image.jpg' : 'profile-image.jpg', { type: 'image/jpeg' });
    const path = await uploadFile(file, target);
    if (path) {
      // Spara originalbilden bredvid beskärningen så att "Återställ" i editorn
      // alltid kan gå tillbaka till originalet.
      if (shouldPersistOriginal && source) {
        try {
          const originalBlob = await (await fetch(source)).blob();
          if (originalBlob.size) await uploadOriginalImage(path, originalBlob, target);
        } catch (error) {
          console.warn('Kunde inte spara originalbilden:', error);
        }
      }
      if (target === 'cover-image') setCoverUrl(path);
      else setImageUrl(path);
    }
    setEditorTarget(null);
    setEditorSrc('');
  };

  /** Öppnar en redan sparad bild – originalet om det finns, annars beskärningen. */
  const openExistingInEditor = async (
    src: string | null,
    target: 'profile-image' | 'cover-image',
    storedPath?: string | null,
  ) => {
    if (!src && !storedPath) return;
    let originalUrl: string | null = null;
    if (storedPath) {
      originalUrl = await getOriginalImageUrl(storedPath, target);
    }
    persistOriginalRef.current = !originalUrl;
    const nextSrc = originalUrl ?? src;
    if (!nextSrc) return;
    setEditorSrc(nextSrc);
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

            {/* Bild och video är två separata, kombinerbara tillgångar. */}
            <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-4 space-y-4">
              <div className="flex flex-col items-center space-y-4">
                <div className="relative">
                  {hasVideo ? (
                    <ProfileVideo
                      videoUrl={signedVideo ?? ''}
                      coverImageUrl={signedCover ?? undefined}
                      posterUrl={posterUrl}
                      alt="Profilvideo"
                      className="w-32 h-32 ring-4 ring-inset ring-white/10 rounded-full overflow-hidden"
                      countdownVariant="circle"
                    />
                  ) : (
                    <div className="cursor-pointer" onClick={() => mediaInputRef.current?.click()}>
                      <Avatar className="h-32 w-32 ring-4 ring-inset ring-white/10">
                        {signedImage ? <AvatarImage src={signedImage} alt="Profilbild" className="object-cover" /> : null}
                        {!signedImage && (
                          <AvatarFallback className="absolute inset-0 text-4xl font-semibold bg-white/20 text-white">
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
                    accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,video/*,.mp4,.m4v,.mov,.webm,.3gp,.3g2,.mkv"
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
                      className="h-auto max-w-full cursor-pointer whitespace-normal bg-transparent px-2 py-1 text-center text-sm text-white outline-none [-webkit-tap-highlight-color:transparent] focus:ring-0 focus-visible:ring-0"
                    >
                      Välj en profilbild, profilvideo eller båda (video max 60 sekunder).
                    </button>
                  )}

                  {/* Vid video visas cover-bilden i cirkeln – då räcker "Anpassa cover-bild". */}
                  {hasImage && !hasVideo && !uploading && (
                    <div className="flex flex-col items-center space-y-2">
                      <Button type="button" variant="glass" onClick={() => void openExistingInEditor(signedImage, 'profile-image', imageUrl)} className="h-auto min-h-10 w-full max-w-xs whitespace-normal px-4 py-2 text-center text-sm transition-all duration-200 active:scale-[0.97] touch-manipulation">
                        Anpassa profilbild
                      </Button>
                    </div>
                  )}
                </div>

                {!uploading && (
                  <div className="flex w-full max-w-sm flex-wrap items-center justify-center gap-2" aria-label="Status för profilmedia">
                    <div className="flex min-h-9 items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.07] px-3 py-1.5 backdrop-blur-sm">
                      <span className="whitespace-nowrap text-xs font-medium leading-tight text-white">
                        {hasVideo ? 'Video' : `Bild${hasImage ? '' : ' saknas'}`}
                      </span>
                      <span className={(hasVideo || hasImage) ? 'text-success' : 'text-destructive'} aria-hidden="true">
                        {(hasVideo || hasImage) ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                      </span>
                    </div>
                    {hasVideo && (
                      <div className="flex min-h-9 items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.07] px-3 py-1.5 backdrop-blur-sm">
                        <span className="whitespace-nowrap text-xs font-medium leading-tight text-white">
                          Cover-bild{coverUrl ? '' : ' saknas'}
                        </span>
                        <span className={coverUrl ? 'text-success' : 'text-destructive'} aria-hidden="true">
                          {coverUrl ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                        </span>
                      </div>
                    )}
                  </div>

                )}

                {/* Cover-bild – visas när profilen har en video, precis som på Min profil. */}
                {hasVideo && (
                  <div className="flex flex-col items-center space-y-3 mt-2 p-4 rounded-lg bg-white/5 w-full">
                    {coverUrl && (
                      <>
                      <Button
                        type="button"
                        variant="glass"
                        onClick={() => void openExistingInEditor(signedCover, 'cover-image', coverUrl)}
                        className="h-auto min-h-10 w-full max-w-xs whitespace-normal px-4 py-2 text-center text-sm"
                      >
                        Anpassa cover-bild
                      </Button>
                      <Button
                        type="button"
                        variant="glassRed"
                        onClick={() => { setDeletedCover(coverUrl); setCoverUrl(null); }}
                        className="h-auto min-h-10 w-full max-w-xs whitespace-normal px-4 py-2 text-center text-sm"
                      >
                        <Trash2 className="h-4 w-4" />
                        Ta bort cover-bild
                      </Button>
                      </>
                    )}


                    {!coverUrl && <div className="relative flex w-full max-w-xs items-center justify-center">
                      <Button
                        type="button"
                        variant="glass"
                        onClick={() => coverInputRef.current?.click()}
                        disabled={uploading}
                        className="h-auto min-h-10 w-full whitespace-normal px-4 py-2 text-center text-sm"
                      >
                        Lägg till cover-bild
                      </Button>
                      {deletedCover ? (
                        <button
                          type="button"
                          onClick={() => { setCoverUrl(deletedCover); setDeletedCover(null); }}
                          aria-label="Återställ cover-bild"
                          className="absolute -right-10 rounded-full bg-white/20 p-2 text-white outline-none backdrop-blur-sm transition-colors [-webkit-tap-highlight-color:transparent] focus:ring-0 focus-visible:ring-0 md:hover:bg-white/30"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </button>
                      ) : null}
                    </div>
                    }

                    <input ref={coverInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif" className="hidden" onChange={handleCoverChange} disabled={uploading} />

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
