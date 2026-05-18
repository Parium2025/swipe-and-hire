import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { useGLTF, Environment } from '@react-three/drei';
import * as THREE from 'three';
import screenTextureUrl from '@/assets/parium-phone-screen.png';

interface PhoneCanvasProps {
  className?: string;
  /** Hur stor telefonen renderas inom viewporten (0–1). Lägre = mer marginal. */
  fit?: number;
  active?: boolean;
  instantFallback?: boolean;
}

const MODEL_URL = '/models/parium-phone.glb';

/**
 * Centrerar & skalar GLB-modellen så att den ALLTID ramas in i viewporten,
 * oavsett canvas-storlek. Använder ortografisk kamera + auto-fit baserat på
 * objektets bounding box → ingen klippning, full responsivitet.
 */
function PhoneModel({ fit, active, onReady }: { fit: number; active: boolean; onReady: () => void }) {
  const { scene } = useGLTF(MODEL_URL);
  const groupRef = useRef<THREE.Group>(null);
  const { size, camera } = useThree();
  const pointer = useRef({ x: 0, y: 0 });
  const screenTexture = useLoader(THREE.TextureLoader, screenTextureUrl) as THREE.Texture;

  useMemo(() => {
    screenTexture.colorSpace = THREE.SRGBColorSpace;
    screenTexture.anisotropy = 8;
    screenTexture.flipY = true;
    screenTexture.needsUpdate = true;
  }, [screenTexture]);

  // Centrera modellen och skala till enhetshöjd 1
  const centeredScene = useMemo(() => {
    const cloned = scene.clone(true);
    const screenMaterial = new THREE.MeshBasicMaterial({ map: screenTexture, side: THREE.DoubleSide, toneMapped: false });
    const glassMaterial = new THREE.MeshPhysicalMaterial({ color: '#050812', roughness: 0.18, metalness: 0.05, transmission: 0.08, transparent: true, opacity: 0.98, side: THREE.DoubleSide });
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: '#11131c', roughness: 0.38, metalness: 0.28, side: THREE.DoubleSide });
    const metalMaterial = new THREE.MeshStandardMaterial({ color: '#d6d8e0', roughness: 0.24, metalness: 0.82, side: THREE.DoubleSide });

    cloned.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      child.castShadow = false;
      child.receiveShadow = false;
      const name = child.name.toLowerCase().replace(/_/g, ' ');
      if (name === 'screen') child.material = screenMaterial;
      else if (name.includes('screen border') || name.includes('dynamic island')) child.material = glassMaterial;
      else if (name.includes('back side')) child.material = bodyMaterial;
      else if (name.includes('metal') || name.includes('button')) child.material = metalMaterial;
    });

    const box = new THREE.Box3().setFromObject(cloned);
    const center = new THREE.Vector3();
    box.getCenter(center);
    cloned.position.sub(center);

    const sizeVec = new THREE.Vector3();
    box.getSize(sizeVec);
    const maxDim = Math.max(sizeVec.x, sizeVec.y, sizeVec.z);
    if (maxDim > 0) cloned.scale.setScalar(1 / maxDim);

    return cloned;
  }, [scene, screenTexture]);

  useEffect(() => {
    onReady();
  }, [onReady]);

  // Auto-fit ortografisk kamera till modellens projicerade storlek
  useEffect(() => {
    if (!(camera instanceof THREE.OrthographicCamera)) return;
    const aspect = size.width / size.height;
    const box = new THREE.Box3().setFromObject(centeredScene);
    const modelSize = new THREE.Vector3();
    box.getSize(modelSize);
    const safeWidth = modelSize.x + modelSize.z * 0.75;
    const safeHeight = modelSize.y + modelSize.z * 0.12;
    const heightForAspect = Math.max(safeHeight, safeWidth / aspect) / Math.max(fit, 0.1);
    const halfH = heightForAspect / 2;
    const halfW = halfH * aspect;
    camera.left = -halfW;
    camera.right = halfW;
    camera.top = halfH;
    camera.bottom = -halfH;
    camera.near = -10;
    camera.far = 10;
    camera.position.set(0, 0, 5);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [camera, centeredScene, size.width, size.height, fit]);

  // Mouse tilt
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const x = (e.clientX / window.innerWidth) * 2 - 1;
      const y = (e.clientY / window.innerHeight) * 2 - 1;
      pointer.current.x = x;
      pointer.current.y = y;
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  // Auto-rotate + tilt mot mus
  useFrame((state) => {
    if (!groupRef.current || !active) return;
    const auto = Math.sin(state.clock.elapsedTime * 0.65) * 0.08;
    const targetY = -0.18 + auto + pointer.current.x * 0.14;
    const targetX = -0.04 + pointer.current.y * 0.08;
    groupRef.current.rotation.y += (targetY - groupRef.current.rotation.y) * 0.07;
    groupRef.current.rotation.x += (targetX - groupRef.current.rotation.x) * 0.07;
  });

  return (
    <group ref={groupRef} rotation={[-0.04, -0.18, 0]}>
      <primitive object={centeredScene} />
    </group>
  );
}

export const PhoneCanvas = ({ className, fit = 0.78, active = true, instantFallback = false }: PhoneCanvasProps) => {
  const [ready, setReady] = useState(false);
  const [showFallback, setShowFallback] = useState(false);

  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (ready) return;
    if (instantFallback) {
      setShowFallback(true);
      return;
    }
    const t = window.setTimeout(() => setShowFallback(true), 1500);
    return () => window.clearTimeout(t);
  }, [ready, instantFallback]);

  useEffect(() => {
    if (reducedMotion || ready) {
      window.dispatchEvent(new Event('parium:spline-ready'));
    }
  }, [reducedMotion, ready]);

  if (reducedMotion) {
    return (
      <div
        className={`relative flex items-center justify-center ${className ?? ''}`}
        role="img"
        aria-label="Parium 3D-telefon (statisk vy)"
      >
        <div className="aspect-[9/19] w-[58%] max-w-[260px] rounded-[2.25rem] border border-white/15 bg-gradient-to-b from-white/10 to-white/[0.03] shadow-[0_30px_90px_hsl(var(--background)/0.5)] backdrop-blur-sm" />
      </div>
    );
  }

  return (
    <div
      className={`relative select-none overflow-visible ${className ?? ''}`}
      style={{ touchAction: 'pan-y', overscrollBehavior: 'contain' }}
    >
      {showFallback && !ready && (
        <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div
            className="relative aspect-[9/19] h-[82%] max-h-[360px] min-h-[190px] overflow-hidden rounded-[2.25rem] border border-white/15 backdrop-blur-sm"
            style={{
              background:
                'linear-gradient(180deg, hsl(var(--primary-foreground) / 0.13) 0%, hsl(var(--primary-foreground) / 0.035) 100%)',
              boxShadow:
                '0 26px 86px hsl(var(--background) / 0.45), inset 0 1px 0 hsl(var(--primary-foreground) / 0.16)',
            }}
          >
            <div className="absolute left-1/2 top-3 h-1.5 w-14 -translate-x-1/2 rounded-full bg-white/20" />
          </div>
        </div>
      )}
      <Canvas
        orthographic
        gl={{ antialias: true, alpha: true, preserveDrawingBuffer: false }}
        dpr={[1, 2]}
        camera={{ position: [0, 0, 5], zoom: 1 }}
        style={{
          width: '100%',
          height: '100%',
          background: 'transparent',
          opacity: ready ? 1 : 0,
          transition: 'opacity 500ms ease',
          touchAction: 'none',
        }}
      >
        <ambientLight intensity={0.85} />
        <directionalLight position={[3, 4, 5]} intensity={1.1} />
        <directionalLight position={[-3, -2, -4]} intensity={0.4} />
        <Suspense fallback={null}>
          <Environment preset="city" />
          <PhoneModel fit={fit} active={active} onReady={() => requestAnimationFrame(() => setReady(true))} />
        </Suspense>
      </Canvas>
    </div>
  );
};

useGLTF.preload(MODEL_URL);

export default PhoneCanvas;
