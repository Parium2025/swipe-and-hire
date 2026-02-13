import { memo } from 'react';
import { Badge } from '@/components/ui/badge';
import { getBenefitLabel } from '@/types/jobWizard';

interface JobViewBenefitsProps {
  benefits: string[];
}

export const JobViewBenefits = memo(function JobViewBenefits({ benefits }: JobViewBenefitsProps) {
  if (!benefits || benefits.length === 0) return null;

  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 overflow-hidden">
      <h2 className="text-section-title mb-3">Förmåner</h2>
      <div className="flex flex-wrap gap-2">
        {benefits.map((benefit, index) => (
          <Badge key={index} variant="secondary" className="text-xs bg-white/20 text-white border-white/30">
            {getBenefitLabel(benefit)}
          </Badge>
        ))}
      </div>
    </div>
  );
});
