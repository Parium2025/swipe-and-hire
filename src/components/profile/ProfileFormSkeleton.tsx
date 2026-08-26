import { memo } from 'react';

/**
 * Innehållsformat skelett för /profile (jobbsökare) och arbetsgivarens
 * personliga profil.
 *
 * Speglar den riktiga sidan: sidtitel → mediakort (avatar + ikonrad) →
 * personuppgiftskort med fältpar → presentation → CV/företagssektion.
 *
 * ENHETLIG TON: alla shape-element använder `bg-white/10 animate-pulse`
 * — samma standard som SearchPageSkeleton och EmployerPageSkeleton.
 */

const SHAPE = 'bg-white/10 animate-pulse';

const Field = () => (
  <div className="space-y-2">
    <div className={`h-3 w-24 rounded ${SHAPE}`} />
    <div className={`h-10 w-full rounded-md ${SHAPE}`} />
  </div>
);

interface Props {
  /** Arbetsgivarens profil saknar CV-sektionen men har företagsuppgifter. */
  variant?: 'job_seeker' | 'employer';
}

export const ProfileFormSkeleton = memo(function ProfileFormSkeleton({
  variant = 'job_seeker',
}: Props) {
  return (
    <div
      className="responsive-container-wide space-y-6 [padding-bottom:calc(env(safe-area-inset-bottom,0px)+50px)]"
      aria-busy="true"
      aria-label="Laddar profil"
    >
      {/* Sidtitel */}
      <div className="text-center mb-6 space-y-2">
        <div className={`h-6 w-40 mx-auto rounded ${SHAPE}`} />
        <div className={`h-3 w-56 mx-auto rounded ${SHAPE}`} />
      </div>

      {/* Mediakort — rubrik, ikonrad, stor avatar, hjälptext */}
      <div className="bg-white/5 border border-white/10 rounded-lg">
        <div className="p-6 md:p-4 space-y-3">
          <div className={`h-4 w-48 mx-auto rounded ${SHAPE}`} />
          <div className={`h-3 w-72 max-w-full mx-auto rounded ${SHAPE}`} />
          <div className="flex items-center justify-center gap-4 pt-1">
            <div className={`h-16 w-16 rounded-full ${SHAPE}`} />
            <div className={`h-3 w-8 rounded ${SHAPE}`} />
            <div className={`h-16 w-16 rounded-full ${SHAPE}`} />
          </div>
        </div>
        <div className="p-4 flex flex-col items-center space-y-4">
          <div className={`h-32 w-32 rounded-full ${SHAPE}`} />
          <div className={`h-3 w-64 max-w-full rounded ${SHAPE}`} />
        </div>
      </div>

      {/* Personuppgifter */}
      <div className="bg-white/5 border border-white/10 rounded-lg p-6 space-y-5">
        <div className={`h-4 w-44 rounded ${SHAPE}`} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field />
          <Field />
          <Field />
          <Field />
        </div>
        <Field />
        {/* Presentation / Om mig */}
        <div className="space-y-2">
          <div className={`h-3 w-40 rounded ${SHAPE}`} />
          <div className={`h-24 w-full rounded-md ${SHAPE}`} />
        </div>
      </div>

      {/* CV + anställning (jobbsökare) / företagsuppgifter (arbetsgivare) */}
      <div className="bg-white/5 border border-white/10 rounded-lg p-6 space-y-5">
        <div className={`h-4 w-52 rounded ${SHAPE}`} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field />
          <Field />
        </div>
        {variant === 'job_seeker' && (
          <div className="space-y-2">
            <div className={`h-3 w-16 rounded ${SHAPE}`} />
            <div className={`h-20 w-full rounded-md ${SHAPE}`} />
          </div>
        )}
      </div>

      {/* Spara-knapp */}
      <div className="flex justify-center">
        <div className={`h-11 w-40 rounded-full ${SHAPE}`} />
      </div>
    </div>
  );
});
