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
    <div className={cn("flex flex-col gap-1 items-center", className)}>
      {/* Max 2 lines with ellipsis at natural wrap points */}
      <TruncatedText 
        text={title} 
        className="text-sm two-line-ellipsis max-w-[280px] w-full block text-white font-medium text-center"
      />
      {employmentType && (
        <Badge variant="outline" className="w-fit text-[10px] bg-white/5 text-white border-white/20 transition-all duration-300 md:hover:bg-white/10 md:hover:text-white">
          {getEmploymentTypeLabel(employmentType)}
        </Badge>
      )}
    </div>
  );
}
