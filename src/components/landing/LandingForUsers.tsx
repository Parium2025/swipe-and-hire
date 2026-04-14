import { motion, useScroll, useTransform } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Search, Users, Video, BarChart3, Shield, Zap } from 'lucide-react';
import { useRef } from 'react';

const ease = [0.22, 1, 0.36, 1] as const;

const jobSeekerFeatures = [
  { icon: Search, text: 'Swipea bland tusentals jobb' },
  { icon: Video, text: 'Visa vem du är med videoprofil' },
  { icon: Zap, text: 'Ansök på sekunder' },
];

const employerFeatures = [
  { icon: Users, text: 'AI-matchade kandidater direkt' },
  { icon: BarChart3, text: 'Automatisk CV-screening' },
  { icon: Shield, text: 'GDPR-säkert och svenskt' },
];

const LandingForUsers = () => {
  const navigate = useNavigate();
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start end', 'end start'] });

  const headerY = useTransform(scrollYProgress, [0, 0.3], [80, 0]);
  const headerOpacity = useTransform(scrollYProgress, [0, 0.2], [0, 1]);
  const leftX = useTransform(scrollYProgress, [0.05, 0.3], [-100, 0]);
  const rightX = useTransform(scrollYProgress, [0.05, 0.3], [100, 0]);
  const cardsOpacity = useTransform(scrollYProgress, [0.05, 0.25], [0, 1]);
  const cardsScale = useTransform(scrollYProgress, [0.05, 0.3], [0.92, 1]);

  const goTo = (role: 'job_seeker' | 'employer') => {
    sessionStorage.setItem('parium-skip-splash', '1');
    navigate('/auth', { state: { mode: 'register', role } });
  };

  return (
    <section ref={sectionRef} className="relative py-28 sm:py-36 lg:py-48 px-5 sm:px-6 md:px-12 lg:px-24" aria-labelledby="for-users-heading">
      <div className="max-w-[1400px] mx-auto relative z-10">
        <motion.div className="mb-20 sm:mb-28" style={{ y: headerY, opacity: headerOpacity }}>
          <span className="inline-flex items-center gap-3 text-[10px] sm:text-[11px] font-semibold tracking-[0.3em] uppercase text-secondary/50">
            <span className="w-10 sm:w-14 h-px bg-gradient-to-r from-secondary to-transparent" />
            Byggd för alla
          </span>
          <h2 id="for-users-heading" className="mt-5 text-4xl sm:text-5xl md:text-7xl font-black tracking-[-0.04em] text-white uppercase">
            En plattform.<span className="text-white/10"> Två perspektiv.</span>
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-5 sm:gap-8">
          {/* Job seekers */}
          <motion.div style={{ x: leftX, opacity: cardsOpacity, scale: cardsScale }}
            className="relative p-8 sm:p-12 lg:p-16 rounded-3xl border border-white/[0.04] bg-white/[0.015] hover:border-secondary/20 transition-all duration-700 overflow-hidden group">
            <div className="absolute top-0 right-0 w-[350px] h-[350px] bg-secondary/[0.03] rounded-full blur-[100px] pointer-events-none group-hover:bg-secondary/[0.06] transition-colors duration-700" />
            <div className="relative z-10">
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/[0.08] border border-secondary/15 text-secondary text-[10px] sm:text-xs font-semibold tracking-wider uppercase mb-10">Jobbsökare</span>
              <h3 className="text-3xl sm:text-4xl md:text-5xl font-black text-white mb-5 tracking-[-0.03em] uppercase">Hitta dröm<span className="text-white/15">jobbet</span></h3>
              <p className="text-white/30 text-sm leading-relaxed mb-10 max-w-md">Sluta scrolla genom oändliga listor. Swipea till jobb som faktiskt matchar dig.</p>
              <ul className="space-y-4 mb-12">
                {jobSeekerFeatures.map((f) => { const Icon = f.icon; return (
                  <li key={f.text} className="flex items-center gap-3 text-white/45 text-sm"><Icon className="w-4 h-4 text-secondary flex-shrink-0" strokeWidth={1.5} />{f.text}</li>
                ); })}
              </ul>
              <button onClick={() => goTo('job_seeker')} className="group/btn flex items-center gap-2 text-white font-semibold text-sm hover:text-secondary transition-colors">
                Kom igång <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1.5 transition-transform" />
              </button>
            </div>
          </motion.div>

          {/* Employers */}
          <motion.div style={{ x: rightX, opacity: cardsOpacity, scale: cardsScale }}
            className="relative p-8 sm:p-12 lg:p-16 rounded-3xl border border-white/[0.04] bg-white/[0.015] hover:border-secondary/20 transition-all duration-700 overflow-hidden group md:mt-16">
            <div className="absolute top-0 right-0 w-[350px] h-[350px] bg-secondary/[0.03] rounded-full blur-[100px] pointer-events-none group-hover:bg-secondary/[0.06] transition-colors duration-700" />
            <div className="relative z-10">
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/[0.08] border border-secondary/15 text-secondary text-[10px] sm:text-xs font-semibold tracking-wider uppercase mb-10">Arbetsgivare</span>
              <h3 className="text-3xl sm:text-4xl md:text-5xl font-black text-white mb-5 tracking-[-0.03em] uppercase">Hitta rätt<span className="text-white/15"> talang</span></h3>
              <p className="text-white/30 text-sm leading-relaxed mb-10 max-w-md">Sluta vänta veckor på ansökningar. Få AI-matchade kandidater direkt i fickan.</p>
              <ul className="space-y-4 mb-12">
                {employerFeatures.map((f) => { const Icon = f.icon; return (
                  <li key={f.text} className="flex items-center gap-3 text-white/45 text-sm"><Icon className="w-4 h-4 text-secondary flex-shrink-0" strokeWidth={1.5} />{f.text}</li>
                ); })}
              </ul>
              <button onClick={() => goTo('employer')} className="group/btn flex items-center gap-2 text-white font-semibold text-sm hover:text-secondary transition-colors">
                Kom igång <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1.5 transition-transform" />
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default LandingForUsers;
