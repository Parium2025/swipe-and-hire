import { useRef, Suspense } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { TextureLoader, Mesh, MathUtils } from 'three';
import { useIsMobile } from '@/hooks/use-mobile';

interface GlobeProps {
  className?: string;
}

const EARTH_TEXTURE_URL =
  'https://upload.wikimedia.org/wikipedia/commons/thumb/b/ba/The_earth_at_night.jpg/2048px-The_earth_at_night.jpg';

function EarthSphere({ isMobile }: { isMobile: boolean }) {
  const meshRef = useRef<Mesh>(null);
  const texture = useLoader(TextureLoader, EARTH_TEXTURE_URL);
  const startTime = useRef(performance.now());
  const panDuration = isMobile ? 10 : 14;

  useFrame(() => {
    if (!meshRef.current) return;
    const elapsed = (performance.now() - startTime.current) / 1000;

    // Longitude: rotate so Europe faces camera
    // Latitude: tilt from Italy (35°N) upward to Scandinavia (58°N)
    const startLat = MathUtils.degToRad(35);
    const endLat = MathUtils.degToRad(58);
    const euroLon = MathUtils.degToRad(195); // rotate Y to face Europe

    if (elapsed < panDuration) {
      const t = elapsed / panDuration;
      const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      meshRef.current.rotation.x = startLat + (endLat - startLat) * ease;
      meshRef.current.rotation.y = euroLon + elapsed * 0.002;
    } else {
      const post = elapsed - panDuration;
      meshRef.current.rotation.x = endLat + Math.sin(post * 0.04) * 0.008;
      meshRef.current.rotation.y = euroLon + panDuration * 0.002 + post * 0.002;
    }
  });

  return (
    <mesh
      ref={meshRef}
      rotation={[MathUtils.degToRad(35), MathUtils.degToRad(195), MathUtils.degToRad(-23.4)]}
      position={[0, -1.8, 0]}
    >
      <sphereGeometry args={[3.5, isMobile ? 64 : 96, isMobile ? 64 : 96]} />
      <meshStandardMaterial
        map={texture}
        emissiveMap={texture}
        emissive="#ffffff"
        emissiveIntensity={2}
        roughness={1}
        metalness={0}
      />
    </mesh>
  );
}

function Atmosphere() {
  return (
    <mesh position={[0, -1.8, 0]}>
      <sphereGeometry args={[3.58, 64, 64]} />
      <meshBasicMaterial color="#4488ff" transparent opacity={0.06} depthWrite={false} />
    </mesh>
  );
}

const Globe = ({ className = '' }: GlobeProps) => {
  const isMobile = useIsMobile();

  return (
    <div className={`${className}`} style={{ minHeight: '100%' }} aria-hidden="true">
      <Canvas
        camera={{
          position: [0, 0, isMobile ? 4.5 : 4],
          fov: 50,
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
        <ambientLight intensity={0.2} />
        <directionalLight position={[5, 3, 5]} intensity={0.4} color="#aaccff" />
        <Suspense fallback={null}>
          <EarthSphere isMobile={isMobile} />
        </Suspense>
        <Atmosphere />
      </Canvas>
    </div>
  );
};

export default Globe;
