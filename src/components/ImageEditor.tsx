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

  const BASE_CANVAS_HEIGHT = 400; // Output canvas height in px
  const CANVAS_HEIGHT = BASE_CANVAS_HEIGHT;
  const CANVAS_WIDTH = Math.round(BASE_CANVAS_HEIGHT * aspectRatio);
  const MIN_SCALE = 0.5;
  const MAX_SCALE = 3;

  // Load and setup image
  useEffect(() => {
    if (!imageSrc || !isOpen) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageRef.current = img;
      
      // Calculate initial scale to fit the image properly
      const containerWidth = CANVAS_WIDTH;
      const containerHeight = CANVAS_HEIGHT;
      const imageAspect = img.width / img.height;
      const containerAspect = containerWidth / containerHeight;
      
      // Scale to cover the container
      const initialScale = Math.max(
        containerWidth / img.width,
        containerHeight / img.height
      );
      
      setScale(initialScale);
      setPosition({ x: 0, y: 0 });
      setImageLoaded(true);
    };
    img.src = imageSrc;
  }, [imageSrc, isOpen, aspectRatio]);

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
    } else {
      ctx.strokeRect(1, 1, CANVAS_WIDTH - 2, CANVAS_HEIGHT - 2);
    }
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
    setScale(prev => Math.max(prev - 0.2, MIN_SCALE));
  };

  const resetPosition = () => {
    setPosition({ x: 0, y: 0 });
    if (imageRef.current) {
      const img = imageRef.current;
      const containerWidth = CANVAS_WIDTH;
      const containerHeight = CANVAS_HEIGHT;
      
      // Scale to cover the container
      const initialScale = Math.max(
        containerWidth / img.width,
        containerHeight / img.height
      );
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">
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
                className={`cursor-${isDragging ? 'grabbing' : 'grab'} bg-gray-50 ${isCircular ? 'rounded-full' : 'rounded-lg'}`}
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
              disabled={scale <= MIN_SCALE}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={resetPosition}
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={zoomIn}
              disabled={scale >= MAX_SCALE}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>

          <p className="text-sm text-muted-foreground text-center">
            Dra för att flytta bilden, använd knapparna för att zooma
          </p>

          {/* Action buttons */}
          <div className="flex space-x-2">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Avbryt
            </Button>
            <Button onClick={handleSave} className="flex-1">
              Spara
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ImageEditor;