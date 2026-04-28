import { useEffect, useState } from "react"

import { ConnectBar } from "@/components/connect-bar"
import { StatTile } from "@/components/stat-tile"
import { TxStatus, type TxState } from "@/components/tx-status"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useWalletConnection } from "@/hooks/use-wallet-connection"
import { MissingRpcUrlError, getReadContract, getWriteContract } from "@/lib/contract"
import { decodeRevertReason, formatEth, parseQuantity } from "@/lib/format"
import { isSepolia } from "@/lib/wallet"

type Loaded = {
  ticketPrice: bigint
  balance: bigint
}

export default function Return() {
  const { state, connect } = useWalletConnection()
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [quantity, setQuantity] = useState("1")
  const [tx, setTx] = useState<TxState>({ status: "idle" })
  const [busy, setBusy] = useState(false)

  const connectedAddress = state.status === "connected" ? state.connection.address : null

  async function load() {
    setLoadError(null)
    try {
      const contract = getReadContract()
      const promises: [Promise<bigint>, Promise<bigint> | null] = [
        contract.ticketPrice() as Promise<bigint>,
        connectedAddress ? (contract.balanceOf(connectedAddress) as Promise<bigint>) : null,
      ]
      const [ticketPrice, balance] = await Promise.all([
        promises[0],
        promises[1] ?? Promise.resolve(0n),
      ])
      setLoaded({ ticketPrice, balance })
    } catch (err) {
      const e = err as { shortMessage?: string; message?: string }
      setLoadError(
        err instanceof MissingRpcUrlError
          ? err.message
          : e.shortMessage || e.message || "Failed to load contract state.",
      )
    }
  }

  useEffect(() => {
    void load()
  }, [connectedAddress])

  useEffect(() => {
    if (tx.status === "confirmed") void load()
  }, [tx.status])

  const qty = parseQuantity(quantity)
  const refund = loaded && qty !== null ? qty * loaded.ticketPrice : 0n
  const qtyValid =
    qty !== null && qty > 0n && (loaded ? qty <= loaded.balance : true)
  const ready = state.status === "connected" && isSepolia(state.connection.chainId)
  const canSubmit = ready && loaded !== null && qtyValid && loaded.balance > 0n && !busy

  async function submit() {
    if (!canSubmit || state.status !== "connected" || !loaded) return
    setBusy(true)
    setTx({ status: "idle" })
    try {
      const contract = getWriteContract(state.connection.signer)
      const sent = await contract.returnTicket(qty)
      setTx({ status: "pending", hash: sent.hash })
      const receipt = await sent.wait()
      setTx({
        status: "confirmed",
        hash: sent.hash,
        blockNumber: receipt?.blockNumber,
      })
    } catch (err) {
      setTx({ status: "failed", reason: decodeRevertReason(err) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-medium tracking-tight">
          return <span className="text-muted-foreground">// pass</span>
        </h1>
        <p className="text-sm text-muted-foreground">
          Burn passes back into the contract for a full SETH refund.
        </p>
      </header>

      <ConnectBar state={state} onConnect={connect} />

      {loadError ? (
        <div className="rounded-sm border border-destructive/40 bg-destructive/5 px-4 py-3 font-mono text-xs text-destructive">
          {loadError}
        </div>
      ) : null}

      {loaded && connectedAddress ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <StatTile
            label="your balance"
            value={loaded.balance.toString()}
            caption={loaded.balance === 1n ? "1 pass held" : `${loaded.balance.toString()} passes held`}
          />
          <StatTile
            label="refund per pass"
            value={`${formatEth(loaded.ticketPrice)} SETH`}
            caption={`${loaded.ticketPrice.toString()} wei`}
          />
        </div>
      ) : null}

      <Card>
        <CardContent className="space-y-5 pt-6">
          <div className="space-y-2">
            <Label htmlFor="ret-qty">quantity</Label>
            <Input
              id="ret-qty"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              inputMode="numeric"
              className="font-mono"
              disabled={busy}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit()
              }}
            />
            {qty !== null && loaded ? (
              <p className="font-mono text-xs text-muted-foreground">
                refund = {qty.toString()} × {formatEth(loaded.ticketPrice)} ={" "}
                <span className="text-foreground">{formatEth(refund)} SETH</span>
              </p>
            ) : (
              <p className="font-mono text-xs text-muted-foreground">
                quantity must be a positive integer.
              </p>
            )}
            {qty !== null && loaded && qty > loaded.balance ? (
              <p className="font-mono text-xs text-destructive">
                exceeds your balance ({loaded.balance.toString()} held).
              </p>
            ) : null}
          </div>

          <Button onClick={submit} disabled={!canSubmit} className="gap-2">
            {busy
              ? "Submitting…"
              : loaded && qty !== null && qty > 0n
                ? `Return ${qty.toString()} pass${qty === 1n ? "" : "es"} for ${formatEth(refund)} SETH`
                : "Return"}
          </Button>

          {!ready ? (
            <p className="font-mono text-xs text-muted-foreground">
              Connect MetaMask to Sepolia to enable returns.
            </p>
          ) : ready && loaded && loaded.balance === 0n ? (
            <p className="font-mono text-xs text-muted-foreground">
              connected wallet holds no passes.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <TxStatus state={tx} />
    </section>
  )
}
