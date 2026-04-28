import { type HDNodeWallet, Wallet } from "ethers"
import { Download, Eye, EyeOff, KeyRound, RefreshCw } from "lucide-react"
import { useState } from "react"

import { AddressChip } from "@/components/address-chip"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type Generated = {
  address: string
  privateKey: string
  mnemonic?: string
  wallet: HDNodeWallet
}

export default function Create() {
  const [generated, setGenerated] = useState<Generated | null>(null)
  const [showKey, setShowKey] = useState(false)
  const [showMnemonic, setShowMnemonic] = useState(false)
  const [downloadOpen, setDownloadOpen] = useState(false)

  function generate() {
    const w = Wallet.createRandom()
    setGenerated({
      address: w.address,
      privateKey: w.privateKey,
      mnemonic: w.mnemonic?.phrase,
      wallet: w,
    })
    setShowKey(false)
    setShowMnemonic(false)
  }

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-medium tracking-tight">
          wallet <span className="text-muted-foreground">// create</span>
        </h1>
        <p className="text-sm text-muted-foreground">
          Generate a fresh keypair locally. Download the encrypted keystore and import it into MetaMask
          before using it on /buy or /return.
        </p>
      </header>

      {!generated ? <EmptyState onGenerate={generate} /> : null}

      {generated ? (
        <GeneratedState
          wallet={generated}
          showKey={showKey}
          onToggleKey={() => setShowKey((s) => !s)}
          showMnemonic={showMnemonic}
          onToggleMnemonic={() => setShowMnemonic((s) => !s)}
          onRegenerate={generate}
          onDownload={() => setDownloadOpen(true)}
        />
      ) : null}

      {generated ? (
        <DownloadDialog
          open={downloadOpen}
          onOpenChange={setDownloadOpen}
          wallet={generated.wallet}
          address={generated.address}
        />
      ) : null}
    </section>
  )
}

function EmptyState({ onGenerate }: { onGenerate: () => void }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
        <KeyRound className="h-8 w-8 text-muted-foreground" />
        <div className="space-y-1">
          <p className="font-mono text-sm">no wallet yet</p>
          <p className="text-xs text-muted-foreground">
            keys are generated and held in this tab only · refresh wipes them
          </p>
        </div>
        <Button onClick={onGenerate} className="mt-2">
          Generate new
        </Button>
      </CardContent>
    </Card>
  )
}

type GeneratedStateProps = {
  wallet: Generated
  showKey: boolean
  onToggleKey: () => void
  showMnemonic: boolean
  onToggleMnemonic: () => void
  onRegenerate: () => void
  onDownload: () => void
}

function GeneratedState({
  wallet,
  showKey,
  onToggleKey,
  showMnemonic,
  onToggleMnemonic,
  onRegenerate,
  onDownload,
}: GeneratedStateProps) {
  return (
    <Card>
      <CardContent className="space-y-5 pt-6">
        <Row label="address">
          <AddressChip address={wallet.address} full />
        </Row>

        <Row label="private_key">
          <div className="flex items-center gap-2">
            <code className="rounded-sm border bg-muted/30 px-2 py-1 font-mono text-xs break-all">
              {showKey ? wallet.privateKey : maskKey(wallet.privateKey)}
            </code>
            <Button
              size="icon"
              variant="ghost"
              onClick={onToggleKey}
              aria-label={showKey ? "hide private key" : "reveal private key"}
              className="h-8 w-8"
            >
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </Row>

        {wallet.mnemonic ? (
          <Row label="mnemonic">
            <div className="flex items-start gap-2">
              <code className="rounded-sm border bg-muted/30 px-2 py-1 font-mono text-xs leading-relaxed">
                {showMnemonic ? wallet.mnemonic : "······ ······ ······ ······ ······ ······ ······ ······ ······ ······ ······ ······"}
              </code>
              <Button
                size="icon"
                variant="ghost"
                onClick={onToggleMnemonic}
                aria-label={showMnemonic ? "hide mnemonic" : "reveal mnemonic"}
                className="h-8 w-8 shrink-0"
              >
                {showMnemonic ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </Row>
        ) : null}

        <Row label="status">
          <span className="inline-flex items-center gap-2 font-mono text-xs">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
            unlocked · in-memory only
          </span>
        </Row>

        <div className="flex flex-wrap gap-2 pt-2">
          <Button onClick={onDownload} className="gap-2">
            <Download className="h-4 w-4" />
            Download keystore
          </Button>
          <Button onClick={onRegenerate} variant="outline" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Generate new
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] items-start gap-4">
      <span className="pt-1.5 font-mono text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

function maskKey(key: string): string {
  if (key.length < 12) return "•".repeat(key.length)
  return `${key.slice(0, 4)}${"•".repeat(key.length - 4)}`
}

type DownloadDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  wallet: HDNodeWallet
  address: string
}

function DownloadDialog({ open, onOpenChange, wallet, address }: DownloadDialogProps) {
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setPassword("")
    setConfirm("")
    setError(null)
    setBusy(false)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError("Password must be at least 8 characters.")
      return
    }
    if (password !== confirm) {
      setError("Passwords do not match.")
      return
    }
    setBusy(true)
    try {
      const json = await wallet.encrypt(password)
      const blob = new Blob([json], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `aap-wallet-${address.slice(2, 10).toLowerCase()}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      onOpenChange(false)
      reset()
    } catch (err) {
      setError((err as Error).message || "Encryption failed.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o)
        if (!o) reset()
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Download keystore</DialogTitle>
          <DialogDescription>
            The wallet is encrypted with this password using the standard V3 keystore format. Save the
            password somewhere safe — losing it means losing access.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="ks-password">Password</Label>
            <Input
              id="ks-password"
              type="password"
              autoFocus
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="at least 8 characters"
              className="font-mono"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ks-confirm">Confirm</Label>
            <Input
              id="ks-confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="font-mono"
            />
          </div>

          {error ? <p className="font-mono text-xs text-destructive">{error}</p> : null}

          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Encrypting…" : "Download"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
