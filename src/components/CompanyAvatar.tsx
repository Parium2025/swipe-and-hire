import React from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn } from '@/lib/utils';

type CompanyAvatarProps = {
  companyLogoUrl: string | null;
  companyName?: string | null;
  initials: string;
  className?: string;
};

function CompanyAvatarBase({ companyLogoUrl, companyName, initials, className }: CompanyAvatarProps) {
  return (
    <Avatar className={cn("h-10 w-10 ring-2 ring-white/20 transform-gpu", className)} style={{ contain: 'paint' }}>
      <AvatarImage
        src={companyLogoUrl || ''}
        alt={`${companyName || "Företag"} logotyp`}
      />
      <AvatarFallback fallbackType="company" className="bg-white/20 text-white font-semibold" delayMs={150}>
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}

export const CompanyAvatar = React.memo(CompanyAvatarBase, (prev, next) => {
  return (
    prev.companyLogoUrl === next.companyLogoUrl &&
    prev.initials === next.initials &&
    prev.companyName === next.companyName &&
    prev.className === next.className
  );
});

export default CompanyAvatar;
