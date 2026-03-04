"use client"

import { DayPicker, getDefaultClassNames } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { buildCalendarClassNames } from "@/components/ui/calendar-classnames"
import { buildCalendarComponents } from "@/components/ui/calendar-components"
import { CalendarDayButton } from "@/components/ui/calendar-day-button"

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = "label",
  buttonVariant = "ghost",
  formatters,
  components,
  ...props
}: React.ComponentProps<typeof DayPicker> & {
  buttonVariant?: React.ComponentProps<typeof Button>["variant"]
}) {
  const defaultClassNames = getDefaultClassNames()

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn(
        "bg-background group/calendar p-3 [--cell-size:--spacing(8)] [[data-slot=card-content]_&]:bg-transparent [[data-slot=popover-content]_&]:bg-transparent",
        String.raw`rtl:**:[.rdp-button\_next>svg]:rotate-180`,
        String.raw`rtl:**:[.rdp-button\_previous>svg]:rotate-180`,
        className
      )}
      captionLayout={captionLayout}
      formatters={{
        formatMonthDropdown: (date) =>
          date.toLocaleString("default", { month: "short" }),
        ...formatters,
      }}
      classNames={buildCalendarClassNames({
        defaultClassNames,
        classNames,
        buttonVariant,
        captionLayout,
        showWeekNumber: props.showWeekNumber,
      })}
      components={buildCalendarComponents(components)}
      {...props}
    />
  )
}

export { Calendar, CalendarDayButton }
