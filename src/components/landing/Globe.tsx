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

const GLOBE_STAGE_SIZE = 'min(88vw, 88vh)';
const CAMERA_POS: [number, number, number] = [0, 3.6, 2.0]; // steep pilot view with visible curvature

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

  // Premium drift: starts in Italy / Central Europe and glides north toward Scandinavia
  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.x += delta * 0.0052;
      meshRef.current.rotation.y += delta * 0.0009;
    }
  });

  // Sphere textures in Three.js default toward the Americas at y=0.
  // This rotation locks the starting view around Italy / Central Europe.
  return (
    <mesh ref={meshRef} rotation={[0.68, -1.82, 0.08]}>
      <sphereGeometry args={[2, 128, 128]} />
      <meshStandardMaterial
        map={texture}
        emissiveMap={isDay ? undefined : texture}
        emissive={isDay ? 'hsl(0 0% 0%)' : 'hsl(0 0% 100%)'}
        emissiveIntensity={isDay ? 0 : 4.2}
        roughness={isDay ? 0.58 : 0.72}
        metalness={isDay ? 0.02 : 0}
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
          gl_FragColor = vec4(glowColor, intensity * 0.72);
        }
      `,
      uniforms: {
        glowColor: {
          value: new THREE.Color(isDay ? 'hsl(205 100% 72%)' : 'hsl(214 100% 74%)'),
        },
      },
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
    });
  }, [isDay]);

  return (
    <mesh scale={[1.12, 1.12, 1.12]}>
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
      className={`${className} flex items-center justify-center overflow-hidden`}
      aria-hidden="true"
      style={{ position: 'relative' }}
    >
      <div
        className="relative"
        style={{
          width: GLOBE_STAGE_SIZE,
          height: GLOBE_STAGE_SIZE,
          maxWidth: '980px',
          maxHeight: '980px',
        }}
      >
        <Canvas
          gl={{
            antialias: true,
            alpha: true,
            powerPreference: 'high-performance',
            preserveDrawingBuffer: false,
          }}
          camera={{ position: CAMERA_POS, fov: 42 }}
          dpr={[1, 2]}
          style={{
            position: 'absolute',
            inset: 0,
            background: 'transparent',
          }}
          frameloop="always"
        >
          <ambientLight intensity={isDay ? 1.35 : 1.1} />
          <hemisphereLight
            color={isDay ? 'hsl(202 100% 88%)' : 'hsl(215 100% 78%)'}
            groundColor={isDay ? 'hsl(210 50% 22%)' : 'hsl(223 46% 16%)'}
            intensity={isDay ? 0.85 : 0.5}
          />
          <directionalLight
            position={isDay ? [5, 2.8, 5.5] : [4, 2.4, 5.5]}
            intensity={isDay ? 2.4 : 1.35}
            color={isDay ? 'hsl(45 100% 96%)' : 'hsl(213 100% 88%)'}
          />
          <pointLight
            position={[0, 1.6, 5.6]}
            intensity={isDay ? 0.65 : 0.8}
            color="hsl(204 100% 84%)"
          />
          <pointLight
            position={[-3.8, 0.2, 4.2]}
            intensity={isDay ? 0.3 : 0.46}
            color="hsl(212 100% 79%)"
          />
          <pointLight
            position={[3.6, -0.6, 4.4]}
            intensity={isDay ? 0.28 : 0.42}
            color="hsl(195 100% 82%)"
          />

          <Suspense fallback={null}>
            <EarthSphere isDay={isDay} />
            <Atmosphere isDay={isDay} />
          </Suspense>
        </Canvas>

        <div
          className="absolute top-0 left-0 right-0 pointer-events-none"
          style={{
            height: '7%',
            background: isDay
              ? 'linear-gradient(to bottom, hsl(208 60% 12% / 0.16) 0%, transparent 100%)'
              : 'linear-gradient(to bottom, hsl(220 70% 10% / 0.12) 0%, transparent 100%)',
          }}
        />

        <div
          className="absolute bottom-0 left-0 right-0 pointer-events-none"
          style={{
            height: '8%',
            background: isDay
              ? 'linear-gradient(to top, hsl(208 60% 12% / 0.2) 0%, transparent 100%)'
              : 'linear-gradient(to top, hsl(220 70% 10% / 0.14) 0%, transparent 100%)',
          }}
        />
      </div>
    </div>
  );
});

Globe.displayName = 'Globe';

export default Globe;
