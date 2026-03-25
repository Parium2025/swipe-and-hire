import { motion } from 'framer-motion';
import { Video, Building2 } from 'lucide-react';

export type InterviewType = 'video' | 'kontor';

interface InterviewTypeTabsProps {
  activeType: InterviewType;
  onTypeChange: (type: InterviewType) => void;
}

export const InterviewTypeTabs = ({ activeType, onTypeChange }: InterviewTypeTabsProps) => {
  return (
    <div className="relative flex bg-white/5 rounded-lg p-1 border border-white/10 w-fit">
      <motion.div
        className="absolute top-1 bottom-1 bg-white/20 rounded-md"
        initial={false}
        animate={{
          left: activeType === 'video' ? '4px' : '50%',
          width: 'calc(50% - 4px)',
        }}
        transition={{
          type: "spring",
          stiffness: 300,
          damping: 35,
          mass: 0.8,
        }}
      />
      <button
        type="button"
        onClick={() => onTypeChange('video')}
        className="relative z-10 flex items-center gap-1.5 py-1.5 px-4 rounded-md text-sm font-medium text-white transition-colors"
      >
        <Video className="h-3.5 w-3.5" />
        <span>Video</span>
      </button>
      <button
        type="button"
        onClick={() => onTypeChange('kontor')}
        className="relative z-10 flex items-center gap-1.5 py-1.5 px-4 rounded-md text-sm font-medium text-white transition-colors"
      >
        <Building2 className="h-3.5 w-3.5" />
        <span>Kontor</span>
      </button>
    </div>
  );
};
