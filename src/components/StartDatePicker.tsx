import * as React from "react"
import { format } from "date-fns"
import { CalendarIcon, ChevronDown } from "lucide-react"
import { sv } from "date-fns/locale"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface StartDatePickerProps {
  value?: string
  onChange: (date: string) => void
  placeholder?: string
  className?: string
  /** Antal år framåt som ska visas i årsväljaren. Default 3. */
  yearsForward?: number
}

/**
 * Datumväljare för framtida startdatum. Samma visuella språk som
 * BirthDatePicker (glass-panel, vit text, år-/månad-dropdowns) men
 * begränsad till dagens datum och framåt.
 */
export function StartDatePicker({
  value,
  onChange,
  placeholder = "Välj startdatum",
  className,
  yearsForward = 3,
}: StartDatePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(
    value ? new Date(value) : undefined
  )

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: yearsForward + 1 }, (_, i) => currentYear + i)

  const months = Array.from({ length: 12 }, (_, i) => {
    const monthName = format(new Date(2000, i, 1), "MMMM", { locale: sv })
    return {
      value: i,
      label: monthName.charAt(0).toUpperCase() + monthName.slice(1),
    }
  })

  const handleYearChange = (year: string) => {
    const current = selectedDate || new Date()
    const newDate = new Date(parseInt(year), current.getMonth(), current.getDate())
    setSelectedDate(newDate)
    onChange(format(newDate, "yyyy-MM-dd"))
  }

  const handleMonthChange = (month: string) => {
    const current = selectedDate || new Date()
    const newDate = new Date(current.getFullYear(), parseInt(month), current.getDate())
    setSelectedDate(newDate)
    onChange(format(newDate, "yyyy-MM-dd"))
  }

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date)
      onChange(format(date, "yyyy-MM-dd"))
      setIsOpen(false)
    }
  }

  React.useEffect(() => {
    if (value && value !== (selectedDate ? format(selectedDate, "yyyy-MM-dd") : "")) {
      setSelectedDate(value ? new Date(value) : undefined)
    }
    if (!value && selectedDate) {
      setSelectedDate(undefined)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full h-11 !min-h-0 pl-3 pr-3 text-left text-sm font-normal bg-white/10 backdrop-blur-sm border-white/20 !text-white hover:bg-white/15 hover:!text-white hover:border-white/40 md:hover:bg-white/15 md:hover:!text-white md:hover:border-white/40 justify-start",
            className
          )}
        >
          <span className="mr-2 inline-flex items-center">
            <CalendarIcon className="h-4 w-4 text-white" />
          </span>
          {selectedDate ? (
            format(selectedDate, "d MMMM yyyy", { locale: sv })
          ) : (
            <span className="text-white/60">{placeholder}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0 glass-panel rounded-xl shadow-xl z-50"
        align="start"
        side="bottom"
        sideOffset={8}
      >
        <div className="p-3 space-y-3">
          <div className="flex gap-2">
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outlineNeutral"
                  className="flex-1 h-9 bg-white/5 border-white/10 text-white text-sm md:hover:bg-white/10 md:hover:text-white md:hover:border-white/50 justify-between transition-colors"
                >
                  <span>{selectedDate ? selectedDate.getFullYear() : "År"}</span>
                  <ChevronDown className="h-4 w-4 flex-shrink-0 text-white" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-32 max-h-60 overflow-y-auto glass-panel z-50 rounded-md text-white"
                side="bottom"
                align="center"
                sideOffset={6}
              >
                {years.map((year) => (
                  <DropdownMenuItem
                    key={year}
                    onClick={() => handleYearChange(year.toString())}
                    className="cursor-pointer hover:bg-white/10 focus:bg-white/10 py-2 text-white"
                  >
                    {year}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outlineNeutral"
                  className="flex-1 h-9 bg-white/5 border-white/10 text-white text-sm md:hover:bg-white/10 md:hover:text-white md:hover:border-white/50 justify-between transition-colors"
                >
                  <span>
                    {selectedDate ? months[selectedDate.getMonth()].label : "Månad"}
                  </span>
                  <ChevronDown className="h-4 w-4 flex-shrink-0 text-white" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-40 max-h-60 overflow-y-auto glass-panel z-50 rounded-md text-white"
                side="bottom"
                align="center"
                sideOffset={6}
              >
                {months.map((month) => (
                  <DropdownMenuItem
                    key={month.value}
                    onClick={() => handleMonthChange(month.value.toString())}
                    className="cursor-pointer hover:bg-white/10 focus:bg-white/10 py-2 text-white"
                  >
                    {month.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleDateSelect}
            disabled={(date) => date < today}
            month={selectedDate}
            onMonthChange={setSelectedDate}
            initialFocus
            locale={sv}
            weekStartsOn={1}
            className="p-0 pointer-events-auto text-white [&_.rdp-caption]:text-white [&_.rdp-nav_button]:text-white [&_.rdp-nav_button]:border-white/30 [&_.rdp-nav_button:hover]:bg-white/10 [&_.rdp-nav_button:hover]:text-white"
            classNames={{
              day: "h-9 w-9 p-0 font-normal text-white hover:bg-white/20",
              day_selected:
                "!bg-transparent !border !border-white !outline-none !shadow-none !text-white font-semibold hover:!bg-white/10",
              day_today: "bg-transparent text-white font-normal",
              day_disabled: "text-white/30",
            }}
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}
