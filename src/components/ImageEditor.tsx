import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ZoomIn, ZoomOut, RotateCcw, Loader2 } from 'lucide-react';

interface ImageEditorProps {
  isOpen: boolean;
  onClose: () => void;
  imageSrc: string;
  onSave: (editedImageBlob: Blob) => void | Promise<void>;
  onRestoreOriginal?: () => void | Promise<void>; // New: callback to restore original image
  isCircular?: boolean;
  aspectRatio?: number; // width/height ratio
}

const ImageEditor: React.FC<ImageEditorProps> = ({
  isOpen,
  onClose,
  imageSrc,
  onSave,
  onRestoreOriginal,
  isCircular = true,
  aspectRatio = 1
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);
  const [minScale, setMinScale] = useState(0.1);
  const [isSaving, setIsSaving] = useState(false);
  const [wasReset, setWasReset] = useState(false); // Track if reset was pressed
  

  const BASE_CANVAS_HEIGHT = 400; // Output canvas height in px
  const CANVAS_HEIGHT = BASE_CANVAS_HEIGHT;
  const CANVAS_WIDTH = Math.round(BASE_CANVAS_HEIGHT * aspectRatio);
  const MAX_SCALE = 3;

  // Reset saving state and wasReset when dialog opens/closes
  useEffect(() => {
    if (!isOpen) {
      setIsSaving(false);
      setWasReset(false);
    }
  }, [isOpen]);

  // Load and setup image
  useEffect(() => {
    if (!imageSrc || !isOpen) return;

    const loadImage = async () => {
      try {
        // Try to fetch the image as blob first to avoid CORS issues
        const response = await fetch(imageSrc);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        
        const img = new Image();
        img.onload = () => {
          imageRef.current = img;
          
          // Calculate initial scale - IDENTISKT för alla bilder (cover)
          const containerWidth = CANVAS_WIDTH;
          const containerHeight = CANVAS_HEIGHT;
          
          // Beräkna scales
          const scaleX = containerWidth / img.width;
          const scaleY = containerHeight / img.height;
          
          // ALLTID använd "cover" som initial scale (fyller hela området utan luckor)
          // Detta ger identiskt zoom-beteende för både cirkulär och rektangulär
          const initialScale = Math.max(scaleX, scaleY);
          setMinScale(Math.min(scaleX, scaleY) * 0.5); // minScale baserat på contain
          
          setScale(initialScale);
          setPosition({ x: 0, y: 0 });
          setImageLoaded(true);
          
          // Clean up blob URL
          URL.revokeObjectURL(blobUrl);
        };
        
        img.onerror = (error) => {
          console.error('Image failed to load from blob:', error);
          URL.revokeObjectURL(blobUrl);
        };
        
        img.src = blobUrl;
      } catch (error) {
        console.error('Failed to fetch image:', error);
        // Fallback to direct loading
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          imageRef.current = img;
          
          const containerWidth = CANVAS_WIDTH;
          const containerHeight = CANVAS_HEIGHT;
          const scaleX = containerWidth / img.width;
          const scaleY = containerHeight / img.height;
          
          // ALLTID använd "cover" som initial scale
          const initialScale = Math.max(scaleX, scaleY);
          setMinScale(Math.min(scaleX, scaleY) * 0.5);
          
          setScale(initialScale);
          setPosition({ x: 0, y: 0 });
          setImageLoaded(true);
        };
        img.src = imageSrc;
      }
    };

    loadImage();
  }, [imageSrc, isOpen, CANVAS_WIDTH, CANVAS_HEIGHT]);

  // Draw canvas
  const drawCanvas = useCallback(() => {
    if (!canvasRef.current || !imageRef.current || !imageLoaded) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = imageRef.current;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Save context for clipping
    ctx.save();
    
    // Create clipping path
    if (isCircular) {
      const radius = Math.min(CANVAS_WIDTH, CANVAS_HEIGHT) / 2 - 2;
      ctx.beginPath();
      ctx.arc(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, radius, 0, Math.PI * 2);
      ctx.clip();
    } else {
      // Rectangular clipping
      ctx.beginPath();
      ctx.rect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.clip();
    }
    
    // Calculate image position and size
    const scaledWidth = img.width * scale;
    const scaledHeight = img.height * scale;
    
    const centerX = CANVAS_WIDTH / 2;
    const centerY = CANVAS_HEIGHT / 2;
    
    const imageX = centerX - scaledWidth / 2 + position.x;
    const imageY = centerY - scaledHeight / 2 + position.y;
    
    // Draw image
    ctx.drawImage(img, imageX, imageY, scaledWidth, scaledHeight);
    
    // Restore context
    ctx.restore();
    
    // Draw border
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 2;
    if (isCircular) {
      ctx.beginPath();
      const radius = Math.min(CANVAS_WIDTH, CANVAS_HEIGHT) / 2 - 1;
      ctx.arc(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Ingen border för rektangulära bilder - ta bort de vita kanterna
  }, [scale, position, imageLoaded, isCircular]);

  // Redraw when properties change
  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  // Mouse events for dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isSaving) return;
    setIsDragging(true);
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      setDragStart({
        x: e.clientX - rect.left - position.x,
        y: e.clientY - rect.top - position.y
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !canvasRef.current || isSaving) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const newX = e.clientX - rect.left - dragStart.x;
    const newY = e.clientY - rect.top - dragStart.y;
    
    setPosition({ x: newX, y: newY });
    setWasReset(false); // User made manual change
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch events for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (isSaving) return;
    e.preventDefault();
    const touch = e.touches[0];
    setIsDragging(true);
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      setDragStart({
        x: touch.clientX - rect.left - position.x,
        y: touch.clientY - rect.top - position.y
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isSaving) return;
    e.preventDefault();
    if (!isDragging || !canvasRef.current) return;
    
    const touch = e.touches[0];
    const rect = canvasRef.current.getBoundingClientRect();
    const newX = touch.clientX - rect.left - dragStart.x;
    const newY = touch.clientY - rect.top - dragStart.y;
    
    setPosition({ x: newX, y: newY });
    setWasReset(false); // User made manual change
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  // Zoom functions
  const zoomIn = () => {
    if (isSaving) return;
    setScale(prev => Math.min(prev + 0.2, MAX_SCALE));
    setWasReset(false); // User made manual change
  };

  const zoomOut = () => {
    if (isSaving) return;
    setScale(prev => Math.max(prev - 0.2, minScale));
    setWasReset(false); // User made manual change
  };

  const resetPosition = () => {
    if (isSaving) return;
    setPosition({ x: 0, y: 0 });
    setWasReset(true); // Mark that reset was pressed
    if (imageRef.current) {
      const img = imageRef.current;
      const containerWidth = CANVAS_WIDTH;
      const containerHeight = CANVAS_HEIGHT;
      
      // ALLTID återställ till "cover" scale (identiskt för alla bilder)
      const scaleX = containerWidth / img.width;
      const scaleY = containerHeight / img.height;
      const initialScale = Math.max(scaleX, scaleY);
      setScale(initialScale);
    }
  };

  // Save edited image
  const handleSaveClick = async () => {
    if (isSaving || !canvasRef.current) {
      console.log('ImageEditor: Already saving or no canvas');
      return;
    }
    
    setIsSaving(true);
    
    // Om reset trycktes och onRestoreOriginal finns, återställ originalet automatiskt
    if (wasReset && onRestoreOriginal) {
      console.log('ImageEditor: Reset was pressed, restoring original...');
      try {
        await onRestoreOriginal();
        console.log('ImageEditor: Original restored successfully');
        onClose();
      } catch (error) {
        console.error('ImageEditor: Restore original failed:', error);
        setIsSaving(false);
      }
      return;
    }
    
    console.log('ImageEditor: Starting save process...');
    
    try {
      // Använd Promise för att vänta på blob-generering
      const blob = await new Promise<Blob | null>((resolve) => {
        canvasRef.current!.toBlob((result) => {
          resolve(result);
        }, 'image/png', 1.0);
      });
      
      if (blob) {
        console.log('ImageEditor: Blob generated, size:', blob.size);
        await onSave(blob);
        console.log('ImageEditor: onSave completed successfully');
        onClose(); // Close dialog after saving completes
      } else {
        console.error('ImageEditor: Failed to generate blob');
        setIsSaving(false);
      }
    } catch (error) {
      console.error('ImageEditor: onSave failed:', error);
      setIsSaving(false);
    }
  };

  const handleCancelClick = () => {
    if (isSaving) return;
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isSaving && !open && onClose()}>
      <DialogContent className="max-w-md bg-white/5 border-white/20 backdrop-blur-sm">
        <DialogHeader>
          <DialogTitle className="text-center text-white">
            Anpassa din {isCircular ? 'profilbild' : 'bild'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Canvas */}
          <div className="flex justify-center">
            <div className="relative">
              <canvas
                ref={canvasRef}
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
                className={`cursor-${isDragging ? 'grabbing' : 'grab'} ${isCircular ? 'rounded-full' : 'rounded-lg'} ${isSaving ? 'opacity-50' : ''}`}
                style={{ backgroundColor: 'transparent' }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              />
              {isSaving && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 text-white animate-spin" />
                </div>
              )}
            </div>
          </div>

          {/* Controls */}
          <div className="flex justify-center space-x-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={zoomOut}
              disabled={scale <= minScale || isSaving}
              className="bg-white/5 border-white/10 !text-white hover:bg-white/10 hover:!text-white hover:border-white/50 md:hover:bg-white/10 md:hover:!text-white md:hover:border-white/50 disabled:opacity-50 disabled:hover:bg-white/5"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={resetPosition}
              disabled={isSaving}
              className="bg-white/5 border-white/10 !text-white hover:bg-white/10 hover:!text-white hover:border-white/50 md:hover:bg-white/10 md:hover:!text-white md:hover:border-white/50"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
            
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={zoomIn}
              disabled={scale >= MAX_SCALE || isSaving}
              className="bg-white/5 border-white/10 !text-white hover:bg-white/10 hover:!text-white hover:border-white/50 md:hover:bg-white/10 md:hover:!text-white md:hover:border-white/50 disabled:opacity-50 disabled:hover:bg-white/5"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>

          <p className="text-sm text-white text-center font-medium">
            Dra för att flytta bild och använd knapparna för att zooma in eller ut
          </p>

          {/* Action buttons */}
          <div className="flex space-x-2">
            <Button 
              type="button"
              onClick={handleCancelClick}
              disabled={isSaving}
              className="flex-1 transition-all duration-200 !text-white bg-white/5 border-white/10 hover:bg-white/10 hover:!text-white hover:border-white/50 md:hover:bg-white/10 md:hover:!text-white md:hover:border-white/50 disabled:opacity-50"
              variant="outline"
            >
              Avbryt
            </Button>
            <Button 
              type="button"
              onClick={handleSaveClick}
              disabled={isSaving}
              className="flex-1 transition-all duration-200 !text-white bg-white/5 border-white/10 hover:bg-white/10 hover:!text-white hover:border-white/50 md:hover:bg-white/10 md:hover:!text-white md:hover:border-white/50 disabled:opacity-50"
              variant="outline"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sparar...
                </>
              ) : (
                'Spara'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ImageEditor;