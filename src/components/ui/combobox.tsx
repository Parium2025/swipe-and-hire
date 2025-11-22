import * as React from "react"
import { Check, ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface ComboboxProps {
  options: string[]
  value?: string
  onSelect: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  className?: string
  disabled?: boolean
  allowCustomValue?: boolean
}

export function Combobox({
  options,
  value,
  onSelect,
  placeholder = "Välj alternativ...",
  searchPlaceholder = "Sök...",
  emptyMessage = "Inga resultat hittades.",
  className,
  disabled = false,
  allowCustomValue = false
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [searchValue, setSearchValue] = React.useState("")

  const filteredOptions = options.filter(option =>
    searchValue.length < 3 ? options : option.toLowerCase().includes(searchValue.toLowerCase())
  )

  const handleSelect = (selectedValue: string) => {
    onSelect(selectedValue)
    setOpen(false)
    setSearchValue("")
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && allowCustomValue && searchValue.trim()) {
      e.preventDefault()
      handleSelect(searchValue.trim())
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-0 focus:border-white/40 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
            "bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10 hover:text-white hover:border-white/30",
            !value && "text-white/60",
            className
          )}
          disabled={disabled}
        >
          <span className="flex-1 text-left truncate">{value || placeholder}</span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-full p-0 bg-popover text-popover-foreground shadow-md border rounded-md z-50" 
        side="bottom"
        align="start"
        sideOffset={4}
        avoidCollisions={false}
      >
        <Command>
          <CommandInput 
            placeholder={searchPlaceholder}
            value={searchValue}
            onValueChange={setSearchValue}
            onKeyDown={handleKeyDown}
            className="border-none"
          />
          <CommandList className="max-h-[200px]">
            {filteredOptions.length === 0 && allowCustomValue && searchValue.trim() ? (
              <CommandEmpty>
                <div className="flex flex-col items-center gap-2 p-2">
                  <span className="text-white">{emptyMessage}</span>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => handleSelect(searchValue.trim())}
                    className="text-white hover:text-white/80"
                  >
                    Använd "{searchValue.trim()}"
                  </Button>
                </div>
              </CommandEmpty>
            ) : (
              <CommandEmpty className="text-white">{emptyMessage}</CommandEmpty>
            )}
            <CommandGroup>
              {filteredOptions.map((option) => (
                <CommandItem
                  key={option}
                  value={option}
                  onSelect={() => handleSelect(option)}
                  className="relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-8 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                >
                  <Check
                    className={cn(
                      "absolute left-2 h-4 w-4",
                      value === option ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="flex-1">{option}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}