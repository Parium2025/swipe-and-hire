import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, File, Video, FileText, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { createSignedUrl, convertToSignedUrl } from '@/utils/storageUtils';
import { preloadSingleFile } from '@/lib/serviceWorkerManager';
import { Progress } from '@/components/ui/progress';
import { openCvFile } from '@/utils/cvUtils';
import { CvViewer } from '@/components/CvViewer';
import { uploadMedia, getMediaUrl, deleteMedia, type MediaType } from '@/lib/mediaManager';

interface FileUploadProps {
  onFileUploaded: (url: string, fileName: string) => void;
  onFileRemoved?: () => void;
  currentFile?: { url: string; name: string };
  acceptedFileTypes?: string[];
  maxFileSize?: number;
  questionType?: string;
  mediaType?: MediaType; // Används för att bestämma bucket via mediaManager
}

const FileUpload: React.FC<FileUploadProps> = ({
  onFileUploaded,
  onFileRemoved,
  currentFile,
  acceptedFileTypes = ['image/*', 'video/*', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  maxFileSize = 10 * 1024 * 1024, // 10MB default
  questionType,
  mediaType = 'cv' // Default till CV för job-applications bucket
}) => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [previewFile, setPreviewFile] = useState<{ file: File; url: string } | null>(null);
  const { toast } = useToast();

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
    setUploading(true);
    setUploadProgress(0);
    try {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        throw new Error('Du måste vara inloggad för att ladda upp filer');
      }

      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
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
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Fel vid uppladdning",
        description: error instanceof Error ? error.message : "Kunde inte ladda upp filen.",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      // Check if it's a video file for preview
      const isVideo = file.type.startsWith('video/');
      if (isVideo) {
        const url = URL.createObjectURL(file);
        setPreviewFile({ file, url });
      } else {
        // Non-video files upload immediately
        uploadFile(file);
      }
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: acceptedFileTypes.reduce((acc, type) => {
      acc[type] = [];
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
      
      toast({
        title: "Fel vid filuppladdning",
        description: message,
        variant: "destructive"
      });
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
    if (questionType === 'video') {
      return 'Video filer (MP4, MOV, AVI)';
    }
    return 'PDF, Word dokument, bilder och videor';
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
              className="text-sm font-medium truncate max-w-[200px] text-white hover:text-primary underline cursor-pointer"
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
            className="h-6 w-6 p-0 text-white transition-all duration-300 md:hover:text-white md:hover:bg-white/10"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>

        {isPdf && (
          <div className="pt-1">
            <CvViewer src={currentFile.url} fileName={currentFile.name} height="70vh" />
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
            <p className="text-xs text-center text-[#FFFFFF] font-medium">{uploadProgress}%</p>
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
        accept={acceptedFileTypes.join(',')}
        style={{ display: 'none' }}
        id={`file-input-${Math.random().toString(36).substring(2)}`}
      />
      
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-3 sm:p-4 text-center cursor-pointer transition-colors ${
          isDragActive
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-muted-foreground bg-white/5 backdrop-blur-sm'
        } ${uploading ? 'pointer-events-none opacity-50' : ''}`}
        onClick={(e) => {
          e.preventDefault();
          open(); // Explicitly open file dialog
        }}
      >
        <div className="space-y-1.5 sm:space-y-2">
          <Upload className="h-6 w-6 sm:h-8 sm:w-8 mx-auto text-[#FFFFFF]" />
          {uploading ? (
            <>
              <p className="text-xs sm:text-sm text-[#FFFFFF]">Laddar upp...</p>
              {uploadProgress > 0 && (
                <div className="max-w-xs mx-auto space-y-1">
                  <Progress value={uploadProgress} className="h-2" />
                  <p className="text-xs text-[#FFFFFF] font-medium">{uploadProgress}%</p>
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
    </>
  );
};

export default FileUpload;