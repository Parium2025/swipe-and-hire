import { createRoot } from 'react-dom/client';
import '@/index.css';
import { TruncatedText } from '@/components/ui/truncated-text';
function Row() {
  return (
    <div style={{ width: 330, padding: 16 }} className="bg-slate-800">
      <div className="flex items-center gap-3 p-3 bg-white/5 rounded-lg border border-white/10">
        <div className="h-10 w-10 rounded-full bg-white/10 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <TruncatedText text="Fredrik Andersson" className="min-w-0 flex-1 font-medium text-white" />
            <span className="text-xs border px-2 rounded-full text-white">Du</span>
          </div>
        </div>
        <div className="flex items-center gap-2"><span className="px-3 py-1 text-white border rounded-full">Admin</span></div>
      </div>
      <div id="ok" style={{ width: 120 }} className="mt-8"><TruncatedText text="Fredrik Andersson Långnamn" className="truncate text-white" side="top" /></div>
    </div>
  );
}
createRoot(document.getElementById('root')!).render(<Row />);
