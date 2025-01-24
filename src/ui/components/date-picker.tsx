/**
 * date-picker.tsx
 * Date picker component with range selection support.
 */
"use client"

import { format } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"
import type { SelectRangeEventHandler, DateRange } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button } from "@/ui/components/button"
import { Calendar } from "@/ui/components/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/ui/components/popover"

interface DatePickerWithRangeProps {
  value?: DateRange
  onChange?: SelectRangeEventHandler
  className?: string
}

export function DatePickerWithRange({
  value,
  onChange,
  className,
}: DatePickerWithRangeProps) {
  return (
    <div className={cn("grid gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "w-[300px] justify-start text-left font-normal",
              !value?.from && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {value?.from ? (
              value.to ? (
                <>
                  {format(value.from, "LLL dd, y")} -{" "}
                  {format(value.to, "LLL dd, y")}
                </>
              ) : (
                format(value.from, "LLL dd, y")
              )
            ) : (
              <span>Pick a date range</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            defaultMonth={value?.from}
            selected={value}
            onSelect={onChange}
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
} 