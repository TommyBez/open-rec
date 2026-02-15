"use client"

import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react"
import { type DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"
import { CalendarDayButton } from "@/components/ui/calendar-day-button"

function buildCalendarComponents(
  components: React.ComponentProps<typeof DayPicker>["components"]
): React.ComponentProps<typeof DayPicker>["components"] {
  return {
    Root: ({ className, rootRef, ...props }) => (
      <div
        data-slot="calendar"
        ref={rootRef}
        className={cn(className)}
        {...props}
      />
    ),
    Chevron: ({ className, orientation, ...props }) => {
      if (orientation === "left") {
        return <ChevronLeftIcon className={cn("size-4", className)} {...props} />
      }
      if (orientation === "right") {
        return <ChevronRightIcon className={cn("size-4", className)} {...props} />
      }
      return <ChevronDownIcon className={cn("size-4", className)} {...props} />
    },
    DayButton: CalendarDayButton,
    WeekNumber: ({ children, ...props }) => (
      <td {...props}>
        <div className="flex size-(--cell-size) items-center justify-center text-center">
          {children}
        </div>
      </td>
    ),
    ...components,
  }
}

export { buildCalendarComponents }
