import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { getEmploymentTypeLabel } from "@/lib/employmentTypes";

interface JobTitleCellProps {
  title: string;
  employmentType?: string | null;
  className?: string;
}

export function JobTitleCell({ title, employmentType, className }: JobTitleCellProps) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {/* Fix width to ensure identical wrapping across pages */}
      <span className="text-sm line-clamp-2 max-w-[340px] sm:max-w-[380px]">
        {title}
      </span>
      {employmentType && (
        <Badge variant="outline" className="w-fit text-[10px] bg-white/5 text-white border-white/20">
          {getEmploymentTypeLabel(employmentType)}
        </Badge>
      )}
    </div>
  );
}
