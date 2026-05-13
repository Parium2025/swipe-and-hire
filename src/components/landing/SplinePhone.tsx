import { Suspense, lazy } from 'react';

const Spline = lazy(() => import('@splinetool/react-spline'));

const SCENE_URL = 'https://prod.spline.design/R9AE3iFR515l7EKvHCNavLb7/scene.splinecode';

interface SplinePhoneProps {
  className?: string;
}

/**
 * Renderar Parium-telefonen som en interaktiv 3D-scen från Spline.
 * Laddas lazy för att inte blockera hero-rendering.
 */
export const SplinePhone = ({ className }: SplinePhoneProps) => {
  return (
    <div className={className} aria-hidden="true">
      <Suspense fallback={<div className="h-full w-full" />}>
        <Spline scene={SCENE_URL} style={{ width: '100%', height: '100%' }} />
      </Suspense>
    </div>
  );
};

export default SplinePhone;
