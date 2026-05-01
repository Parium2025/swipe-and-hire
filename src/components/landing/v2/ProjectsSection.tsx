import { useInViewAnimation } from '@/hooks/useInViewAnimation';

type Project = {
  name: string;
  description: string;
  image: string;
};

const PROJECTS: Project[] = [
  {
    name: 'Swipe-matchning',
    description: 'Från CV-träsk till matchande kandidater på sekunder.',
    image:
      'https://motionsites.ai/assets/hero-evr-ventures-preview-DZxeVFEX.gif',
  },
  {
    name: 'Smart annonsering',
    description: 'Få jobbet sett av rätt personer — inte alla.',
    image:
      'https://motionsites.ai/assets/hero-automation-machines-preview-DlTveRIN.gif',
  },
  {
    name: 'Karriärprofil',
    description: 'Modern profil som ersätter gamla CV:n helt.',
    image:
      'https://motionsites.ai/assets/hero-xportfolio-preview-D4A8maiC.gif',
  },
];

const ProjectItem = ({ project, delay }: { project: Project; delay: number }) => {
  const { ref, inView } = useInViewAnimation();
  return (
    <div
      ref={ref}
      className={inView ? 'animate-landing-fade-in-up' : 'opacity-0'}
      style={{ animationDelay: `${delay}s` }}
    >
      <div className="ml-20 md:ml-28 mb-6">
        <h3 className="font-pp-mondwest text-2xl md:text-3xl font-semibold text-white">
          {project.name}
        </h3>
        <p className="mt-2 text-sm md:text-base text-white/75 max-w-xl">
          {project.description}
        </p>
      </div>
      <img
        src={project.image}
        alt={project.name}
        loading="lazy"
        className="w-full rounded-2xl shadow-lg ring-1 ring-white/10 object-cover"
      />
    </div>
  );
};

const ProjectsSection = () => {
  return (
    <section className="relative z-10 mx-auto w-full max-w-[1200px] px-6 py-12">
      <div className="flex flex-col gap-16 md:gap-20">
        {PROJECTS.map((p, i) => (
          <ProjectItem key={p.name} project={p} delay={0.1 * (i + 1)} />
        ))}
      </div>
    </section>
  );
};

export default ProjectsSection;
