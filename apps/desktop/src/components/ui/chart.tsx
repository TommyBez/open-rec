"use client"

import * as RechartsPrimitive from "recharts"

import { ChartContainer } from "@/components/ui/chart-container"
import { ChartLegendContent } from "@/components/ui/chart-legend-content"
import { ChartStyle, type ChartConfig } from "@/components/ui/chart-shared"
import { ChartTooltipContent } from "@/components/ui/chart-tooltip-content"

const ChartTooltip = RechartsPrimitive.Tooltip
const ChartLegend = RechartsPrimitive.Legend

export {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartStyle,
  ChartTooltip,
  ChartTooltipContent,
}
export type { ChartConfig }
