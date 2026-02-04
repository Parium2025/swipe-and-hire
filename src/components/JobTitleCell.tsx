import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { getEmploymentTypeLabel } from "@/lib/employmentTypes";
import { TruncatedText } from "@/components/TruncatedText";

interface JobTitleCellProps {
  title: string;
  employmentType?: string | null;
  className?: string;
}

export function JobTitleCell({ title, employmentType, className }: JobTitleCellProps) {
  return (
    <div className={cn("flex flex-col items-center gap-1 w-full overflow-hidden", className)}>
      {/* Max 2 lines with ellipsis - TruncatedText handles tooltip */}
      <TruncatedText 
        text={title} 
        className="text-sm w-full text-white font-medium line-clamp-2 overflow-hidden break-all text-center"
      />
      {employmentType && (
        <Badge
          variant="glass"
          className="text-[10px] transition-all duration-300 md:group-hover:backdrop-brightness-90 md:hover:bg-white/15 md:hover:border-white/50 md:hover:backdrop-blur-sm md:hover:backdrop-brightness-110"
        >
          {getEmploymentTypeLabel(employmentType)}
        </Badge>
      )}
    </div>
  );
}
