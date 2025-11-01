import React from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

type CompanyAvatarProps = {
  companyLogoUrl: string | null;
  companyName?: string | null;
  initials: string;
};

function CompanyAvatarBase({ companyLogoUrl, companyName, initials }: CompanyAvatarProps) {
  const [error, setError] = React.useState(false);
  const [retryCount, setRetryCount] = React.useState(0);

  const handleError = React.useCallback(() => {
    if (retryCount < 2) {
      // Retry loading image up to 2 times
      setRetryCount(prev => prev + 1);
      setError(false);
    } else {
      setError(true);
    }
  }, [retryCount]);

  return (
    <Avatar className="h-10 w-10 ring-2 ring-white/20 transform-gpu" style={{ contain: 'paint' }}>
      {companyLogoUrl && !error ? (
        <AvatarImage
          src={`${companyLogoUrl}${retryCount > 0 ? `?retry=${retryCount}` : ''}`}
          alt={`${companyName || "Företag"} logotyp`}
          decoding="async"
          loading="eager"
          fetchPriority="high"
          draggable={false}
          onError={handleError}
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
