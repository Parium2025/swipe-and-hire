import { Suspense, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowLeft } from 'lucide-react';

const PariumScene = () => {
  // Dynamic import to avoid SSR issues
  const [Scene, setScene] = useState<React.ComponentType | null>(null);

  useEffect(() => {
    import('@/components/3d/PariumScene').then((mod) => {
      setScene(() => mod.default);
    });
  }, []);

  if (!Scene) return null;
  return <Scene />;
};

export default function Showcase3D() {
  const navigate = useNavigate();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 300);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-[#050a18]">
      {/* 3D Canvas — full viewport */}
      <div className="absolute inset-0 z-0">
        <Suspense fallback={null}>
          <PariumScene />
        </Suspense>
      </div>

      {/* UI Overlay */}
      <AnimatePresence>
        {loaded && (
          <div className="relative z-10 flex h-full flex-col items-center justify-between pointer-events-none">
            {/* Top nav */}
            <motion.nav
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.5 }}
              className="w-full flex items-center justify-between px-6 pt-6 sm:px-12 sm:pt-10 pointer-events-auto"
            >
              <button
                onClick={() => navigate('/')}
                className="flex items-center gap-2 text-white/70 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="text-sm font-medium tracking-wide">Tillbaka</span>
              </button>
              <div className="text-white/30 text-xs tracking-[0.3em] uppercase font-light">
                3D Experience
              </div>
            </motion.nav>

            {/* Center content */}
            <div className="flex flex-col items-center gap-6 px-6 text-center">
              <motion.h1
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 1.2, delay: 0.8, ease: [0.22, 1, 0.36, 1] }}
                className="text-[clamp(3rem,10vw,8rem)] font-black uppercase leading-[0.85] tracking-[-0.05em] text-white"
                style={{
                  textShadow: '0 0 80px rgba(14,165,233,0.3), 0 0 160px rgba(14,165,233,0.1)',
                }}
              >
                Parium
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 1.2 }}
                className="max-w-md text-white/40 text-sm sm:text-base font-light leading-relaxed tracking-wide"
              >
                Rekrytering i en ny dimension.
                <br />
                Där talang möter möjlighet.
              </motion.p>

              <motion.button
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 1.5 }}
                whileHover={{ scale: 1.04, boxShadow: '0 0 40px rgba(14,165,233,0.4)' }}
                whileTap={{ scale: 0.97 }}
                onClick={() => navigate('/auth', { state: { mode: 'register' } })}
                className="pointer-events-auto mt-4 group inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 backdrop-blur-md px-8 py-3.5 text-sm font-semibold text-white transition-all hover:bg-white/10 hover:border-white/20"
              >
                Kom igång
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </motion.button>
            </div>

            {/* Bottom accent line */}
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 1.5, delay: 1.8, ease: [0.22, 1, 0.36, 1] }}
              className="w-48 h-px mb-10 origin-center"
              style={{
                background: 'linear-gradient(90deg, transparent, rgba(14,165,233,0.5), transparent)',
              }}
            />
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
