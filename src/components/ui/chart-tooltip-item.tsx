"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { getPayloadConfigFromPayload, type ChartConfig } from "@/components/ui/chart-shared"

type ChartTooltipItemProps = {
  item: any
  index: number
  indicator: "line" | "dot" | "dashed"
  hideIndicator: boolean
  nestLabel: boolean
  color?: string
  nameKey?: string
  formatter?: (
    value: any,
    name: any,
    item: any,
    index: number,
    payload: any
  ) => React.ReactNode
  tooltipLabel: React.ReactNode
  config: ChartConfig
}

export function ChartTooltipItem({
  item,
  index,
  indicator,
  hideIndicator,
  nestLabel,
  color,
  nameKey,
  formatter,
  tooltipLabel,
  config,
}: ChartTooltipItemProps) {
  const key = `${nameKey || item.name || item.dataKey || "value"}`
  const itemConfig = getPayloadConfigFromPayload(config, item, key)
  const indicatorColor = color || item.payload.fill || item.color

  return (
    <div
      key={item.dataKey}
      className={cn(
        "[&>svg]:text-muted-foreground flex w-full flex-wrap items-stretch gap-2 [&>svg]:h-2.5 [&>svg]:w-2.5",
        indicator === "dot" && "items-center"
      )}
    >
      {formatter && item?.value !== undefined && item.name ? (
        formatter(item.value, item.name, item, index, item.payload)
      ) : (
        <>
          {itemConfig?.icon ? (
            <itemConfig.icon />
          ) : (
            !hideIndicator && (
              <div
                className={cn(
                  "shrink-0 rounded-[2px] border-(--color-border) bg-(--color-bg)",
                  {
                    "h-2.5 w-2.5": indicator === "dot",
                    "w-1": indicator === "line",
                    "w-0 border-[1.5px] border-dashed bg-transparent":
                      indicator === "dashed",
                    "my-0.5": nestLabel && indicator === "dashed",
                  }
                )}
                style={
                  {
                    "--color-bg": indicatorColor,
                    "--color-border": indicatorColor,
                  } as React.CSSProperties
                }
              />
            )
          )}
          <div
            className={cn(
              "flex flex-1 justify-between leading-none",
              nestLabel ? "items-end" : "items-center"
            )}
          >
            <div className="grid gap-1.5">
              {nestLabel ? tooltipLabel : null}
              <span className="text-muted-foreground">
                {itemConfig?.label || item.name}
              </span>
            </div>
            {item.value && (
              <span className="text-foreground font-mono font-medium tabular-nums">
                {item.value.toLocaleString()}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  )
}
