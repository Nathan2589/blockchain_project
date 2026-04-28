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

type ContractInfo = {
  ticketPrice: bigint
  totalSupply: bigint
  maxSupply: bigint
}

export default function Buy() {
  const { state, connect } = useWalletConnection()
  const [info, setInfo] = useState<ContractInfo | null>(null)
  const [infoError, setInfoError] = useState<string | null>(null)
  const [quantity, setQuantity] = useState("1")
  const [tx, setTx] = useState<TxState>({ status: "idle" })
  const [busy, setBusy] = useState(false)

  async function loadInfo() {
    setInfoError(null)
    try {
      const contract = getReadContract()
      const [ticketPrice, totalSupply, maxSupply] = await Promise.all([
        contract.ticketPrice() as Promise<bigint>,
        contract.totalSupply() as Promise<bigint>,
        contract.maxSupply() as Promise<bigint>,
      ])
      setInfo({ ticketPrice, totalSupply, maxSupply })
    } catch (err) {
      const e = err as { shortMessage?: string; message?: string }
      setInfoError(
        err instanceof MissingRpcUrlError
          ? err.message
          : e.shortMessage || e.message || "Failed to load contract state.",
      )
    }
  }

  useEffect(() => {
    void loadInfo()
  }, [])

  // Refresh after a successful purchase to update the cap calculation.
  useEffect(() => {
    if (tx.status === "confirmed") void loadInfo()
  }, [tx.status])

  const qty = parseQuantity(quantity)
  const remaining = info ? info.maxSupply - info.totalSupply : 0n
  const cost = info && qty !== null ? qty * info.ticketPrice : 0n
  const qtyValid = qty !== null && qty > 0n && (info ? qty <= remaining : true)
  const ready = state.status === "connected" && isSepolia(state.connection.chainId)
  const canSubmit = ready && info !== null && qtyValid && !busy

  async function submit() {
    if (!canSubmit || state.status !== "connected" || !info) return
    setBusy(true)
    setTx({ status: "idle" })
    try {
      const contract = getWriteContract(state.connection.signer)
      const sent = await contract.purchaseTicket(qty, { value: cost })
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
          purchase <span className="text-muted-foreground">// pass</span>
        </h1>
        <p className="text-sm text-muted-foreground">
          Buy access passes by sending SETH to the contract. Requires MetaMask connected to Sepolia.
        </p>
      </header>

      <ConnectBar state={state} onConnect={connect} />

      {infoError ? (
        <div className="rounded-sm border border-destructive/40 bg-destructive/5 px-4 py-3 font-mono text-xs text-destructive">
          {infoError}
        </div>
      ) : null}

      {info ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <StatTile
            label="ticket price"
            value={`${formatEth(info.ticketPrice)} SETH`}
            caption={`${info.ticketPrice.toString()} wei`}
          />
          <StatTile
            label="passes available"
            value={remaining.toString()}
            caption={`${info.totalSupply.toString()} of ${info.maxSupply.toString()} minted`}
          />
        </div>
      ) : null}

      <Card>
        <CardContent className="space-y-5 pt-6">
          <div className="space-y-2">
            <Label htmlFor="buy-qty">quantity</Label>
            <Input
              id="buy-qty"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              inputMode="numeric"
              className="font-mono"
              disabled={busy}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit()
              }}
            />
            {qty === null || qty === 0n ? (
              <p className="font-mono text-xs text-muted-foreground">
                quantity must be a positive integer.
              </p>
            ) : info ? (
              <p className="font-mono text-xs text-muted-foreground">
                cost = {qty.toString()} × {formatEth(info.ticketPrice)} ={" "}
                <span className="text-foreground">{formatEth(cost)} SETH</span>
              </p>
            ) : null}
            {qty !== null && info && qty > remaining ? (
              <p className="font-mono text-xs text-destructive">
                exceeds available supply ({remaining.toString()} left).
              </p>
            ) : null}
          </div>

          <Button onClick={submit} disabled={!canSubmit} className="gap-2">
            {busy
              ? "Submitting…"
              : info && qty !== null && qty > 0n
                ? `Buy ${qty.toString()} pass${qty === 1n ? "" : "es"} for ${formatEth(cost)} SETH`
                : "Buy"}
          </Button>

          {!ready ? (
            <p className="font-mono text-xs text-muted-foreground">
              Connect MetaMask to Sepolia to enable purchase.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <TxStatus state={tx} />
    </section>
  )
}
