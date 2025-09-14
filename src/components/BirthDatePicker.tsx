import * as React from "react"
import { format } from "date-fns"
import { CalendarIcon, ChevronDown } from "lucide-react"
import { sv } from "date-fns/locale"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface BirthDatePickerProps {
  value?: string
  onChange: (date: string) => void
  placeholder?: string
  className?: string
}

export function BirthDatePicker({
  value,
  onChange,
  placeholder = "Välj födelsedatum",
  className
}: BirthDatePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(
    value ? new Date(value) : undefined
  )

  // Generate years from 1920 to current year
  const currentYear = new Date().getFullYear()
  const years = Array.from(
    { length: currentYear - 1919 }, 
    (_, i) => currentYear - i
  )

  // Generate months
  const months = Array.from({ length: 12 }, (_, i) => ({
    value: i,
    label: format(new Date(2000, i, 1), "MMMM", { locale: sv })
  }))

  const handleYearChange = (year: string) => {
    const currentDate = selectedDate || new Date()
    const newDate = new Date(parseInt(year), currentDate.getMonth(), currentDate.getDate())
    setSelectedDate(newDate)
    onChange(format(newDate, "yyyy-MM-dd"))
  }

  const handleMonthChange = (month: string) => {
    const currentDate = selectedDate || new Date()
    const newDate = new Date(currentDate.getFullYear(), parseInt(month), currentDate.getDate())
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
  }, [value])

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full h-10 pl-3 pr-3 text-left font-normal bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10 justify-start",
            !selectedDate && "text-white/60",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {selectedDate ? (
            format(selectedDate, "yyyy-MM-dd", { locale: sv })
          ) : (
            <span>{placeholder}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 bg-primary backdrop-blur-sm border-primary/30" align="center">
        <div className="p-3 space-y-3">
          {/* Year and Month Selectors */}
          <div className="flex gap-2">
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="flex-1 h-10 bg-white/10 border-white/30 text-white hover:bg-white/20 justify-between"
                >
                  <span>
                    {selectedDate ? selectedDate.getFullYear() : "År"}
                  </span>
                  <ChevronDown className="h-4 w-4 flex-shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent 
                className="w-32 max-h-60 overflow-y-auto bg-slate-700/95 backdrop-blur-md border-slate-500/30 shadow-xl z-50 rounded-lg text-white"
                side="top"
                align="center"
                sideOffset={6}
                avoidCollisions={false}
              >
                {years.map((year) => (
                  <DropdownMenuItem 
                    key={year} 
                    onClick={() => handleYearChange(year.toString())} 
                    className="cursor-pointer hover:bg-slate-700/70 focus:bg-slate-700/70 py-2 text-white"
                  >
                    {year}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="flex-1 h-10 bg-white/10 border-white/30 text-white hover:bg-white/20 justify-between"
                >
                  <span>
                    {selectedDate ? months[selectedDate.getMonth()].label : "Månad"}
                  </span>
                  <ChevronDown className="h-4 w-4 flex-shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent 
                className="w-40 max-h-60 overflow-y-auto bg-slate-700/95 backdrop-blur-md border-slate-500/30 shadow-xl z-50 rounded-lg text-white"
                side="top"
                align="center"
                sideOffset={6}
                avoidCollisions={false}
              >
                {months.map((month) => (
                  <DropdownMenuItem 
                    key={month.value} 
                    onClick={() => handleMonthChange(month.value.toString())} 
                    className="cursor-pointer hover:bg-slate-700/70 focus:bg-slate-700/70 py-2 text-white"
                  >
                    {month.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Calendar for day selection */}
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleDateSelect}
            disabled={(date) =>
              date > new Date() || date < new Date("1900-01-01")
            }
            month={selectedDate}
            onMonthChange={setSelectedDate}
            initialFocus
            className="p-0 text-white [&_.rdp-caption]:text-white [&_.rdp-nav_button]:text-white [&_.rdp-nav_button]:border-white/20 [&_.rdp-nav_button]:hover:bg-white/20 [&_.rdp-day]:text-white [&_.rdp-day]:hover:bg-white/20 [&_.rdp-day_selected]:bg-primary [&_.rdp-day_selected]:text-primary-foreground [&_.rdp-day_today]:bg-white/20"
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}