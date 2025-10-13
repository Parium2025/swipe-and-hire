import React from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

type CompanyAvatarProps = {
  companyLogoUrl: string | null;
  companyName?: string | null;
  initials: string;
};

function CompanyAvatarBase({ companyLogoUrl, companyName, initials }: CompanyAvatarProps) {
  const [error, setError] = React.useState(false);

  return (
    <Avatar className="h-10 w-10 ring-2 ring-white/20 transform-gpu">
      {companyLogoUrl && !error ? (
        <AvatarImage
          src={companyLogoUrl}
          alt={`${companyName || "Företag"} logotyp`}
          decoding="sync"
          loading="eager"
          fetchPriority="high"
          draggable={false}
          onError={() => setError(true)}
        />
      ) : (
        <AvatarFallback className="bg-white/10 text-white font-semibold">
          {initials}
        </AvatarFallback>
      )}
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
