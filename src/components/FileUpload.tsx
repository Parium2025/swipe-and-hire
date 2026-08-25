import React, { useCallback, useState } from 'react';
import { looksLikeVideoFile, MAX_VIDEO_SECONDS, ACCEPTED_VIDEO_EXTENSIONS } from '@/lib/videoInput';
import { useDropzone } from 'react-dropzone';
import { Upload, X, File, Video, FileText, Check, WifiOff, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { createSignedUrl, convertToSignedUrl } from '@/utils/storageUtils';
import { preloadSingleFile } from '@/lib/serviceWorkerManager';
import { Progress } from '@/components/ui/progress';
import { openCvFile } from '@/utils/cvUtils';
import { CvViewer } from '@/components/CvViewer';
import { uploadMedia, getMediaUrl, deleteMedia, type MediaType } from '@/lib/mediaManager';
import { useOnline } from '@/hooks/useOnlineStatus';

interface FileUploadProps {
  onFileUploaded: (url: string, fileName: string) => void;
  onFileRemoved?: () => void;
  currentFile?: { url: string; name: string };
  acceptedFileTypes?: string[];
  maxFileSize?: number;
  questionType?: string;
  mediaType?: MediaType; // Används för att bestämma bucket via mediaManager
  uploadType?: 'image' | 'video' | 'document' | 'all'; // Typ av uppladdning för att visa rätt text
}

const FileUpload: React.FC<FileUploadProps> = ({
  onFileUploaded,
  onFileRemoved,
  currentFile,
  acceptedFileTypes = ['image/*', 'video/*', 'application/pdf', '.pdf', '.doc', '.docx', '.rtf', '.odt', '.txt', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/rtf', 'application/vnd.oasis.opendocument.text', 'text/plain'],
  maxFileSize = 50 * 1024 * 1024, // 50MB default
  questionType,
  mediaType = 'cv', // Default till CV för job-applications bucket
  uploadType = 'all' // Default visar alla filtyper
}) => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [previewFile, setPreviewFile] = useState<{ file: File; url: string } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [lastFailedFile, setLastFailedFile] = useState<File | null>(null);
  const { toast } = useToast();
  const { isOnline, showOfflineToast } = useOnline();


  const getFileIcon = (fileName: string) => {
    const extension = fileName.toLowerCase().split('.').pop();
    if (['mp4', 'mov', 'avi', 'mkv'].includes(extension || '')) {
      return <Video className="h-4 w-4 text-white" />;
    }
    if (['pdf'].includes(extension || '')) {
      return <FileText className="h-4 w-4 text-white" />;
    }
    return <File className="h-4 w-4 text-white" />;
  };

  const uploadFile = async (file: File) => {
    if (!navigator.onLine) {
      setLastFailedFile(file);
      setUploadError('Ingen internetanslutning. Filen laddas inte upp – anslut igen och försök på nytt.');
      return;
    }
    setUploading(true);
    setUploadProgress(0);
    setUploadError(null);
    // Deklareras utanför try: annars fortsätter intervallet för evigt om
    // uppladdningen kastar innan clearInterval hinner köras.
    let progressInterval: ReturnType<typeof setInterval> | undefined;
    try {

      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        throw new Error('Du måste vara inloggad för att ladda upp filer');
      }

      // Simulate progress for better UX
      progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) return prev;
          return prev + 10;
        });
      }, 200);

      // Använd mediaManager för konsekvent uppladdning (sparar endast storage path)
      const { storagePath, error: uploadError } = await uploadMedia(
        file,
        mediaType,
        data.user.id
      );

      clearInterval(progressInterval);
      progressInterval = undefined;
      setUploadProgress(100);

      if (uploadError || !storagePath) throw uploadError || new Error('Upload failed');

      // ALWAYS store storage path, never URLs (signed or public)
      // This ensures permanent access - URLs are generated on-demand when needed
      onFileUploaded(storagePath, file.name);
      
      // Förladdda den signerade URL:en i bakgrunden (utan att blockera UI)
      import('@/lib/serviceWorkerManager').then(async ({ preloadSingleFile }) => {
        const signed = await getMediaUrl(storagePath, mediaType, 86400);
        if (signed) {
          preloadSingleFile(signed).catch(err => console.log('Preload error:', err));
        }
      });
      
      toast({
        title: "Fil uppladdad!",
        description: `${file.name} har laddats upp framgångsrikt.`
      });

      // Clear preview after successful upload
      if (previewFile) {
        URL.revokeObjectURL(previewFile.url);
        setPreviewFile(null);
      }
      setLastFailedFile(null);
    } catch (error) {
      console.error('Upload error:', error);
      const offline = !navigator.onLine;
      const message = offline
        ? 'Ingen internetanslutning. Anslut igen och försök på nytt.'
        : error instanceof Error
          ? error.message
          : 'Något gick fel när filen skulle laddas upp.';
      setLastFailedFile(file);
      setUploadError(message);
    } finally {
      if (progressInterval) clearInterval(progressInterval);
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const readVideoDuration = (url: string) =>
    new Promise<number | null>((resolve) => {
      const el = document.createElement('video');
      el.preload = 'metadata';
      const done = (value: number | null) => {
        el.onloadedmetadata = null;
        el.onerror = null;
        resolve(value);
      };
      el.onloadedmetadata = () => done(Number.isFinite(el.duration) ? el.duration : null);
      el.onerror = () => done(null);
      el.src = url;
      // Säkerhetsventil om metadata aldrig kommer
      window.setTimeout(() => done(null), 8000);
    });

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    
    const file = acceptedFiles[0];
    if (file) {

      // Check if it's a video file for preview
      const isVideo = looksLikeVideoFile(file);
      if (isVideo) {
        const url = URL.createObjectURL(file);
        const seconds = await readVideoDuration(url);
        if (seconds !== null && seconds > MAX_VIDEO_SECONDS) {
          URL.revokeObjectURL(url);
          setLastFailedFile(null);
          setUploadError(
            `Videon är ${Math.round(seconds)} sekunder. Max längd är ${MAX_VIDEO_SECONDS} sekunder – korta ner den och försök igen.`
          );
          return;
        }
        setPreviewFile({ file, url });
      } else {
        // Non-video files upload immediately
        uploadFile(file);
      }
    }
  }, [isOnline, showOfflineToast]);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    // Videoändelserna måste listas explicit: Android och vissa Windows-
    // filväljare skickar tom MIME-typ, och då matchar inte 'video/*'.
    accept: acceptedFileTypes.reduce((acc, type) => {
      acc[type] = type === 'video/*' ? [...ACCEPTED_VIDEO_EXTENSIONS] : [];
      return acc;
    }, {} as Record<string, string[]>),
    maxSize: maxFileSize,
    multiple: false,
    noClick: false, // Allow click to open file dialog
    onDropRejected: (fileRejections) => {
      const error = fileRejections[0]?.errors[0];
      let message = "Filen kunde inte laddas upp.";
      
      if (error?.code === 'file-too-large') {
        message = `Filen är för stor. Max storlek är ${Math.round(maxFileSize / 1024 / 1024)}MB.`;
      } else if (error?.code === 'file-invalid-type') {
        message = "Filtypen stöds inte.";
      }
      
      setLastFailedFile(null);
      setUploadError(message);
    }

  });

  const handleRemoveFile = () => {
    onFileRemoved?.();
  };

  const handleCancelPreview = () => {
    if (previewFile) {
      URL.revokeObjectURL(previewFile.url);
      setPreviewFile(null);
    }
  };

  const handleConfirmUpload = () => {
    if (previewFile) {
      uploadFile(previewFile.file);
    }
  };

  const getAcceptedTypesText = () => {
    if (questionType === 'video' || uploadType === 'video') {
      return 'Video (MP4, MOV, WEBM)';
    }
    if (uploadType === 'image') {
      return 'Bilder';
    }
    if (uploadType === 'document') {
      return 'PDF, Word dokument';
    }
    // Härled texten från de faktiskt tillåtna filtyperna så att den aldrig
    // lovar mer än vad uppladdningen accepterar.
    const labels: string[] = [];
    const has = (needle: string) => acceptedFileTypes.some((t) => t.includes(needle));
    if (has('pdf')) labels.push('PDF');
    if (has('msword') || has('wordprocessingml')) labels.push('Word');
    if (has('image/')) labels.push('bilder');
    if (has('video/')) labels.push('videor');
    if (labels.length === 0) return 'Filer';
    if (labels.length === 1) return labels[0];
    return `${labels.slice(0, -1).join(', ')} eller ${labels[labels.length - 1]}`;
  };

  if (currentFile) {
    const isPdf = /\.pdf($|\?)/i.test(currentFile.url) || /\.pdf($|\?)/i.test(currentFile.name || '');

    return (
      <div className="border border-white/10 rounded-md p-4 bg-white/5 backdrop-blur-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getFileIcon(currentFile.name)}
            <a
              href="#"
              className="text-sm font-medium truncate max-w-[320px] text-white hover:text-white underline cursor-pointer"
              onClick={async (e) => {
                e.preventDefault();
                if (isPdf) return; // Inline viewer below
                
                // Använd openCvFile för robust öppning av alla filer via mediaManager
                await openCvFile({
                  cvUrl: currentFile.url,
                  fileName: currentFile.name,
                  onError: (error) => {
                    toast({
                      title: "Fel vid öppning",
                      description: error.message,
                      variant: "destructive"
                    });
                  }
                });
              }}
            >
              {currentFile.name}
            </a>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRemoveFile}
            className="h-7 w-7 p-0 !min-h-0 !min-w-0 overflow-hidden rounded-full text-white hover:bg-transparent hover:text-white transition-none"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        {isPdf && (
          <div className="pt-1">
            <CvViewer src={currentFile.url} fileName={currentFile.name} height="70vh" showDownload={false} />
          </div>
        )}
      </div>
    );
  }

  // Show video preview before upload
  if (previewFile) {
    return (
      <div className="space-y-4">
        <div className="border border-border rounded-lg overflow-hidden bg-muted/30">
          <video 
            src={previewFile.url} 
            controls 
            playsInline
            preload="metadata"
            className="w-full h-auto max-h-64 object-contain bg-black"
          />
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleConfirmUpload}
            disabled={uploading}
            className="flex-1"
          >
            <Check className="h-4 w-4 mr-2" />
            {uploading ? 'Laddar upp...' : 'Spara video'}
          </Button>
          <Button
            onClick={handleCancelPreview}
            variant="outline"
            disabled={uploading}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        {uploading && uploadProgress > 0 && (
          <div className="space-y-2">
            <Progress value={uploadProgress} className="h-2" />
            <p className="text-xs text-center text-white">{uploadProgress}%</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      {/* Hidden file input for better mobile support */}
      <input 
        {...getInputProps()} 
        accept={[
          ...acceptedFileTypes,
          ...(acceptedFileTypes.includes('video/*') ? ACCEPTED_VIDEO_EXTENSIONS : []),
        ].join(',')}
        style={{ display: 'none' }}
        id={`file-input-${Math.random().toString(36).substring(2)}`}
      />
      
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-3 sm:p-4 text-center cursor-pointer transition-all duration-300 ${
          isDragActive
            ? 'border-primary bg-primary/5'
              : 'border-white/20 md:hover:border-white/40 md:hover:bg-white/10 bg-white/5 backdrop-blur-sm'
        } ${uploading ? 'pointer-events-none' : ''}`}
        onClick={(e) => {
          e.preventDefault();
          open(); // Explicitly open file dialog
        }}
      >
        <div className="space-y-1.5 sm:space-y-2">
          <Upload className="h-6 w-6 sm:h-8 sm:w-8 mx-auto text-[#FFFFFF]" />
          {!isOnline ? (
            <>
              <WifiOff className="h-6 w-6 sm:h-8 sm:w-8 mx-auto text-white/50" />
              <p className="text-xs sm:text-sm text-white/50">Offline - uppladdning inte tillgänglig</p>
            </>
          ) : uploading ? (
            <>
              <p className="text-xs sm:text-sm text-[#FFFFFF]">Laddar upp...</p>
              {uploadProgress > 0 && (
                <div className="max-w-xs mx-auto space-y-1">
                  <Progress value={uploadProgress} className="h-2" />
                  <p className="text-xs text-[#FFFFFF]">{uploadProgress}%</p>
                </div>
              )}
            </>
          ) : (
            <>
              <p className="text-xs sm:text-sm font-medium text-white">
                {isDragActive
                  ? 'Släpp filen här...'
                  : 'Klicka för att välja fil'}
              </p>
              <p className="text-xs sm:text-sm text-white">
                {getAcceptedTypesText()} (max {Math.round(maxFileSize / 1024 / 1024)}MB)
              </p>
            </>
          )}
        </div>
      </div>

      {uploadError && (
        <div
          role="alert"
          className="mt-3 flex items-start gap-3 rounded-2xl border border-red-400/40 bg-red-500/10 backdrop-blur-sm px-3.5 py-3 animate-fade-in"
        >
          <div className="mt-0.5 shrink-0 rounded-full bg-red-500/20 p-1.5">
            {navigator.onLine ? (
              <AlertCircle className="h-4 w-4 text-red-200" />
            ) : (
              <WifiOff className="h-4 w-4 text-red-200" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-white break-words">Uppladdningen misslyckades</p>
            <p className="text-xs text-white/90 break-words leading-relaxed mt-0.5">{uploadError}</p>
          </div>
          {lastFailedFile && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={uploading}
              onClick={(e) => {
                e.stopPropagation();
                if (lastFailedFile) uploadFile(lastFailedFile);
              }}
              className="shrink-0 h-8 rounded-full px-3 text-xs font-medium text-white bg-white/10 hover:bg-white/20 focus-visible:ring-0 focus-visible:ring-offset-0"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Försök igen
            </Button>
          )}
        </div>
      )}
    </>

  );
};

export default FileUpload;