import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Search, Users, Video, BarChart3, Shield, Zap } from 'lucide-react';

const jobSeekerFeatures = [
  { icon: Search, text: 'Swipea bland tusentals jobb' },
  { icon: Video, text: 'Visa vem du är med videoprofil' },
  { icon: Zap, text: 'Ansök på sekunder — inte timmar' },
];

const employerFeatures = [
  { icon: Users, text: 'AI-matchade kandidater direkt' },
  { icon: BarChart3, text: 'Automatisk CV-screening' },
  { icon: Shield, text: 'GDPR-säkert och svenskt' },
];

const ease = [0.22, 1, 0.36, 1] as const;

const LandingForUsers = () => {
  const navigate = useNavigate();

  const goTo = (role: 'job_seeker' | 'employer') => {
    sessionStorage.setItem('parium-skip-splash', '1');
    navigate('/auth', { state: { mode: 'register', role } });
  };

  return (
    <section className="relative py-24 sm:py-32 lg:py-40 px-5 sm:px-6 md:px-12 lg:px-24" aria-labelledby="for-users-heading">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2/3 max-w-lg h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      <div className="max-w-6xl mx-auto">
        <motion.header
          className="text-center mb-16 sm:mb-20"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6 }}
        >
          <span className="text-[hsl(250_80%_70%)] text-[11px] sm:text-xs font-semibold tracking-[0.2em] uppercase mb-4 block">
            Byggd för alla
          </span>
          <h2 id="for-users-heading" className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-[-0.03em] text-white">
            En plattform,{' '}
            <span className="text-white/30">två perspektiv.</span>
          </h2>
        </motion.header>

        <div className="grid md:grid-cols-2 gap-6 sm:gap-8">
          {/* Job seekers */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease }}
            className="p-8 sm:p-10 rounded-3xl border border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] transition-all duration-500"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[hsl(200_80%_50%/0.1)] border border-[hsl(200_80%_50%/0.2)] text-[hsl(200_80%_70%)] text-xs font-medium mb-6">
              <Search className="w-3 h-3" />
              Jobbsökare
            </div>
            <h3 className="text-2xl sm:text-3xl font-bold text-white mb-3 tracking-tight">
              Hitta drömjobbet
            </h3>
            <p className="text-white/35 text-sm leading-relaxed mb-8">
              Sluta scrolla genom oändliga listor. Swipea till jobb som faktiskt matchar dig.
            </p>
            <ul className="space-y-4 mb-8">
              {jobSeekerFeatures.map((f) => {
                const Icon = f.icon;
                return (
                  <li key={f.text} className="flex items-center gap-3 text-white/50 text-sm">
                    <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center flex-shrink-0">
                      <Icon className="w-4 h-4 text-[hsl(200_80%_70%)]" strokeWidth={1.5} />
                    </div>
                    {f.text}
                  </li>
                );
              })}
            </ul>
            <button
              onClick={() => goTo('job_seeker')}
              className="group flex items-center gap-2 text-white font-medium text-sm hover:text-white/80 transition-colors"
            >
              Kom igång som jobbsökare
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </motion.div>

          {/* Employers */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1, ease }}
            className="p-8 sm:p-10 rounded-3xl border border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] transition-all duration-500"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[hsl(250_60%_50%/0.1)] border border-[hsl(250_60%_50%/0.2)] text-[hsl(250_80%_70%)] text-xs font-medium mb-6">
              <Users className="w-3 h-3" />
              Arbetsgivare
            </div>
            <h3 className="text-2xl sm:text-3xl font-bold text-white mb-3 tracking-tight">
              Hitta rätt talang
            </h3>
            <p className="text-white/35 text-sm leading-relaxed mb-8">
              Sluta vänta veckor på ansökningar. Få AI-matchade kandidater direkt i fickan.
            </p>
            <ul className="space-y-4 mb-8">
              {employerFeatures.map((f) => {
                const Icon = f.icon;
                return (
                  <li key={f.text} className="flex items-center gap-3 text-white/50 text-sm">
                    <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center flex-shrink-0">
                      <Icon className="w-4 h-4 text-[hsl(250_80%_70%)]" strokeWidth={1.5} />
                    </div>
                    {f.text}
                  </li>
                );
              })}
            </ul>
            <button
              onClick={() => goTo('employer')}
              className="group flex items-center gap-2 text-white font-medium text-sm hover:text-white/80 transition-colors"
            >
              Kom igång som arbetsgivare
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default LandingForUsers;
