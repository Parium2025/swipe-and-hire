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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

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
      <PopoverContent
        className="w-[360px] p-0 bg-primary backdrop-blur-sm border-primary/30"
        side="bottom"
        align="center"
        sideOffset={8}
        avoidCollisions={false}
      >
        <div className="p-3 space-y-3">
          {/* Year and Month Selectors */}
          <div className="flex gap-2 relative z-50">
            <Select
              value={selectedDate ? selectedDate.getFullYear().toString() : undefined}
              onValueChange={handleYearChange}
            >
              <SelectTrigger className="flex-1 bg-white/10 border-white/30 text-white hover:bg-white/20">
                <SelectValue placeholder="År" />
              </SelectTrigger>
              <SelectContent className="z-[60] max-h-60 bg-primary backdrop-blur-sm border-primary/30 text-white" position="popper" sideOffset={4}>
                {years.map((year) => (
                  <SelectItem key={year} value={year.toString()} className="hover:bg-white/20 focus:bg-white/20">
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={selectedDate ? selectedDate.getMonth().toString() : undefined}
              onValueChange={handleMonthChange}
            >
              <SelectTrigger className="flex-1 bg-white/10 border-white/30 text-white hover:bg-white/20">
                <SelectValue placeholder="Månad" />
              </SelectTrigger>
              <SelectContent className="bg-primary backdrop-blur-sm border-primary/30 text-white" position="popper" sideOffset={4}>
                {months.map((month) => (
                  <SelectItem key={month.value} value={month.value.toString()} className="hover:bg-white/20 focus:bg-white/20">
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Calendar for day selection - Fixed container */}
          <div className="min-h-[280px]">
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
        </div>
      </PopoverContent>
    </Popover>
  )
}