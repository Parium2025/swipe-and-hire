import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, File, Video, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { createSignedUrl, convertToSignedUrl } from '@/utils/storageUtils';

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

  const uploadFile = async (file: File) => {
    setUploading(true);
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) {
        throw new Error('Du måste vara inloggad för att ladda upp filer');
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.data.user.id}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from(actualBucket)
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // For public buckets (profile-media, company-logos, job-images), get public URL directly
      if (isPublicBucket) {
        const { data: { publicUrl } } = supabase.storage
          .from(actualBucket)
          .getPublicUrl(fileName);
        
        onFileUploaded(publicUrl, file.name);
      } else {
        // For private buckets, use signed URLs
        const signedUrl = await createSignedUrl(actualBucket, fileName, 86400, file.name);
        if (!signedUrl) {
          throw new Error('Could not create secure access URL');
        }
        onFileUploaded(fileName, file.name);
      }
      
      toast({
        title: "Fil uppladdad!",
        description: `${file.name} har laddats upp framgångsrikt.`
      });
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Fel vid uppladdning",
        description: error instanceof Error ? error.message : "Kunde inte ladda upp filen.",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      uploadFile(file);
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

  const getAcceptedTypesText = () => {
    if (questionType === 'video') {
      return 'Video filer (MP4, MOV, AVI)';
    }
    return 'PDF, Word dokument, bilder och videor';
  };

  if (currentFile) {
    // Determine display URL behavior; for storage paths and conversions, we open on click
    const isPublicUrl = currentFile.url.includes('/storage/v1/object/public/');
    const isSignedUrl = currentFile.url.includes('/storage/v1/object/sign/');
    const isStoragePath = !currentFile.url.startsWith('http');
    const displayUrl = (isPublicUrl || isStoragePath) ? '#' : currentFile.url;

    return (
      <div className="border border-border rounded-md p-4 bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getFileIcon(currentFile.name)}
            <a
              href={displayUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium truncate max-w-[200px] text-white hover:text-primary underline cursor-pointer"
              onClick={(e) => {
                e.preventDefault();
                const popup = window.open('', '_blank');
                const openUrl = (url?: string | null) => {
                  if (!url) { popup?.close(); return; }
                  if (popup) popup.location.href = url;
                  else window.open(url, '_blank');
                };
                (async () => {
                  try {
                    // For public buckets, just open the URL directly
                    if (isPublicBucket || 
                        currentFile.url.includes('/profile-media/') ||
                        currentFile.url.includes('/company-logos/') ||
                        currentFile.url.includes('/job-images/')) {
                      openUrl(currentFile.url);
                    } else if (isStoragePath) {
                      const signedUrl = await createSignedUrl(actualBucket, currentFile.url, 86400, currentFile.name);
                      openUrl(signedUrl);
                    } else {
                      const signedUrl = await convertToSignedUrl(currentFile.url, actualBucket, 86400, currentFile.name);
                      openUrl(signedUrl);
                    }
                  } catch (err) {
                    console.error('Error opening file:', err);
                    popup?.close();
                  }
                })();
              }}
            >
              {currentFile.name}
            </a>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRemoveFile}
            className="h-6 w-6 p-0 transition-all duration-300 md:hover:text-white md:hover:bg-white/10"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
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
            <p className="text-xs sm:text-sm text-white">Laddar upp...</p>
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