import { AnimatePresence, motion } from "framer-motion"
import { Check, Loader2, X } from "lucide-react"

import { txUrl } from "@/lib/contract"
import { cn } from "@/lib/utils"

export type TxState =
  | { status: "idle" }
  | { status: "pending"; hash: string }
  | { status: "confirmed"; hash: string; blockNumber?: number }
  | { status: "failed"; reason: string; hash?: string }

export function TxStatus({ state }: { state: TxState }) {
  return (
    <AnimatePresence mode="wait">
      {state.status !== "idle" && (
        <motion.div
          key={state.status}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.18 }}
          className={cn(
            "rounded-sm border px-4 py-3 text-sm",
            state.status === "pending" && "border-border bg-card",
            state.status === "confirmed" && "border-primary/40 bg-primary/5",
            state.status === "failed" && "border-destructive/40 bg-destructive/5",
          )}
        >
          {state.status === "pending" && (
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Waiting for confirmation…</span>
              </div>
              <TxLink hash={state.hash} />
            </div>
          )}
          {state.status === "confirmed" && (
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-primary">
                <Check className="h-4 w-4" />
                <span>
                  Confirmed
                  {state.blockNumber !== undefined ? (
                    <span className="text-muted-foreground"> · block {state.blockNumber}</span>
                  ) : null}
                </span>
              </div>
              <TxLink hash={state.hash} />
            </div>
          )}
          {state.status === "failed" && (
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-destructive">
                <X className="h-4 w-4" />
                <span className="font-mono">{state.reason}</span>
              </div>
              {state.hash ? <TxLink hash={state.hash} /> : null}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function TxLink({ hash }: { hash: string }) {
  return (
    <a
      href={txUrl(hash)}
      target="_blank"
      rel="noreferrer"
      className="font-mono text-xs underline-offset-4 hover:underline"
    >
      {hash.slice(0, 10)}…
    </a>
  )
}
