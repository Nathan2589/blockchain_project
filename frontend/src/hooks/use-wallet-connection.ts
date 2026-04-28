import { useCallback, useEffect, useRef, useState } from "react"

import {
  type Connection,
  connect as connectInjected,
  hasInjected,
  watchAccount,
  watchChain,
} from "@/lib/wallet"

export type WalletState =
  | { status: "no-wallet" }
  | { status: "disconnected" }
  | { status: "connecting" }
  | { status: "connected"; connection: Connection }
  | { status: "error"; error: Error }

export function useWalletConnection() {
  const [state, setState] = useState<WalletState>(() =>
    hasInjected() ? { status: "disconnected" } : { status: "no-wallet" },
  )

  // Keep latest connect handler stable across re-renders for watcher closures.
  const refresh = useRef<() => Promise<void>>(async () => {})

  const connect = useCallback(async () => {
    setState({ status: "connecting" })
    try {
      const connection = await connectInjected()
      setState({ status: "connected", connection })
    } catch (err) {
      setState({ status: "error", error: err as Error })
    }
  }, [])

  refresh.current = connect

  useEffect(() => {
    if (state.status !== "connected") return

    const offAccount = watchAccount((accounts) => {
      if (!accounts.length) {
        setState({ status: "disconnected" })
      } else {
        void refresh.current()
      }
    })
    const offChain = watchChain(() => {
      void refresh.current()
    })

    return () => {
      offAccount()
      offChain()
    }
  }, [state.status])

  return { state, connect }
}
