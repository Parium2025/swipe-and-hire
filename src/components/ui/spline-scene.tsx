import { Suspense, lazy } from 'react';

const Spline = lazy(() => import('@splinetool/react-spline'));

interface SplineSceneProps {
  scene: string;
  className?: string;
}

export function SplineScene({ scene, className }: SplineSceneProps) {
  return (
    <Suspense
      fallback={
        <div className="flex h-full w-full items-center justify-center">
          <span className="h-10 w-10 rounded-full border border-secondary/20 border-t-secondary animate-spin" />
        </div>
      }
    >
      <Spline scene={scene} className={className} />
    </Suspense>
  );
}