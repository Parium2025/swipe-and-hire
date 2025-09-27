import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface ImageEditorProps {
  isOpen: boolean;
  onClose: () => void;
  imageSrc: string;
  onSave: (editedImageBlob: Blob) => void;
  isCircular?: boolean;
  aspectRatio?: number; // width/height ratio
}

const ImageEditor: React.FC<ImageEditorProps> = ({
  isOpen,
  onClose,
  imageSrc,
  onSave,
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
  const [activeButton, setActiveButton] = useState<'cancel' | 'save' | null>(null);

  const BASE_CANVAS_HEIGHT = 400; // Output canvas height in px
  const CANVAS_HEIGHT = BASE_CANVAS_HEIGHT;
  const CANVAS_WIDTH = Math.round(BASE_CANVAS_HEIGHT * aspectRatio);
  const MAX_SCALE = 3;

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
          
          // Calculate initial scale to cover the container completely
          const containerWidth = CANVAS_WIDTH;
          const containerHeight = CANVAS_HEIGHT;
          
          // Scale to cover the container (like CSS background-size: cover)
          const scaleX = containerWidth / img.width;
          const scaleY = containerHeight / img.height;
          const initialScale = Math.max(scaleX, scaleY);
          
          // Beräkna minScale för att visa hela bilden (contain)
          const containScale = Math.min(scaleX, scaleY);
          setMinScale(containScale);
          
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
          const initialScale = Math.max(scaleX, scaleY);
          
          // Beräkna minScale för att visa hela bilden (contain)
          const containScale = Math.min(scaleX, scaleY);
          setMinScale(containScale);
          
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
    if (!isDragging || !canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const newX = e.clientX - rect.left - dragStart.x;
    const newY = e.clientY - rect.top - dragStart.y;
    
    setPosition({ x: newX, y: newY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch events for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
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
    e.preventDefault();
    if (!isDragging || !canvasRef.current) return;
    
    const touch = e.touches[0];
    const rect = canvasRef.current.getBoundingClientRect();
    const newX = touch.clientX - rect.left - dragStart.x;
    const newY = touch.clientY - rect.top - dragStart.y;
    
    setPosition({ x: newX, y: newY });
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  // Zoom functions
  const zoomIn = () => {
    setScale(prev => Math.min(prev + 0.2, MAX_SCALE));
  };

  const zoomOut = () => {
    setScale(prev => Math.max(prev - 0.2, minScale));
  };

  const resetPosition = () => {
    setPosition({ x: 0, y: 0 });
    if (imageRef.current) {
      const img = imageRef.current;
      const containerWidth = CANVAS_WIDTH;
      const containerHeight = CANVAS_HEIGHT;
      
      // Scale to cover the container (like CSS background-size: cover)
      const scaleX = containerWidth / img.width;
      const scaleY = containerHeight / img.height;
      const initialScale = Math.max(scaleX, scaleY);
      setScale(initialScale);
    }
  };

  // Save edited image
  const handleSave = () => {
    if (!canvasRef.current) return;
    
    canvasRef.current.toBlob((blob) => {
      if (blob) {
        onSave(blob);
      }
    }, 'image/png', 1.0);
  };

  const handleCancelClick = () => {
    setActiveButton('cancel');
    setTimeout(() => {
      onClose();
      setActiveButton(null);
    }, 150);
  };

  const handleSaveClick = () => {
    setActiveButton('save');
    setTimeout(() => {
      handleSave();
      setActiveButton(null);
    }, 150);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
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
                className={`cursor-${isDragging ? 'grabbing' : 'grab'} ${isCircular ? 'rounded-full' : 'rounded-lg'}`}
                style={{ backgroundColor: 'transparent' }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              />
            </div>
          </div>

          {/* Controls */}
          <div className="flex justify-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={zoomOut}
              disabled={scale <= minScale}
              className="bg-slate-800 border-slate-600 text-white hover:bg-slate-700 disabled:opacity-50 disabled:hover:bg-slate-800"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={resetPosition}
              className="bg-slate-800 border-slate-600 text-white hover:bg-slate-700"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={zoomIn}
              disabled={scale >= MAX_SCALE}
              className="bg-slate-800 border-slate-600 text-white hover:bg-slate-700 disabled:opacity-50 disabled:hover:bg-slate-800"
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
              onClick={handleCancelClick}
              className={`flex-1 transition-all duration-200 ${
                activeButton === 'cancel'
                  ? 'bg-slate-700 text-white border-slate-600' 
                  : 'bg-transparent border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white'
              }`}
              variant="outline"
            >
              Avbryt
            </Button>
            <Button 
              onClick={handleSaveClick}
              className={`flex-1 transition-all duration-200 ${
                activeButton === 'save'
                  ? 'bg-slate-800 text-white border-slate-800' 
                  : 'bg-slate-900 text-white border-slate-900 hover:bg-slate-800'
              }`}
              variant="outline"
            >
              Spara
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ImageEditor;