import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

type Props = {
  label: string
  value: ReactNode
  caption?: ReactNode
  className?: string
}

export function StatTile({ label, value, caption, className }: Props) {
  return (
    <div className={cn("rounded-sm border bg-card p-5", className)}>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-2 font-mono text-2xl font-medium tracking-tight tabular-nums">{value}</div>
      {caption ? (
        <div className="mt-1 font-mono text-xs tabular-nums text-muted-foreground">{caption}</div>
      ) : null}
    </div>
  )
}
