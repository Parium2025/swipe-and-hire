import { Briefcase, Plus, FileText, Clock } from 'lucide-react';

interface EmptyJobsCtaProps {
  /** Kompaktare variant för mobilvyn */
  compact?: boolean;
  /** True om företaget har publicerat annonser tidigare (utgångna/utkast finns) */
  hasPreviousJobs?: boolean;
}

/** Klickar på "Skapa ny annons" i toppmenyn — samma flöde, inget dubbelt state. */
const openCreateJob = () => {
  const trigger = document.querySelector<HTMLButtonElement>('[data-create-job-trigger="true"]');
  trigger?.click();
};

/**
 * Tomläge för arbetsgivarens annonslista: en tydlig uppmaning att skapa
 * en annons i stället för bara en rad text. Texten anpassas efter om
 * företaget är helt nytt eller redan har haft annonser uppe.
 */
export const EmptyJobsCta = ({ compact = false, hasPreviousJobs = false }: EmptyJobsCtaProps) => {
  const heading = hasPreviousJobs ? 'Inga aktiva annonser just nu' : 'Dags för er första annons';
  const ctaLabel = hasPreviousJobs ? 'Skapa ny annons' : 'Skapa er första annons';
  const firstBullet = hasPreviousJobs
    ? 'Återpublicera en utgången annons eller skapa en ny.'
    : 'Utkast sparas automatiskt — inget försvinner.';

  return (
    <div className={`mx-auto w-full max-w-md text-center ${compact ? 'py-8' : 'py-12'}`}>
      <div className="rounded-3xl border border-white/12 bg-white/[0.05] p-6 sm:p-8">
        <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/20">
          <Briefcase className="h-6 w-6 text-white" />
        </span>
        <h3 className="text-lg font-semibold text-white">{heading}</h3>

        <ul className="mt-5 space-y-2 text-left">
          <li className="flex items-start gap-2.5">
            <FileText className="mt-[2px] h-4 w-4 shrink-0 text-white" />
            <span className="text-[13px] leading-snug text-white break-words">
              {firstBullet}
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <Clock className="mt-[2px] h-4 w-4 shrink-0 text-white" />
            <span className="text-[13px] leading-snug text-white break-words">
              Publicerad annons ligger uppe i 14 dagar.
            </span>
          </li>
        </ul>


        <button
          type="button"
          onClick={openCreateJob}
          className="mt-6 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-green-500 px-6 py-2.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-green-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
        >
          Skapa er första annons
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default EmptyJobsCta;
