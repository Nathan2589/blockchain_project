import { Check, Copy } from "lucide-react"
import { useState } from "react"

import { truncateAddress } from "@/lib/format"
import { cn } from "@/lib/utils"

type Props = {
  address: string
  className?: string
  full?: boolean
}

export function AddressChip({ address, className, full = false }: Props) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {
      // Clipboard may be unavailable in non-secure contexts; ignore.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      title={address}
      className={cn(
        "group inline-flex items-center gap-2 rounded-sm border bg-card px-2 py-1 font-mono text-xs transition-colors hover:bg-accent",
        className,
      )}
    >
      <span>{full ? address : truncateAddress(address)}</span>
      {copied ? (
        <Check className="h-3 w-3 text-primary" aria-label="copied" />
      ) : (
        <Copy
          className="h-3 w-3 text-muted-foreground group-hover:text-foreground"
          aria-label="copy"
        />
      )}
    </button>
  )
}
