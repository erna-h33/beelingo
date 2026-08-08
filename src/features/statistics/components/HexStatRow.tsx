import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

export interface HexStat {
  icon: LucideIcon
  label: string
  value: number | string
}

interface HexStatRowProps {
  stats: HexStat[]
}

// Pointy-top hexagon: point at top/bottom, flat vertical edges left/right.
// Height/width ratio of a regular hexagon in this orientation is 2/√3.
const HEX_WIDTH = 84
const HEX_HEIGHT = Math.round(HEX_WIDTH * (2 / Math.sqrt(3)))
const HEX_CLIP = "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)"

/**
 * A row of stat tiles shaped like honeycomb cells -- the Hive's visual
 * signature, echoed here on the student's own numbers instead of the
 * plain rectangular StatCard (which stays as-is for the teacher/
 * per-class dashboards). Cells overlap slightly and alternate a
 * vertical offset so the row reads as one connected comb rather than a
 * strip of separate hexagon tiles.
 */
export function HexStatRow({ stats }: HexStatRowProps) {
  return (
    <div
      className="flex justify-center"
      style={{ paddingTop: HEX_HEIGHT / 4, paddingBottom: HEX_HEIGHT / 4 }}
    >
      {stats.map((stat, i) => (
        <div
          key={stat.label}
          className="shrink-0"
          style={{
            width: HEX_WIDTH,
            height: HEX_HEIGHT,
            marginLeft: i === 0 ? 0 : -HEX_WIDTH / 4,
            transform: i % 2 === 1 ? `translateY(${HEX_HEIGHT / 2}px)` : undefined,
            zIndex: i % 2 === 1 ? 1 : 2,
          }}
        >
          <div
            className="flex size-full flex-col items-center justify-center gap-0.5 border-2 border-primary/30 bg-primary/10 px-1.5 text-center"
            style={{ clipPath: HEX_CLIP }}
          >
            <stat.icon className="size-4 text-primary" />
            <span className="text-base leading-none font-bold tabular-nums">{stat.value}</span>
            <span className="text-[9px] leading-tight font-medium text-muted-foreground">{stat.label}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

/** Loading placeholder, hexagon-clipped to match -- avoids a jarring
 * shape swap once the real data lands. */
export function HexStatRowSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div
      className="flex justify-center"
      style={{ paddingTop: HEX_HEIGHT / 4, paddingBottom: HEX_HEIGHT / 4 }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="shrink-0"
          style={{
            width: HEX_WIDTH,
            height: HEX_HEIGHT,
            marginLeft: i === 0 ? 0 : -HEX_WIDTH / 4,
            transform: i % 2 === 1 ? `translateY(${HEX_HEIGHT / 2}px)` : undefined,
            zIndex: i % 2 === 1 ? 1 : 2,
          }}
        >
          <div
            className={cn("size-full animate-pulse bg-muted")}
            style={{ clipPath: HEX_CLIP }}
          />
        </div>
      ))}
    </div>
  )
}
