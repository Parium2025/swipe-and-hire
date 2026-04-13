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

  // Slow upward drift (Italy → Scandinavia) + gentle horizontal rotation
  useFrame((_, delta) => {
    if (meshRef.current) {
      // Primary: tilt upward continuously (negative x = reveals northern latitudes)
      meshRef.current.rotation.x -= delta * 0.012;
      // Secondary: very slow eastward drift for realism
      meshRef.current.rotation.y += delta * 0.005;
    }
  });

  return (
    <mesh ref={meshRef} rotation={[0.15, -0.4, 0.1]}>
      <sphereGeometry args={[2, 128, 128]} />
      <meshStandardMaterial
        map={texture}
        emissiveMap={isDay ? undefined : texture}
        emissive={isDay ? '#000000' : '#ffffff'}
        emissiveIntensity={isDay ? 0 : 0.6}
        roughness={isDay ? 0.85 : 1}
        metalness={isDay ? 0.05 : 0}
        toneMapped={true}
      />
    </mesh>
  );
}

/* ── atmosphere glow ─────────────────────────────────────── */

function Atmosphere({ isDay }: { isDay: boolean }) {
  const shaderRef = useRef<THREE.ShaderMaterial>(null!);
  
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
          float intensity = pow(0.65 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 3.0);
          gl_FragColor = vec4(glowColor, intensity * 0.6);
        }
      `,
      uniforms: {
        glowColor: { value: new THREE.Color(isDay ? '#4488ff' : '#1a3a6a') },
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
      <primitive object={atmosphereMaterial} ref={shaderRef} />
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
        camera={{ position: [0, 0.3, 4.2], fov: 40 }}
        dpr={[1, 2]}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'transparent',
        }}
        frameloop="always"
      >
        {/* Lighting */}
        <ambientLight intensity={isDay ? 0.3 : 0.05} />
        <directionalLight
          position={isDay ? [5, 3, 5] : [3, 1, 4]}
          intensity={isDay ? 1.8 : 0.15}
          color={isDay ? '#fffaf0' : '#334466'}
        />
        {!isDay && (
          <pointLight position={[0, 0, 5]} intensity={0.3} color="#1a2a4a" />
        )}

        <Suspense fallback={null}>
          <EarthSphere isDay={isDay} />
          <Atmosphere isDay={isDay} />
        </Suspense>
      </Canvas>

      {/* Top fade to page background */}
      <div
        className="absolute top-0 left-0 right-0 pointer-events-none"
        style={{
          height: '20%',
          background: isDay
            ? 'linear-gradient(to bottom, hsl(210 60% 8%) 0%, transparent 100%)'
            : 'linear-gradient(to bottom, hsl(215 100% 4%) 0%, transparent 100%)',
        }}
      />

      {/* Bottom fade */}
      <div
        className="absolute bottom-0 left-0 right-0 pointer-events-none"
        style={{
          height: '25%',
          background: isDay
            ? 'linear-gradient(to top, hsl(210 60% 8%) 0%, transparent 100%)'
            : 'linear-gradient(to top, hsl(215 100% 4%) 0%, transparent 100%)',
        }}
      />
    </div>
  );
});

Globe.displayName = 'Globe';

export default Globe;
