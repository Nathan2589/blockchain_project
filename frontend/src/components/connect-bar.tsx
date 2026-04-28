import { useState } from "react"

import { AddressChip } from "@/components/address-chip"
import { Button } from "@/components/ui/button"
import { type WalletState } from "@/hooks/use-wallet-connection"
import { CHAIN_ID } from "@/lib/contract"
import { isSepolia, switchToSepolia } from "@/lib/wallet"

type Props = {
  state: WalletState
  onConnect: () => void
}

export function ConnectBar({ state, onConnect }: Props) {
  const [switching, setSwitching] = useState(false)

  if (state.status === "no-wallet") {
    return (
      <div className="rounded-sm border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm dark:border-amber-900 dark:bg-amber-950/30">
        No injected wallet detected. Install MetaMask to use this page.
      </div>
    )
  }

  if (state.status === "connecting") {
    return (
      <div className="rounded-sm border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        Connecting to wallet…
      </div>
    )
  }

  if (state.status === "error") {
    return (
      <div className="flex items-center justify-between gap-4 rounded-sm border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm">
        <span className="font-mono text-destructive">{state.error.message}</span>
        <Button size="sm" variant="outline" onClick={onConnect}>
          Retry
        </Button>
      </div>
    )
  }

  if (state.status === "disconnected") {
    return (
      <div className="flex items-center justify-between gap-4 rounded-sm border bg-card px-4 py-3 text-sm">
        <span className="text-muted-foreground">MetaMask not connected.</span>
        <Button size="sm" onClick={onConnect}>
          Connect MetaMask
        </Button>
      </div>
    )
  }

  // status === "connected"
  const { connection } = state

  if (!isSepolia(connection.chainId)) {
    return (
      <div className="flex items-center justify-between gap-4 rounded-sm border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm dark:border-amber-900 dark:bg-amber-950/30">
        <span>
          Wrong network: chain <span className="font-mono">{connection.chainId}</span>. This dApp targets
          Sepolia <span className="font-mono">({CHAIN_ID})</span>.
        </span>
        <Button
          size="sm"
          variant="outline"
          disabled={switching}
          onClick={async () => {
            setSwitching(true)
            try {
              await switchToSepolia()
            } finally {
              setSwitching(false)
            }
          }}
        >
          {switching ? "Switching…" : "Switch to Sepolia"}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-sm border bg-card px-4 py-3 text-sm">
      <span className="text-muted-foreground">Connected to Sepolia</span>
      <AddressChip address={connection.address} />
    </div>
  )
}
