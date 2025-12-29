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
    <div className={cn("flex flex-col gap-1 items-center w-full overflow-hidden max-w-[140px] mx-auto h-[52px] justify-center", className)}>
      {/* Max 2 lines with ellipsis and forced word break for long words */}
      <TruncatedText 
        text={title} 
        className="text-sm w-full text-white font-medium text-center line-clamp-2 break-all"
      />
      {employmentType && (
        <Badge
          variant="glass"
          className="w-fit text-[10px] transition-all duration-300 md:group-hover:backdrop-brightness-90 md:hover:bg-white/15 md:hover:border-white/50 md:hover:backdrop-blur-sm md:hover:backdrop-brightness-110"
        >
          {getEmploymentTypeLabel(employmentType)}
        </Badge>
      )}
    </div>
  );
}
