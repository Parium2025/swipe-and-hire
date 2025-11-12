import React, { useCallback, useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, File, Video, FileText, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { createSignedUrl, convertToSignedUrl } from '@/utils/storageUtils';
import { preloadSingleFile } from '@/lib/serviceWorkerManager';
import { Progress } from '@/components/ui/progress';

interface FileUploadProps {
  onFileUploaded: (url: string, fileName: string) => void;
  onFileRemoved?: () => void;
  currentFile?: { url: string; name: string };
  acceptedFileTypes?: string[];
  maxFileSize?: number;
  questionType?: string;
  bucketName?: string; // default: 'job-applications'
  isProfileMedia?: boolean; // Use public profile-media bucket
}

const FileUpload: React.FC<FileUploadProps> = ({
  onFileUploaded,
  onFileRemoved,
  currentFile,
  acceptedFileTypes = ['image/*', 'video/*', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  maxFileSize = 10 * 1024 * 1024, // 10MB default
  questionType,
  bucketName = 'job-applications',
  isProfileMedia = false
}) => {
  // Determine if bucket is public (profile-media, company-logos, job-images)
  const isPublicBucket = isProfileMedia || 
                         bucketName === 'profile-media' || 
                         bucketName === 'company-logos' || 
                         bucketName === 'job-images';
  const actualBucket = isProfileMedia ? 'profile-media' : bucketName;
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [previewFile, setPreviewFile] = useState<{ file: File; url: string } | null>(null);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const { toast } = useToast();

  const getFileIcon = (fileName: string) => {
    const extension = fileName.toLowerCase().split('.').pop();
    if (['mp4', 'mov', 'avi', 'mkv'].includes(extension || '')) {
      return <Video className="h-4 w-4" />;
    }
    if (['pdf'].includes(extension || '')) {
      return <FileText className="h-4 w-4" />;
    }
    return <File className="h-4 w-4" />;
  };

  // Generate PDF preview URL when currentFile changes
  useEffect(() => {
    const generatePreviewUrl = async () => {
      if (!currentFile) {
        setPdfPreviewUrl(null);
        return;
      }

      const name = currentFile.name.toLowerCase();
      const isPDF = name.endsWith('.pdf');
      const isWord = name.endsWith('.doc') || name.endsWith('.docx');

      // Reset both when file changes
      setPdfPreviewUrl(null);

      try {
        const isStoragePath = !currentFile.url.startsWith('http');

        // Resolve a fetchable URL first (public, signed, or converted)
        let fetchableUrl: string | null = null;
        if (isPublicBucket) {
          if (isStoragePath) {
            const { data } = supabase.storage.from(actualBucket).getPublicUrl(currentFile.url);
            fetchableUrl = data.publicUrl;
          } else {
            fetchableUrl = currentFile.url;
          }
        } else if (isStoragePath) {
          fetchableUrl = await createSignedUrl(actualBucket, currentFile.url, 86400, currentFile.name);
        } else {
          fetchableUrl = await convertToSignedUrl(currentFile.url, actualBucket, 86400, currentFile.name);
        }

        if (!fetchableUrl) {
          setPdfPreviewUrl(null);
          return;
        }

        if (isPDF) {
          setPdfPreviewUrl(fetchableUrl);
        } else if (isWord) {
          // Use Microsoft Office viewer for Word docs
          const officeUrl = `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(fetchableUrl)}`;
          setPdfPreviewUrl(officeUrl);
        }
      } catch (err) {
        console.error('Error generating preview URL:', err);
        setPdfPreviewUrl(null);
      }
    };

    generatePreviewUrl();
  }, [currentFile, actualBucket, isPublicBucket]);

  const uploadFile = async (file: File) => {
    setUploading(true);
    setUploadProgress(0);
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) {
        throw new Error('Du måste vara inloggad för att ladda upp filer');
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.data.user.id}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) return prev;
          return prev + 10;
        });
      }, 200);

      const { error: uploadError } = await supabase.storage
        .from(actualBucket)
        .upload(fileName, file);

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (uploadError) throw uploadError;

      // For public buckets (profile-media, company-logos, job-images)
      if (isPublicBucket) {
        // CRITICAL FIX: Store storage path, not public URL (videos never expire this way)
        // The component will build publicUrl when displaying
        onFileUploaded(fileName, file.name);
        
        // Build public URL for preloading only
        const { data: { publicUrl } } = supabase.storage
          .from(actualBucket)
          .getPublicUrl(fileName);
        
        // Preload public files in Service Worker for offline access
        await preloadSingleFile(publicUrl);
      } else {
        // For private buckets, return storage path (signed URLs generated on demand)
        onFileUploaded(fileName, file.name);
      }
      
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
    const isStoragePath = !currentFile.url.startsWith('http');
    const lowerName = currentFile.name.toLowerCase();
    const isPDF = lowerName.endsWith('.pdf');
    const isWord = lowerName.endsWith('.doc') || lowerName.endsWith('.docx');

    const handleOpenFile = async (e: React.MouseEvent) => {
      e.preventDefault();
      const popup = window.open('', '_blank');
      
      try {
        let finalUrl = currentFile.url;
        
        // Resolve final URL
        if (isPublicBucket) {
          if (isStoragePath) {
            const { data } = supabase.storage.from(actualBucket).getPublicUrl(currentFile.url);
            finalUrl = data.publicUrl;
          } else {
            finalUrl = currentFile.url;
          }
        } else if (isStoragePath) {
          const signedUrl = await createSignedUrl(actualBucket, currentFile.url, 86400, currentFile.name);
          finalUrl = signedUrl || currentFile.url;
        } else {
          const signedUrl = await convertToSignedUrl(currentFile.url, actualBucket, 86400, currentFile.name);
          finalUrl = signedUrl || currentFile.url;
        }
        
        if (popup) {
          popup.location.href = finalUrl;
        } else {
          window.open(finalUrl, '_blank');
        }
      } catch (err) {
        console.error('Error opening file:', err);
        popup?.close();
      }
    };

    return (
      <div className="border border-border rounded-lg overflow-hidden bg-muted/30">
        {/* PDF Preview */}
        {(isPDF || isWord) && pdfPreviewUrl ? (
          <div className="relative">
            <iframe
              src={isPDF ? `${pdfPreviewUrl}#toolbar=0&navpanes=0&scrollbar=0` : pdfPreviewUrl}
              className="w-full h-48 bg-white"
              title="CV Preview"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
            <button
              onClick={handleOpenFile}
              className="absolute inset-0 w-full h-full cursor-pointer hover:bg-black/10 transition-colors flex items-center justify-center group"
            >
              <div className="bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-sm font-medium text-gray-900">Klicka för att öppna i ny flik</span>
              </div>
            </button>
          </div>
        ) : null}
        
        {/* File info and remove button */}
        <div className="p-3 flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {getFileIcon(currentFile.name)}
            <button
              onClick={handleOpenFile}
              className="text-sm font-medium truncate text-white hover:text-primary underline cursor-pointer"
            >
              {currentFile.name}
            </button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRemoveFile}
            className="h-8 w-8 p-0 flex-shrink-0 transition-all duration-300 md:hover:text-white md:hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
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
        accept={acceptedFileTypes.join(',')}
        style={{ display: 'none' }}
        id={`file-input-${Math.random().toString(36).substring(2)}`}
      />
      
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-3 sm:p-4 text-center cursor-pointer transition-colors ${
          isDragActive
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-muted-foreground bg-muted/30'
        } ${uploading ? 'pointer-events-none opacity-50' : ''}`}
        onClick={(e) => {
          e.preventDefault();
          open(); // Explicitly open file dialog
        }}
      >
        <div className="space-y-1.5 sm:space-y-2">
          <Upload className="h-6 w-6 sm:h-8 sm:w-8 mx-auto text-white" />
          {uploading ? (
            <>
              <p className="text-xs sm:text-sm text-white">Laddar upp...</p>
              {uploadProgress > 0 && (
                <div className="max-w-xs mx-auto space-y-1">
                  <Progress value={uploadProgress} className="h-2" />
                  <p className="text-xs text-white">{uploadProgress}%</p>
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