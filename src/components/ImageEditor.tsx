import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DialogContentNoFocus } from '@/components/ui/dialog-no-focus';
import { ZoomIn, ZoomOut, RotateCcw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface ImageEditorProps {
  isOpen: boolean;
  onClose: () => void;
  imageSrc: string;
  onSave: (editedImageBlob: Blob) => void | Promise<void>;
  onRestoreOriginal?: () => void | Promise<void>; // New: callback to restore original image
  isCircular?: boolean;
  aspectRatio?: number; // width/height ratio
  cropMode?: 'default' | 'mobile-swipe';
}

const ImageEditor: React.FC<ImageEditorProps> = ({
  isOpen,
  onClose,
  imageSrc,
  onSave,
  onRestoreOriginal,
  isCircular = true,
  aspectRatio = 1,
  cropMode = 'default',
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
  const [hasUserMadeChanges, setHasUserMadeChanges] = useState(false); // Track if user actually edited
  const initialScaleRef = useRef<number>(1); // Store initial scale to compare

  const isMobileSwipe = cropMode === 'mobile-swipe';
  // Output canvas size in px. Swipe Mode renderar bilden full-bleed på
  // moderna telefoner (~1170 px device-pixels bred), så det stående 1:2-
  // formatet exporteras i dubbel upplösning (640×1280) för att hålla sig
  // skarpt. Canvasen skalas ned visuellt via CSS, så editorn ser identisk ut.
  const BASE_CANVAS_SIZE = isMobileSwipe ? 1280 : 640;
  const CANVAS_HEIGHT = BASE_CANVAS_SIZE;
  const CANVAS_WIDTH = Math.round(BASE_CANVAS_SIZE * aspectRatio);
  const MAX_SCALE = 3;

  const clampPosition = useCallback((nextPosition: { x: number; y: number }, nextScale: number) => {
    if (!isMobileSwipe) return nextPosition;
    const img = imageRef.current;
    if (!img) return nextPosition;

    const overflowX = Math.max(0, (img.width * nextScale - CANVAS_WIDTH) / 2);
    const overflowY = Math.max(0, (img.height * nextScale - CANVAS_HEIGHT) / 2);

    return {
      x: Math.max(-overflowX, Math.min(overflowX, nextPosition.x)),
      y: Math.max(-overflowY, Math.min(overflowY, nextPosition.y)),
    };
  }, [CANVAS_HEIGHT, CANVAS_WIDTH, isMobileSwipe]);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!isOpen) {
      setIsSaving(false);
      setHasUserMadeChanges(false);
    }
  }, [isOpen]);

  // Load and setup image
  useEffect(() => {
    if (!imageSrc || !isOpen) return;

    const loadImage = async () => {
      try {
        // Try to fetch the image as blob first to avoid CORS issues
        const response = await fetch(imageSrc);
        if (!response.ok) throw new Error(`Image request failed (${response.status})`);
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
          setMinScale(isMobileSwipe ? initialScale : Math.min(scaleX, scaleY) * 0.5);
          
          setScale(initialScale);
          initialScaleRef.current = initialScale; // Store for comparison
          setPosition({ x: 0, y: 0 });
          setImageLoaded(true);
          setHasUserMadeChanges(false); // Reset on new image load
          
          // Clean up blob URL
          URL.revokeObjectURL(blobUrl);
        };
        
        img.onerror = (error) => {
          console.error('Image failed to load from blob:', error);
          URL.revokeObjectURL(blobUrl);
          // Utan besked står redigeraren bara tom (vanligt med HEIC-bilder
          // i andra webbläsare än Safari).
          toast.error('Kunde inte visa bilden', {
            description: 'Formatet stöds inte här. Prova med en JPG- eller PNG-bild.',
          });
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
          setMinScale(isMobileSwipe ? initialScale : Math.min(scaleX, scaleY) * 0.5);
          
          setScale(initialScale);
          initialScaleRef.current = initialScale; // Store for comparison
          setPosition({ x: 0, y: 0 });
          setImageLoaded(true);
          setHasUserMadeChanges(false); // Reset on new image load
        };
        img.onerror = () => {
          console.error('Image failed to load directly');
          toast.error('Kunde inte visa bilden', {
            description: 'Formatet stöds inte här. Prova med en JPG- eller PNG-bild.',
          });
        };
        img.src = imageSrc;
      }
    };

    loadImage();
  }, [imageSrc, isOpen, CANVAS_WIDTH, CANVAS_HEIGHT, isMobileSwipe]);

  // Draw canvas
  const drawCanvas = useCallback(() => {
    if (!canvasRef.current || !imageRef.current || !imageLoaded) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = imageRef.current;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.save();

    // Spara alltid hela ytan (fyrkant). Den runda formen är endast visuell
    // (CSS) så att arbetsgivarens Swipe Mode kan fylla hela kortet.
    ctx.beginPath();
    ctx.rect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.clip();
    
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
    // Ingen border ritas in i bilden - kanter hanteras visuellt i UI
  }, [scale, position, imageLoaded, CANVAS_WIDTH, CANVAS_HEIGHT]);

  const getCanvasPoint = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  // Redraw when properties change
  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  // Mouse events for dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isSaving) return;
    setIsDragging(true);
    const point = getCanvasPoint(e.clientX, e.clientY);
    if (point) {
      setDragStart({
        x: point.x - position.x,
        y: point.y - position.y,
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !canvasRef.current || isSaving) return;
    
    const point = getCanvasPoint(e.clientX, e.clientY);
    if (!point) return;
    const newX = point.x - dragStart.x;
    const newY = point.y - dragStart.y;
    
    setPosition(clampPosition({ x: newX, y: newY }, scale));
    setHasUserMadeChanges(true); // User made manual change
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
    const point = getCanvasPoint(touch.clientX, touch.clientY);
    if (point) {
      setDragStart({
        x: point.x - position.x,
        y: point.y - position.y,
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isSaving) return;
    e.preventDefault();
    if (!isDragging || !canvasRef.current) return;
    
    const touch = e.touches[0];
    const point = getCanvasPoint(touch.clientX, touch.clientY);
    if (!point) return;
    const newX = point.x - dragStart.x;
    const newY = point.y - dragStart.y;
    
    setPosition(clampPosition({ x: newX, y: newY }, scale));
    setHasUserMadeChanges(true); // User made manual change
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  // Zoom functions - use percentage-based steps for smoother zooming
  const ZOOM_STEP = 0.1; // 10% per click
  
  const zoomIn = () => {
    if (isSaving) return;
    setScale(prev => {
      const maxScale = Math.max(MAX_SCALE, initialScaleRef.current * 3);
      const nextScale = Math.min(prev * (1 + ZOOM_STEP), maxScale);
      setPosition(current => clampPosition(current, nextScale));
      return nextScale;
    });
    setHasUserMadeChanges(true);
  };

  const zoomOut = () => {
    if (isSaving) return;
    setScale(prev => {
      const nextScale = Math.max(prev * (1 - ZOOM_STEP), minScale);
      setPosition(current => clampPosition(current, nextScale));
      return nextScale;
    });
    setHasUserMadeChanges(true);
  };

  const resetPosition = () => {
    if (isSaving) return;
    setPosition({ x: 0, y: 0 });
    // Återställningen är ett aktivt val och ska sparas som den beskärning som
    // syns i redigeraren, inte växla tillbaka till en annan lagrad fil.
    setHasUserMadeChanges(isMobileSwipe);
    if (imageRef.current) {
      const img = imageRef.current;
      const containerWidth = CANVAS_WIDTH;
      const containerHeight = CANVAS_HEIGHT;
      
      // ALLTID återställ till "cover" scale (identiskt för alla bilder)
      const scaleX = containerWidth / img.width;
      const scaleY = containerHeight / img.height;
      const initialScale = Math.max(scaleX, scaleY);
      setScale(initialScale);
      initialScaleRef.current = initialScale;
    }
  };

  // Save edited image
  const handleSaveClick = async () => {
    const canvas = canvasRef.current;
    if (isSaving || !canvas || !imageLoaded) {
      console.log('ImageEditor: Already saving or no canvas');
      return;
    }
    
    setIsSaving(true);
    
    // Spara alltid exakt det som syns i redigeraren (WYSIWYG) — även efter
    // att bilden zoomats tillbaka till originalläget.
    console.log('ImageEditor: Starting save process...');
    
    try {
      // Use WebP format with 95% quality for optimal balance
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((result) => {
          resolve(result);
        }, 'image/webp', 0.95);
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
      <DialogContentNoFocus className="max-w-md h-[92dvh] md:h-auto max-h-[92dvh] !flex flex-col overflow-y-auto no-chrome-pad bg-white/5 border-white/20 backdrop-blur-sm">
        <DialogHeader>
          <DialogTitle className="text-center text-white">
            Anpassa din {isCircular ? 'profilbild' : 'bild'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col flex-1 min-h-0 gap-4">
          {/* Mobilbilden visas i Swipe Modes stående 1:2-format. Den separata
              fokusväljaren i jobbflödet styr endast de breda 2:1-jobbkorten. */}
          <div className="flex-1 min-h-0 w-full flex items-center justify-center">
            <div className="relative h-full w-full flex items-center justify-center">
              <canvas
                ref={canvasRef}
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
                className={`cursor-${isDragging ? 'grabbing' : 'grab'} ${isCircular ? 'rounded-full' : 'rounded-lg'} max-h-full max-w-full ${isSaving ? 'opacity-50' : ''} md:max-h-[min(55vh,360px)]`}
                style={{
                  backgroundColor: 'transparent',
                  maxWidth: '100%',
                  height: 'auto',
                  width: 'auto',
                  touchAction: 'none',
                }}
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
              className="!transition-none bg-white/5 border-white/10 !text-white hover:bg-white/10 hover:!text-white hover:border-white/10 md:hover:bg-white/10 md:hover:!text-white md:hover:border-white/10 disabled:opacity-50 disabled:hover:bg-white/5 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={resetPosition}
              disabled={isSaving}
              className="!transition-none bg-white/5 border-white/10 !text-white hover:bg-white/10 hover:!text-white hover:border-white/10 md:hover:bg-white/10 md:hover:!text-white md:hover:border-white/10 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
            
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={zoomIn}
              disabled={scale >= Math.max(MAX_SCALE, initialScaleRef.current * 3) || isSaving}
              className="!transition-none bg-white/5 border-white/10 !text-white hover:bg-white/10 hover:!text-white hover:border-white/10 md:hover:bg-white/10 md:hover:!text-white md:hover:border-white/10 disabled:opacity-50 disabled:hover:bg-white/5 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>

          <p className="text-sm text-white text-center font-medium">
            Dra för att flytta bild och använd knapparna för att zooma in eller ut.
          </p>

          {/* Action buttons */}
          <div className="flex space-x-2">
            <Button 
              type="button"
              onClick={handleCancelClick}
              disabled={isSaving}
              className="flex-1 rounded-full !transition-none !text-white bg-white/5 border-white/10 hover:bg-white/10 hover:!text-white hover:border-white/10 md:hover:bg-white/10 md:hover:!text-white md:hover:border-white/10 disabled:opacity-50 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none"
              variant="outline"
            >
              Avbryt
            </Button>
            <Button 
              type="button"
              onClick={handleSaveClick}
              disabled={isSaving || !imageLoaded}
              className="flex-1 rounded-full !transition-none !text-white bg-white/5 border-white/10 hover:bg-white/10 hover:!text-white hover:border-white/10 md:hover:bg-white/10 md:hover:!text-white md:hover:border-white/10 disabled:opacity-50 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none"
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
      </DialogContentNoFocus>
    </Dialog>
  );
};

export default ImageEditor;