import React from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

type CompanyAvatarProps = {
  companyLogoUrl: string | null;
  companyName?: string | null;
  initials: string;
};

function CompanyAvatarBase({ companyLogoUrl, companyName, initials }: CompanyAvatarProps) {
  return (
    <Avatar className="h-10 w-10 ring-2 ring-white/20 transform-gpu">
      <AvatarImage
        src={companyLogoUrl || ''}
        alt={`${companyName || "Företag"} logotyp`}
        loading="lazy"
      />
      <AvatarFallback className="bg-white/20 text-white font-semibold" delayMs={150}>
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}

export const CompanyAvatar = React.memo(CompanyAvatarBase, (prev, next) => {
  return (
    prev.companyLogoUrl === next.companyLogoUrl &&
    prev.initials === next.initials &&
    prev.companyName === next.companyName
  );
});

export default CompanyAvatar;
