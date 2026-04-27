import { motion, useScroll, useTransform } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, BriefcaseBusiness, CheckCircle2, Search, Users } from 'lucide-react';
import { useRef } from 'react';

const groups = [
  {
    label: 'Jobbsökare',
    title: 'Ett enklare sätt att hitta jobb som passar.',
    description: 'Se relevanta roller, förstå matchningen och visa intresse utan att fastna i långa processer.',
    role: 'job_seeker' as const,
    icon: Search,
    bullets: ['Relevanta jobb först', 'Profil som visar mer än ett CV', 'Snabb dialog vid matchning'],
  },
  {
    label: 'Arbetsgivare',
    title: 'Ett snabbare sätt att hitta rätt människor.',
    description: 'Få en tydligare bild av kandidater, sortera smartare och kom snabbare till samtal.',
    role: 'employer' as const,
    icon: BriefcaseBusiness,
    bullets: ['Matchade kandidater', 'Smidigare urval', 'Tydligare nästa steg'],
  },
];

const LandingForUsers = () => {
  const navigate = useNavigate();
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start end', 'end start'] });
  const headerY = useTransform(scrollYProgress, [0, 0.3], [56, 0]);
  const headerOpacity = useTransform(scrollYProgress, [0, 0.2], [0, 1]);

  const goTo = (role: 'job_seeker' | 'employer') => {
    sessionStorage.setItem('parium-skip-splash', '1');
    navigate('/auth', { state: { mode: 'register', role } });
  };

  return (
    <section ref={sectionRef} className="relative px-5 py-24 sm:px-6 sm:py-32 md:px-12 lg:px-24" aria-labelledby="for-users-heading">
      <div className="relative z-10 mx-auto max-w-[1400px]">
        <motion.div className="mb-14 sm:mb-20" style={{ y: headerY, opacity: headerOpacity }}>
          <span className="inline-flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-secondary/65">
            <span className="h-px w-12 bg-gradient-to-r from-secondary to-transparent" />
            För båda sidor
          </span>
          <h2 id="for-users-heading" className="mt-5 max-w-4xl text-4xl font-black tracking-[-0.025em] text-white sm:text-5xl md:text-6xl">
            Samma plattform. Två starka flöden.
          </h2>
        </motion.div>

        <div className="grid gap-5 lg:grid-cols-2">
          {groups.map((group) => {
            const Icon = group.icon;
            return (
              <motion.article
                key={group.label}
                initial={{ opacity: 0, y: 34 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
                className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.035] p-7 backdrop-blur-xl sm:p-9 lg:p-10"
              >
                <div className="absolute right-0 top-0 h-72 w-72 translate-x-1/3 -translate-y-1/3 rounded-full bg-secondary/8 blur-[90px]" />
                <div className="relative z-10">
                  <div className="mb-8 flex items-center justify-between gap-4">
                    <span className="inline-flex items-center gap-2 rounded-full border border-secondary/20 bg-secondary/10 px-3 py-1.5 text-xs font-bold text-secondary">
                      <Icon className="h-3.5 w-3.5" />
                      {group.label}
                    </span>
                    <Users className="h-5 w-5 text-white/18" />
                  </div>
                  <h3 className="max-w-xl text-3xl font-black leading-tight tracking-[-0.02em] text-white sm:text-4xl">{group.title}</h3>
                  <p className="mt-5 max-w-xl text-sm leading-7 text-white/50">{group.description}</p>
                  <ul className="mt-8 space-y-3">
                    {group.bullets.map((bullet) => (
                      <li key={bullet} className="flex items-center gap-3 text-sm font-medium text-white/62">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-secondary" />
                        {bullet}
                      </li>
                    ))}
                  </ul>
                  <button onPointerDown={() => goTo(group.role)} className="group mt-9 inline-flex min-h-touch items-center gap-2 rounded-full border border-white/10 bg-white/[0.045] px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-white/[0.075]">
                    Kom igång
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </button>
                </div>
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default LandingForUsers;
