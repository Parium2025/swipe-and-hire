import { Link } from 'react-router-dom';
import { Sparkles, ArrowRight } from 'lucide-react';
import { useHasActivePlan } from '@/hooks/useHasActivePlan';
import { useAuth } from '@/hooks/useAuth';

/**
 * Diskret banner som visas för employers utan aktiv plan.
 * Ligger överst i innehållsytan — påminner utan att pusha.
 */
export function NoPlanBanner() {
  const { user } = useAuth();
  const { hasPlan, loading } = useHasActivePlan();

  if (!user || loading || hasPlan) return null;

  return (
    <div className="border-b border-white/[0.06] bg-gradient-to-r from-secondary/[0.08] via-white/[0.02] to-primary/[0.08]">
      <div className="w-full responsive-container-wide flex items-center justify-start gap-3 py-2.5">
        <div className="flex items-center gap-2 text-sm text-white">
          <Sparkles className="h-4 w-4 shrink-0 text-secondary" />
          <span className="hidden sm:inline">Ingen aktiv plan — allt fungerar, men du behöver en plan för att publicera nya annonser.</span>
          <span className="sm:hidden">Ingen aktiv plan</span>
        </div>
        <Link
          to="/valj-plan"
          className="flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-full bg-secondary px-3.5 py-1.5 text-xs font-semibold text-white shadow-[0_6px_20px_-8px_hsl(var(--secondary)/0.9)] transition hover:brightness-110"
        >
          Välj plan
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
