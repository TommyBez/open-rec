"use client"

import * as React from "react"
import * as RechartsPrimitive from "recharts"

import { cn } from "@/lib/utils"
import { getPayloadConfigFromPayload, useChart } from "@/components/ui/chart-shared"
import { ChartTooltipItem } from "@/components/ui/chart-tooltip-item"

type TooltipContentProps = React.ComponentProps<typeof RechartsPrimitive.Tooltip> &
  React.ComponentProps<"div"> & {
    hideLabel?: boolean
    hideIndicator?: boolean
    indicator?: "line" | "dot" | "dashed"
    nameKey?: string
    labelKey?: string
  }

function buildTooltipLabel({
  hideLabel,
  payload,
  labelKey,
  label,
  config,
  labelClassName,
  labelFormatter,
}: Pick<
  TooltipContentProps,
  "hideLabel" | "payload" | "labelKey" | "label" | "labelClassName" | "labelFormatter"
> & { config: ReturnType<typeof useChart>["config"] }) {
  if (hideLabel || !payload?.length) {
    return null
  }

  const [item] = payload
  const key = `${labelKey || item?.dataKey || item?.name || "value"}`
  const itemConfig = getPayloadConfigFromPayload(config, item, key)
  const value =
    !labelKey && typeof label === "string"
      ? config[label as keyof typeof config]?.label || label
      : itemConfig?.label

  if (labelFormatter) {
    return (
      <div className={cn("font-medium", labelClassName)}>
        {labelFormatter(value, payload)}
      </div>
    )
  }

  if (!value) {
    return null
  }

  return <div className={cn("font-medium", labelClassName)}>{value}</div>
}

export function ChartTooltipContent({
  active,
  payload,
  className,
  indicator = "dot",
  hideLabel = false,
  hideIndicator = false,
  label,
  labelFormatter,
  labelClassName,
  formatter,
  color,
  nameKey,
  labelKey,
}: TooltipContentProps) {
  const { config } = useChart()
  const tooltipLabel = React.useMemo(
    () =>
      buildTooltipLabel({
        hideLabel,
        payload,
        labelKey,
        label,
        config,
        labelClassName,
        labelFormatter,
      }),
    [hideLabel, payload, labelKey, label, config, labelClassName, labelFormatter]
  )

  if (!active || !payload?.length) {
    return null
  }

  const nestLabel = payload.length === 1 && indicator !== "dot"

  return (
    <div
      className={cn(
        "border-border/50 bg-background grid min-w-[8rem] items-start gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl",
        className
      )}
    >
      {!nestLabel ? tooltipLabel : null}
      <div className="grid gap-1.5">
        {payload
          .filter((item) => item.type !== "none")
          .map((item, index) => (
            <ChartTooltipItem
              key={`${item.dataKey}-${index}`}
              item={item}
              index={index}
              indicator={indicator}
              hideIndicator={hideIndicator}
              nestLabel={nestLabel}
              color={color}
              nameKey={nameKey}
              formatter={formatter}
              tooltipLabel={tooltipLabel}
              config={config}
            />
          ))}
      </div>
    </div>
  )
}
