import { memo, useMemo, Suspense, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';

interface GlobeProps {
  className?: string;
}

/** Day = 06:00–20:00 local time */
const isDaytime = (): boolean => {
  const hour = new Date().getHours();
  return hour >= 6 && hour < 20;
};

/* ── rotating sphere ────────────────────────────────────── */

function EarthSphere({ isDay }: { isDay: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const texturePath = isDay ? '/images/earth-day.jpg' : '/images/earth-night.jpg';
  const texture = useTexture(texturePath);

  // Texture settings for crisp rendering
  texture.anisotropy = 16;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.colorSpace = THREE.SRGBColorSpace;

  // Slow upward drift: Italy → Scandinavia
  useFrame((_, delta) => {
    if (meshRef.current) {
      // Increase x rotation = tilt north pole toward camera = reveal more northern latitudes
      meshRef.current.rotation.x += delta * 0.005;
      // Very slow eastward drift for realism
      meshRef.current.rotation.y += delta * 0.002;
    }
  });

  // Initial rotation: Europe/Italy centered
  // x = 0.85 ≈ 49° tilt shows Mediterranean/Italy region clearly
  // y = 0.3 rotates Europe to center horizontally  
  return (
    <mesh ref={meshRef} rotation={[0.85, 0.3, -0.15]}>
      <sphereGeometry args={[2, 128, 128]} />
      <meshStandardMaterial
        map={texture}
        emissiveMap={isDay ? undefined : texture}
        emissive={isDay ? '#000000' : '#ffffff'}
        emissiveIntensity={isDay ? 0 : 3.0}
        roughness={isDay ? 0.7 : 0.8}
        metalness={isDay ? 0.05 : 0}
        toneMapped={false}
      />
    </mesh>
  );
}

/* ── atmosphere glow ─────────────────────────────────────── */

function Atmosphere({ isDay }: { isDay: boolean }) {
  const atmosphereMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        uniform vec3 glowColor;
        void main() {
          float intensity = pow(0.62 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 3.5);
          gl_FragColor = vec4(glowColor, intensity * 0.5);
        }
      `,
      uniforms: {
        glowColor: { value: new THREE.Color(isDay ? '#6699ff' : '#4477cc') },
      },
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
    });
  }, [isDay]);

  return (
    <mesh scale={[1.15, 1.15, 1.15]}>
      <sphereGeometry args={[2, 64, 64]} />
      <primitive object={atmosphereMaterial} />
    </mesh>
  );
}

/* ── main component ──────────────────────────────────────── */

const Globe = memo(({ className = '' }: GlobeProps) => {
  const isDay = useMemo(() => isDaytime(), []);

  return (
    <div
      className={`${className} overflow-hidden`}
      aria-hidden="true"
      style={{ position: 'relative' }}
    >
      <Canvas
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
          preserveDrawingBuffer: false,
        }}
        camera={{ position: [0, 0, 4.2], fov: 50 }}
        dpr={[1, 2]}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'transparent',
        }}
        frameloop="always"
      >
        <ambientLight intensity={isDay ? 1.0 : 0.8} />
        <directionalLight
          position={isDay ? [5, 3, 5] : [3, 2, 5]}
          intensity={isDay ? 2.5 : 2.0}
          color={isDay ? '#fffaf0' : '#ccddff'}
        />
        <pointLight position={[0, 1, 5]} intensity={isDay ? 0.5 : 1.0} color="#ddeeff" />
        <pointLight position={[-3, 0, 4]} intensity={isDay ? 0.3 : 0.8} color="#aaccff" />
        <pointLight position={[3, -1, 3]} intensity={isDay ? 0.2 : 0.6} color="#bbddff" />

        <Suspense fallback={null}>
          <EarthSphere isDay={isDay} />
          <Atmosphere isDay={isDay} />
        </Suspense>
      </Canvas>

      <div
        className="absolute top-0 left-0 right-0 pointer-events-none"
        style={{
          height: '10%',
          background: isDay
            ? 'linear-gradient(to bottom, hsl(210 60% 10% / 0.4) 0%, transparent 100%)'
            : 'linear-gradient(to bottom, hsl(217 78% 8% / 0.25) 0%, transparent 100%)',
        }}
      />

      <div
        className="absolute bottom-0 left-0 right-0 pointer-events-none"
        style={{
          height: '12%',
          background: isDay
            ? 'linear-gradient(to top, hsl(210 60% 10% / 0.5) 0%, transparent 100%)'
            : 'linear-gradient(to top, hsl(217 78% 8% / 0.3) 0%, transparent 100%)',
        }}
      />
    </div>
  );
});

Globe.displayName = 'Globe';

export default Globe;
