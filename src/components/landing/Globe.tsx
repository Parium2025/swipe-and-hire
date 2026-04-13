import { useRef, useMemo, Suspense } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { TextureLoader, Mesh, MathUtils } from 'three';
import { useIsMobile } from '@/hooks/use-mobile';

interface GlobeProps {
  className?: string;
}

/**
 * NASA night-lights Earth texture URL (public domain, NASA Visible Earth).
 * Black Marble 2016 – 2048px equirectangular.
 */
const EARTH_TEXTURE_URL =
  'https://upload.wikimedia.org/wikipedia/commons/thumb/b/ba/The_earth_at_night.jpg/2048px-The_earth_at_night.jpg';

/** Rotating Earth sphere with NASA texture */
function EarthSphere({ isMobile }: { isMobile: boolean }) {
  const meshRef = useRef<Mesh>(null);
  const texture = useLoader(TextureLoader, EARTH_TEXTURE_URL);

  // Initial rotation: point camera at Europe (lon ~15°E, lat ~42°N start)
  const initialRotation = useMemo(() => {
    // Three.js sphere: Y-axis rotation = longitude, X-axis = latitude tilt
    const lonRad = MathUtils.degToRad(-15);  // Europe longitude
    const latRad = MathUtils.degToRad(-20);  // Tilt to show Mediterranean initially
    return { x: latRad, y: lonRad };
  }, []);

  // Animation: slow tilt upward (Med → Scandinavia) + continuous slow rotation
  const startTime = useRef(performance.now());
  const panDuration = isMobile ? 10 : 14; // seconds

  useFrame(() => {
    if (!meshRef.current) return;
    const elapsed = (performance.now() - startTime.current) / 1000;

    if (elapsed < panDuration) {
      // Phase 1: tilt upward from Mediterranean to Scandinavia
      const t = elapsed / panDuration;
      const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      // Tilt from -20° (Med) to -52° (Scandinavia)
      const startTilt = MathUtils.degToRad(-20);
      const endTilt = MathUtils.degToRad(-52);
      meshRef.current.rotation.x = startTilt + (endTilt - startTilt) * ease;
      // Slight longitude adjustment
      const startLon = MathUtils.degToRad(-15);
      const endLon = MathUtils.degToRad(-18);
      meshRef.current.rotation.y = startLon + (endLon - startLon) * ease;
    } else {
      // Phase 2: continuous slow rotation (NASA ISS drift)
      const post = elapsed - panDuration;
      const endTilt = MathUtils.degToRad(-52);
      meshRef.current.rotation.x = endTilt + Math.sin(post * 0.05) * 0.01;
      meshRef.current.rotation.y = MathUtils.degToRad(-18) - post * 0.003;
    }
  });

  return (
    <mesh ref={meshRef} rotation={[initialRotation.x, initialRotation.y, MathUtils.degToRad(23.4)]}>
      <sphereGeometry args={[2.5, isMobile ? 64 : 96, isMobile ? 64 : 96]} />
      <meshStandardMaterial
        map={texture}
        emissiveMap={texture}
        emissive="#ffffff"
        emissiveIntensity={1.5}
        roughness={1}
        metalness={0}
      />
    </mesh>
  );
}

/** Atmospheric glow ring around the Earth */
function Atmosphere() {
  return (
    <mesh>
      <sphereGeometry args={[2.58, 64, 64]} />
      <meshBasicMaterial
        color="#4488ff"
        transparent
        opacity={0.08}
        depthWrite={false}
      />
    </mesh>
  );
}

const Globe = ({ className = '' }: GlobeProps) => {
  const isMobile = useIsMobile();

  return (
    <div className={`${className}`} style={{ minHeight: '100%' }} aria-hidden="true">
      <Canvas
        camera={{
          position: [0, 0, isMobile ? 4.2 : 3.8],
          fov: 45,
          near: 0.1,
          far: 100,
        }}
        dpr={isMobile ? 1 : Math.min(window.devicePixelRatio || 1, 2)}
        gl={{
          antialias: !isMobile,
          alpha: true,
          powerPreference: isMobile ? 'low-power' : 'high-performance',
        }}
        style={{ background: 'transparent' }}
      >
        <ambientLight intensity={0.15} />
        <directionalLight position={[5, 3, 5]} intensity={0.3} color="#aaccff" />
        <Suspense fallback={null}>
          <EarthSphere isMobile={isMobile} />
        </Suspense>
        <Atmosphere />
      </Canvas>
    </div>
  );
};

export default Globe;
