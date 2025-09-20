import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"

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
    option.toLowerCase().includes(searchValue.toLowerCase())
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
            "w-full justify-between bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10 hover:text-white",
            !value && "text-white/60",
            className
          )}
          disabled={disabled}
        >
          {value || placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0 bg-background/95 backdrop-blur-sm border-border z-50">
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
                  <span>{emptyMessage}</span>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => handleSelect(searchValue.trim())}
                    className="text-primary hover:text-primary/80"
                  >
                    Använd "{searchValue.trim()}"
                  </Button>
                </div>
              </CommandEmpty>
            ) : (
              <CommandEmpty>{emptyMessage}</CommandEmpty>
            )}
            <CommandGroup>
              {filteredOptions.map((option) => (
                <CommandItem
                  key={option}
                  value={option}
                  onSelect={() => handleSelect(option)}
                  className="cursor-pointer"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === option ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {option}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}