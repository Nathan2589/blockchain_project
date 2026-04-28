import { BrowserProvider, type Eip1193Provider, type Signer } from "ethers"

import { CHAIN_ID, CHAIN_ID_HEX } from "@/lib/contract"

type InjectedProvider = Eip1193Provider & {
  on?: (event: string, handler: (...args: unknown[]) => void) => void
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void
}

declare global {
  interface Window {
    ethereum?: InjectedProvider
  }
}

export function getInjected(): InjectedProvider | undefined {
  if (typeof window === "undefined") return undefined
  return window.ethereum
}

export function hasInjected(): boolean {
  return Boolean(getInjected())
}

export type Connection = {
  provider: BrowserProvider
  signer: Signer
  address: string
  chainId: number
}

export async function connect(): Promise<Connection> {
  const inj = getInjected()
  if (!inj) {
    throw new Error("No injected wallet detected. Install MetaMask and try again.")
  }
  const provider = new BrowserProvider(inj, "any")
  const accounts = (await inj.request({ method: "eth_requestAccounts" })) as string[]
  const signer = await provider.getSigner()
  const chainHex = (await inj.request({ method: "eth_chainId" })) as string
  return {
    provider,
    signer,
    address: accounts[0],
    chainId: Number.parseInt(chainHex, 16),
  }
}

export async function switchToSepolia(): Promise<void> {
  const inj = getInjected()
  if (!inj) throw new Error("No injected wallet detected.")
  try {
    await inj.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: CHAIN_ID_HEX }],
    })
  } catch (err) {
    const code = (err as { code?: number }).code
    if (code === 4902) {
      await inj.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: CHAIN_ID_HEX,
            chainName: "Sepolia",
            nativeCurrency: { name: "Sepolia Ether", symbol: "SETH", decimals: 18 },
            rpcUrls: ["https://rpc.sepolia.org"],
            blockExplorerUrls: ["https://sepolia.etherscan.io"],
          },
        ],
      })
    } else {
      throw err
    }
  }
}

export function isSepolia(chainId: number): boolean {
  return chainId === CHAIN_ID
}

export function watchAccount(cb: (accounts: string[]) => void): () => void {
  const inj = getInjected()
  if (!inj?.on) return () => {}
  const wrapped = (...args: unknown[]) => cb(args[0] as string[])
  inj.on("accountsChanged", wrapped)
  return () => inj.removeListener?.("accountsChanged", wrapped)
}

export function watchChain(cb: (chainHex: string) => void): () => void {
  const inj = getInjected()
  if (!inj?.on) return () => {}
  const wrapped = (...args: unknown[]) => cb(args[0] as string)
  inj.on("chainChanged", wrapped)
  return () => inj.removeListener?.("chainChanged", wrapped)
}
