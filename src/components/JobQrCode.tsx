import { memo, useEffect, useRef, useState, useCallback } from 'react';
import QRCodeStyling from 'qr-code-styling';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { QrCode, Download } from 'lucide-react';
import { toast } from 'sonner';

interface JobQrCodeProps {
  jobId: string;
  jobTitle: string;
}

function JobQrCodeButton({ jobId, jobTitle }: JobQrCodeProps) {
  const [open, setOpen] = useState(false);
  const [qrReady, setQrReady] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);
  const qrInstanceRef = useRef<QRCodeStyling | null>(null);

  const jobUrl = `${window.location.origin}/job/${jobId}`;

  const initQr = useCallback(() => {
    if (!qrRef.current) return;

    // Clear previous content
    qrRef.current.innerHTML = '';
    setQrReady(false);

    const qrCode = new QRCodeStyling({
      width: 220,
      height: 220,
      type: 'svg',
      data: jobUrl,
      dotsOptions: {
        color: '#0f172a',
        type: 'rounded',
      },
      backgroundOptions: {
        color: '#ffffff',
      },
      cornersSquareOptions: {
        color: '#0f172a',
        type: 'extra-rounded',
      },
      cornersDotOptions: {
        color: '#0f172a',
        type: 'dot',
      },
      qrOptions: {
        errorCorrectionLevel: 'M',
      },
    });

    qrCode.append(qrRef.current);
    qrInstanceRef.current = qrCode;

    // Mark as ready after a short delay to ensure SVG is rendered
    setTimeout(() => setQrReady(true), 100);
  }, [jobUrl]);

  useEffect(() => {
    if (!open) {
      setQrReady(false);
      return;
    }
    // Use rAF + timeout to ensure DOM is ready
    const raf = requestAnimationFrame(() => {
      setTimeout(initQr, 50);
    });
    return () => cancelAnimationFrame(raf);
  }, [open, initQr]);

  const handleDownload = () => {
    if (qrInstanceRef.current) {
      qrInstanceRef.current.download({
        name: `parium-jobb-${jobId.slice(0, 8)}`,
        extension: 'png',
      });
      toast.success('QR-kod nedladdad');
    }
  };


  return (
    <div className="min-w-0 flex">
      <button
        onClick={() => setOpen(true)}
        className="bg-white/5 rounded-lg px-2 py-1.5 flex items-center justify-center gap-1 md:hover:bg-white/10 transition-all duration-200 outline-none focus:outline-none w-full min-w-0 overflow-hidden"
      >
        <QrCode className="h-3.5 w-3.5 text-white flex-shrink-0" />
        <span className="text-white text-xs hidden md:inline">QR</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[340px] bg-slate-900/95 backdrop-blur-xl border border-white/20 text-white">
          <DialogHeader>
            <DialogTitle className="text-white text-center">Dela jobbannons</DialogTitle>
            <DialogDescription className="text-white text-center text-sm">
              Skanna QR-koden för att öppna annonsen
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex flex-col items-center gap-4 py-4">
            {/* QR Code container */}
            <div className="bg-white rounded-2xl p-4 shadow-lg">
              <div 
                ref={qrRef} 
                className="flex items-center justify-center min-h-[220px] min-w-[220px]"
                style={{ opacity: qrReady ? 1 : 0, transition: 'opacity 0.2s ease-in' }}
              />
            </div>

            {/* Job title */}
            <p className="text-sm font-medium text-white text-center line-clamp-2 px-4">
              {jobTitle}
            </p>

            {/* Download button */}
            <Button
              size="sm"
              onClick={handleDownload}
              className="w-full bg-white/15 hover:bg-white/25 text-white gap-1.5"
            >
              <Download className="h-4 w-4" />
              Ladda ner QR-kod
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default memo(JobQrCodeButton);
