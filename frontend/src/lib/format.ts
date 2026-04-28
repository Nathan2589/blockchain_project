import { formatEther, isAddress } from "ethers"

export function truncateAddress(addr: string, lead = 6, tail = 4): string {
  if (!addr) return ""
  if (addr.length <= lead + tail + 1) return addr
  return `${addr.slice(0, lead)}…${addr.slice(-tail)}`
}

export function isValidAddress(addr: string): boolean {
  return isAddress(addr)
}

export function formatEth(wei: bigint, maxFractionDigits = 6): string {
  const raw = formatEther(wei)
  const [whole, frac = ""] = raw.split(".")
  if (!frac) return whole
  const trimmed = frac.slice(0, maxFractionDigits).replace(/0+$/, "")
  return trimmed ? `${whole}.${trimmed}` : whole
}

export function parseQuantity(input: string): bigint | null {
  const trimmed = input.trim()
  if (!trimmed || !/^\d+$/.test(trimmed)) return null
  try {
    const n = BigInt(trimmed)
    return n >= 0n ? n : null
  } catch {
    return null
  }
}

const AAP_REVERT_RE = /AAP: [a-z ]+/

export function decodeRevertReason(err: unknown): string {
  if (!err || typeof err !== "object") return "Transaction failed."
  const e = err as {
    reason?: string
    shortMessage?: string
    message?: string
    code?: string | number
  }
  if (e.code === "ACTION_REJECTED") return "Transaction rejected in wallet."
  if (e.reason && AAP_REVERT_RE.test(e.reason)) return e.reason
  const msg = e.shortMessage || e.message || ""
  const match = msg.match(AAP_REVERT_RE)
  if (match) return match[0]
  return e.shortMessage || e.message || "Transaction failed."
}
