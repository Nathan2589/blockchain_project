import { Check, RefreshCw, X } from "lucide-react"
import { useEffect, useState } from "react"

import { StatTile } from "@/components/stat-tile"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  CHAIN_ID,
  CONTRACT_ADDRESS,
  MissingRpcUrlError,
  getReadContract,
  getReadProvider,
} from "@/lib/contract"
import { formatEth, isValidAddress, truncateAddress } from "@/lib/format"
import { cn } from "@/lib/utils"

export default function Balance() {
  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-medium tracking-tight">
          balance <span className="text-muted-foreground">// verify</span>
        </h1>
        <p className="text-sm text-muted-foreground">
          Three role-distinct query paths against chain {CHAIN_ID}. No wallet connection required.
        </p>
      </header>

      <Tabs defaultValue="agent" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="agent">agent</TabsTrigger>
          <TabsTrigger value="doorman">doorman</TabsTrigger>
          <TabsTrigger value="venue">venue</TabsTrigger>
        </TabsList>

        <TabsContent value="agent" className="space-y-4">
          <AgentPane />
        </TabsContent>
        <TabsContent value="doorman" className="space-y-4">
          <DoormanPane />
        </TabsContent>
        <TabsContent value="venue" className="space-y-4">
          <VenuePane />
        </TabsContent>
      </Tabs>
    </section>
  )
}

// ---------------- Agent ----------------

function AgentPane() {
  const [address, setAddress] = useState("")
  const [connected, setConnected] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ seth: bigint; aap: bigint } | null>(null)

  useEffect(() => {
    const inj = window.ethereum
    if (!inj) return
    inj
      .request({ method: "eth_accounts" })
      .then((accs) => {
        if (Array.isArray(accs) && accs.length > 0) setConnected(accs[0] as string)
      })
      .catch(() => {})
  }, [])

  async function check() {
    setError(null)
    setResult(null)
    if (!isValidAddress(address)) {
      setError("Not a valid address.")
      return
    }
    setBusy(true)
    try {
      const provider = getReadProvider()
      const contract = getReadContract()
      const [seth, aap] = await Promise.all([
        provider.getBalance(address),
        contract.balanceOf(address) as Promise<bigint>,
      ])
      setResult({ seth, aap })
    } catch (err) {
      setError(formatRpcError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardContent className="space-y-5 pt-6">
        <p className="text-sm text-muted-foreground">
          Read the SETH and pass balance for any wallet on Sepolia.
        </p>

        <div className="space-y-2">
          <Label htmlFor="agent-addr">address</Label>
          <div className="flex gap-2">
            <Input
              id="agent-addr"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="0x…"
              className="font-mono"
              onKeyDown={(e) => {
                if (e.key === "Enter") check()
              }}
            />
            {connected ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddress(connected)}
                className="shrink-0 gap-2"
              >
                Use connected ({truncateAddress(connected, 6, 4)})
              </Button>
            ) : null}
          </div>
        </div>

        <Button onClick={check} disabled={busy}>
          {busy ? "Reading…" : "Check balances"}
        </Button>

        {error ? <ErrorRow message={error} /> : null}

        {result ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <StatTile label="seth balance" value={`${formatEth(result.seth)} SETH`} />
            <StatTile
              label="pass balance"
              value={result.aap.toString()}
              caption={result.aap === 1n ? "1 pass held" : `${result.aap.toString()} passes held`}
            />
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

// ---------------- Doorman ----------------

function DoormanPane() {
  const [address, setAddress] = useState("")
  const [minQty, setMinQty] = useState("1")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ verified: boolean; balance: bigint; min: bigint } | null>(null)

  async function verify() {
    setError(null)
    setResult(null)
    if (!isValidAddress(address)) {
      setError("Not a valid address.")
      return
    }
    let min: bigint
    try {
      min = BigInt(minQty)
      if (min < 0n) throw new Error("Negative")
    } catch {
      setError("min quantity must be a non-negative integer.")
      return
    }
    setBusy(true)
    try {
      const contract = getReadContract()
      const [verified, balance] = await Promise.all([
        contract.verifyHolder(address, min) as Promise<boolean>,
        contract.balanceOf(address) as Promise<bigint>,
      ])
      setResult({ verified, balance, min })
    } catch (err) {
      setError(formatRpcError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardContent className="space-y-5 pt-6">
        <p className="text-sm text-muted-foreground">
          Binary verification: does this wallet hold at least the specified number of passes?
        </p>

        <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
          <div className="space-y-2">
            <Label htmlFor="door-addr">wallet</Label>
            <Input
              id="door-addr"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="0x…"
              className="font-mono"
              onKeyDown={(e) => {
                if (e.key === "Enter") verify()
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="door-min">min</Label>
            <Input
              id="door-min"
              value={minQty}
              onChange={(e) => setMinQty(e.target.value)}
              inputMode="numeric"
              className="font-mono"
              onKeyDown={(e) => {
                if (e.key === "Enter") verify()
              }}
            />
          </div>
        </div>

        <Button onClick={verify} disabled={busy}>
          {busy ? "Verifying…" : "Verify holder"}
        </Button>

        {error ? <ErrorRow message={error} /> : null}

        {result ? (
          <div
            className={cn(
              "rounded-sm border px-5 py-4",
              result.verified
                ? "border-primary/40 bg-primary/5"
                : "border-destructive/40 bg-destructive/5",
            )}
          >
            <div className="flex items-center gap-3">
              {result.verified ? (
                <Check className="h-5 w-5 text-primary" />
              ) : (
                <X className="h-5 w-5 text-destructive" />
              )}
              <span
                className={cn(
                  "font-mono text-lg font-medium",
                  result.verified ? "text-primary" : "text-destructive",
                )}
              >
                {result.verified ? "verified" : "not verified"}
              </span>
            </div>
            <div className="mt-2 font-mono text-xs text-muted-foreground">
              wallet holds {result.balance.toString()} pass{result.balance === 1n ? "" : "es"} · required {result.min.toString()}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

// ---------------- Venue ----------------

type VenueData = {
  totalSupply: bigint
  maxSupply: bigint
  ticketPrice: bigint
  contractBalance: bigint
  reserved: bigint
  free: bigint
}

function VenuePane() {
  const [data, setData] = useState<VenueData | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setError(null)
    setBusy(true)
    try {
      const provider = getReadProvider()
      const contract = getReadContract()
      const [totalSupply, maxSupply, ticketPrice, contractBalance] = await Promise.all([
        contract.totalSupply() as Promise<bigint>,
        contract.maxSupply() as Promise<bigint>,
        contract.ticketPrice() as Promise<bigint>,
        provider.getBalance(CONTRACT_ADDRESS),
      ])
      const reserved = totalSupply * ticketPrice
      const free = contractBalance - reserved
      setData({ totalSupply, maxSupply, ticketPrice, contractBalance, reserved, free })
    } catch (err) {
      setError(formatRpcError(err))
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Distribution stats for the deployed contract.{" "}
          <code className="font-mono text-xs">{truncateAddress(CONTRACT_ADDRESS)}</code>
        </p>
        <Button size="sm" variant="outline" onClick={load} disabled={busy} className="gap-2 shrink-0">
          <RefreshCw className={cn("h-3.5 w-3.5", busy && "animate-spin")} />
          {busy ? "Loading" : "Refresh"}
        </Button>
      </div>

      {error ? <ErrorRow message={error} /> : null}

      {data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatTile
            label="total supply"
            value={data.totalSupply.toString()}
            caption={`of ${data.maxSupply.toString()} max`}
          />
          <StatTile
            label="ticket price"
            value={`${formatEth(data.ticketPrice)} SETH`}
            caption={`${data.ticketPrice.toString()} wei`}
          />
          <StatTile
            label="contract balance"
            value={`${formatEth(data.contractBalance)} SETH`}
            caption={`${data.contractBalance.toString()} wei`}
          />
          <StatTile
            label="reserved"
            value={`${formatEth(data.reserved)} SETH`}
            caption="must remain to honour returns"
          />
          <StatTile
            label="free balance"
            value={`${formatEth(data.free)} SETH`}
            caption="venue may withdraw"
          />
          <StatTile
            label="capacity"
            value={`${data.maxSupply - data.totalSupply} left`}
            caption="passes still available"
          />
        </div>
      ) : busy ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : null}
    </div>
  )
}

// ---------------- Helpers ----------------

function ErrorRow({ message }: { message: string }) {
  return (
    <div className="rounded-sm border border-destructive/40 bg-destructive/5 px-4 py-3 font-mono text-xs text-destructive">
      {message}
    </div>
  )
}

function formatRpcError(err: unknown): string {
  if (err instanceof MissingRpcUrlError) return err.message
  const e = err as { shortMessage?: string; message?: string }
  return e.shortMessage || e.message || "RPC call failed."
}
