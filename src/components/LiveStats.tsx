import { useEffect, useState, useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Users, Briefcase, TrendingUp, Zap } from 'lucide-react';

interface Stat {
  icon: any;
  value: number;
  label: string;
  suffix: string;
}

const stats: Stat[] = [
  {
    icon: Users,
    value: 15000,
    label: 'Aktiva användare',
    suffix: '+'
  },
  {
    icon: Briefcase,
    value: 2500,
    label: 'Lediga jobb',
    suffix: '+'
  },
  {
    icon: TrendingUp,
    value: 95,
    label: 'Matchningsrate',
    suffix: '%'
  },
  {
    icon: Zap,
    value: 60,
    label: 'Sekunder till match',
    suffix: ''
  }
];

export const LiveStats = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.3 });

  return (
    <div ref={ref} className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {stats.map((stat, index) => (
        <StatCard 
          key={stat.label} 
          stat={stat} 
          index={index}
          isInView={isInView}
        />
      ))}
    </div>
  );
};

const StatCard = ({ 
  stat, 
  index,
  isInView 
}: { 
  stat: Stat; 
  index: number;
  isInView: boolean;
}) => {
  const [count, setCount] = useState(0);
  const Icon = stat.icon;

  useEffect(() => {
    if (!isInView) return;

    const duration = 2000; // 2 seconds
    const steps = 60;
    const increment = stat.value / steps;
    const stepDuration = duration / steps;

    let currentStep = 0;
    const timer = setInterval(() => {
      currentStep++;
      if (currentStep <= steps) {
        setCount(Math.min(Math.round(increment * currentStep), stat.value));
      } else {
        clearInterval(timer);
        setCount(stat.value);
      }
    }, stepDuration);

    return () => clearInterval(timer);
  }, [isInView, stat.value]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ delay: index * 0.1, duration: 0.5 }}
      className="relative group"
    >
      <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10 hover:bg-white/10 transition-all duration-300">
        {/* Icon with glow */}
        <div className="relative mb-4">
          <div className="w-12 h-12 rounded-xl bg-secondary/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
            <Icon className="w-6 h-6 text-secondary" />
          </div>
          <div className="absolute inset-0 bg-secondary/20 rounded-xl blur-xl group-hover:blur-2xl transition-all duration-300" />
        </div>

        {/* Counter */}
        <div className="space-y-2">
          <div className="text-4xl font-bold text-white">
            {count.toLocaleString('sv-SE')}
            <span className="text-secondary">{stat.suffix}</span>
          </div>
          <div className="text-white/70 text-sm font-medium">
            {stat.label}
          </div>
        </div>

        {/* Animated gradient border */}
        <motion.div
          className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(var(--secondary-rgb), 0.5), transparent)',
            backgroundSize: '200% 100%',
          }}
          animate={{
            backgroundPosition: ['0% 0%', '200% 0%'],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
      </div>
    </motion.div>
  );
};
