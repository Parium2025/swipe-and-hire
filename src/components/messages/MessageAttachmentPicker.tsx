import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Paperclip, X, Image as ImageIcon, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface MessageAttachmentPickerProps {
  userId: string;
  recipientId: string;
  onAttachmentUploaded: (attachment: {
    url: string;
    type: string;
    name: string;
  }) => void;
  disabled?: boolean;
}

const ALLOWED_TYPES = {
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/gif': 'image',
  'image/webp': 'image',
  'application/pdf': 'document',
  'application/msword': 'document',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'document',
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function MessageAttachmentPicker({
  userId,
  recipientId,
  onAttachmentUploaded,
  disabled,
}: MessageAttachmentPickerProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<{ url: string; name: string; type: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const fileType = ALLOWED_TYPES[file.type as keyof typeof ALLOWED_TYPES];
    if (!fileType) {
      toast.error('Filtyp stöds inte', { 
        description: 'Tillåtna format: JPG, PNG, GIF, WebP, PDF, Word' 
      });
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      toast.error('Filen är för stor', { description: 'Max storlek är 10 MB' });
      return;
    }

    setUploading(true);

    try {
      // Create unique file path: userId/timestamp-filename
      const timestamp = Date.now();
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filePath = `${userId}/${timestamp}-${sanitizedName}`;

      // Upload to Supabase storage
      const { error: uploadError } = await supabase.storage
        .from('message-attachments')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get signed URL (valid for 1 year)
      const { data: urlData, error: urlError } = await supabase.storage
        .from('message-attachments')
        .createSignedUrl(filePath, 60 * 60 * 24 * 365);

      if (urlError) throw urlError;

      const attachment = {
        url: urlData.signedUrl,
        type: fileType,
        name: file.name,
      };

      // Show preview for images
      if (fileType === 'image') {
        setPreview(attachment);
      } else {
        setPreview(attachment);
      }

      onAttachmentUploaded(attachment);
      toast.success('Bilaga uppladdad');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Kunde inte ladda upp bilaga');
    } finally {
      setUploading(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const clearPreview = () => {
    setPreview(null);
  };

  return (
    <div className="flex items-center gap-2">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled || uploading}
      />

      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled || uploading}
        className="h-11 w-11 flex-shrink-0 text-white/60 hover:text-white hover:bg-white/10"
      >
        {uploading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <Paperclip className="h-5 w-5" />
        )}
      </Button>

      {/* Preview */}
      {preview && (
        <div className={cn(
          "relative rounded-lg overflow-hidden border border-white/10",
          preview.type === 'image' ? "w-12 h-12" : "px-3 py-2 bg-white/5"
        )}>
          {preview.type === 'image' ? (
            <img 
              src={preview.url} 
              alt={preview.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex items-center gap-2 text-white text-xs">
              <FileText className="h-4 w-4 text-blue-400" />
              <span className="truncate max-w-[100px]">{preview.name}</span>
            </div>
          )}
          <button
            onClick={clearPreview}
            className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center"
          >
            <X className="h-3 w-3 text-white" />
          </button>
        </div>
      )}
    </div>
  );
}
