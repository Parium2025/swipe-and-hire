import * as React from "react"
import { useIsMobile } from "@/hooks/use-mobile"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./dialog"
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "./drawer"

interface ResponsiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

export function ResponsiveDialog({ open, onOpenChange, children }: ResponsiveDialogProps) {
  const isMobile = useIsMobile();
  
  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        {children}
      </Drawer>
    );
  }
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {children}
    </Dialog>
  );
}

// Export appropriate content components based on mobile/desktop
export function ResponsiveDialogContent({ 
  children, 
  className,
  ...props 
}: React.ComponentPropsWithoutRef<typeof DialogContent>) {
  const isMobile = useIsMobile();
  
  if (isMobile) {
    return (
      <DrawerContent className={className} {...props}>
        {children}
      </DrawerContent>
    );
  }
  
  return (
    <DialogContent className={className} {...props}>
      {children}
    </DialogContent>
  );
}

export function ResponsiveDialogHeader({ 
  children,
  className,
  ...props 
}: React.HTMLAttributes<HTMLDivElement>) {
  const isMobile = useIsMobile();
  
  if (isMobile) {
    return (
      <DrawerHeader className={className} {...props}>
        {children}
      </DrawerHeader>
    );
  }
  
  return (
    <DialogHeader className={className} {...props}>
      {children}
    </DialogHeader>
  );
}

export function ResponsiveDialogTitle({ 
  children,
  className,
  ...props 
}: React.HTMLAttributes<HTMLHeadingElement>) {
  const isMobile = useIsMobile();
  
  if (isMobile) {
    return (
      <DrawerTitle className={className} {...props}>
        {children}
      </DrawerTitle>
    );
  }
  
  return (
    <DialogTitle className={className} {...props}>
      {children}
    </DialogTitle>
  );
}

export function ResponsiveDialogDescription({ 
  children,
  className,
  ...props 
}: React.HTMLAttributes<HTMLParagraphElement>) {
  const isMobile = useIsMobile();
  
  if (isMobile) {
    return (
      <DrawerDescription className={className} {...props}>
        {children}
      </DrawerDescription>
    );
  }
  
  return (
    <DialogDescription className={className} {...props}>
      {children}
    </DialogDescription>
  );
}
