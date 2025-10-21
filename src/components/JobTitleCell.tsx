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
    <div className={cn("flex flex-col gap-1", className)}>
      {/* Fixed width with line-clamp to truncate long titles */}
      <TruncatedText 
        text={title} 
        className="text-sm line-clamp-2 w-[280px] block overflow-hidden"
      />
      {employmentType && (
        <Badge variant="outline" className="w-fit text-[10px] bg-white/5 text-white border-white/20">
          {getEmploymentTypeLabel(employmentType)}
        </Badge>
      )}
    </div>
  );
}
