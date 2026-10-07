import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTruncationTooltip } from '@/hooks/useTruncationTooltip';

interface TruncatedMenuItemProps {
  label: string;
  icon?: React.ReactNode;
  itemClassName?: string;
  onSelect: (event: React.MouseEvent) => void;
}

/**
 * Menyval vars ruta endast öppnas när etiketten faktiskt är kapad i kolumnen.
 * Tidigare visades rutan utifrån en teckenräknare, vilket gav bubbla på korta
 * etiketter som fick plats och ingen bubbla på långa som klipptes.
 */
export function TruncatedMenuItem({ label, icon, itemClassName, onSelect }: TruncatedMenuItemProps) {
  const { ref, open, onOpenChange } = useTruncationTooltip<HTMLSpanElement>();

  return (
    <Tooltip open={open} onOpenChange={onOpenChange}>
      <TooltipTrigger asChild>
        <DropdownMenuItem onClick={onSelect} className={itemClassName}>
          {icon}
          <span ref={ref} className="truncate min-w-0">
            {label}
          </span>
        </DropdownMenuItem>
      </TooltipTrigger>
      <TooltipContent
        side="bottom"
        align="center"
        sideOffset={8}
        className="max-w-[280px] break-words whitespace-normal z-[999999]"
      >
        <p className="text-sm break-words whitespace-pre-wrap">{label}</p>
      </TooltipContent>
    </Tooltip>
  );
}
