import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, MeshTransmissionMaterial, Environment, Stars } from '@react-three/drei';
import * as THREE from 'three';

/* ─── Interlocking Parium rings ─── */
function PariumRing({
  color,
  position,
  rotation,
}: {
  color: string;
  position: [number, number, number];
  rotation: [number, number, number];
}) {
  const ref = useRef<THREE.Mesh>(null!);

  useFrame((_, delta) => {
    ref.current.rotation.y += delta * 0.15;
  });

  return (
    <mesh ref={ref} position={position} rotation={rotation}>
      <torusGeometry args={[1.6, 0.32, 64, 128]} />
      <meshPhysicalMaterial
        color={color}
        metalness={0.3}
        roughness={0.15}
        clearcoat={1}
        clearcoatRoughness={0.1}
        envMapIntensity={2}
      />
    </mesh>
  );
}

/* ─── Floating particle field ─── */
function Particles({ count = 600 }: { count?: number }) {
  const ref = useRef<THREE.Points>(null!);

  const [positions, sizes] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const sz = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 30;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 20;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 30;
      sz[i] = Math.random() * 0.04 + 0.01;
    }
    return [pos, sz];
  }, [count]);

  useFrame((state) => {
    ref.current.rotation.y = state.clock.elapsedTime * 0.02;
    ref.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.01) * 0.1;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-size" args={[sizes, 1]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.06}
        color="#0EA5E9"
        transparent
        opacity={0.6}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

/* ─── Glass sphere accent ─── */
function GlassSphere({ position }: { position: [number, number, number] }) {
  const ref = useRef<THREE.Mesh>(null!);

  useFrame((state) => {
    ref.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 0.5) * 0.3;
  });

  return (
    <mesh ref={ref} position={position}>
      <sphereGeometry args={[0.5, 64, 64]} />
      <MeshTransmissionMaterial
        backside
        samples={6}
        thickness={0.5}
        chromaticAberration={0.3}
        anisotropy={0.3}
        distortion={0.2}
        distortionScale={0.3}
        temporalDistortion={0.1}
        color="#14B8A6"
        transmissionSampler
      />
    </mesh>
  );
}

/* ─── Orbiting light trails ─── */
function LightTrail() {
  const ref = useRef<THREE.PointLight>(null!);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    ref.current.position.x = Math.sin(t * 0.4) * 5;
    ref.current.position.y = Math.cos(t * 0.3) * 3;
    ref.current.position.z = Math.cos(t * 0.4) * 5;
  });

  return <pointLight ref={ref} color="#0EA5E9" intensity={8} distance={12} />;
}

/* ─── Camera rig with subtle drift ─── */
function CameraRig() {
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    state.camera.position.x = Math.sin(t * 0.08) * 0.5;
    state.camera.position.y = Math.cos(t * 0.06) * 0.3 + 0.5;
    state.camera.lookAt(0, 0, 0);
  });
  return null;
}

/* ─── Main 3D scene ─── */
export default function PariumScene() {
  return (
    <Canvas
      camera={{ position: [0, 0.5, 7], fov: 50 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      style={{ background: 'transparent' }}
    >
      <color attach="background" args={['#050a18']} />
      <fog attach="fog" args={['#050a18', 8, 25]} />

      {/* Lighting */}
      <ambientLight intensity={0.15} />
      <directionalLight position={[5, 5, 5]} intensity={0.8} color="#ffffff" />
      <directionalLight position={[-5, 3, -5]} intensity={0.4} color="#0EA5E9" />
      <LightTrail />

      {/* Environment for reflections */}
      <Environment preset="night" />
      <Stars radius={50} depth={60} count={1500} factor={3} saturation={0.5} fade speed={0.5} />

      {/* Parium rings — interlocking */}
      <Float speed={1.5} rotationIntensity={0.3} floatIntensity={0.8}>
        <group>
          <PariumRing
            color="#0EA5E9"
            position={[-0.7, 0, 0]}
            rotation={[Math.PI / 2, 0.3, 0]}
          />
          <PariumRing
            color="#14B8A6"
            position={[0.7, 0, 0]}
            rotation={[Math.PI / 2, -0.3, Math.PI / 6]}
          />
        </group>
      </Float>

      {/* Glass accents */}
      <GlassSphere position={[-3.5, 1.5, -2]} />
      <GlassSphere position={[4, -1, -3]} />

      {/* Particles */}
      <Particles count={800} />

      {/* Camera movement */}
      <CameraRig />
    </Canvas>
  );
}
