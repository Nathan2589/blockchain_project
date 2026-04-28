import { Contract, JsonRpcProvider, type Signer } from "ethers"

import abi from "@/abi/AgentAccessPass.json"
import deployment from "@/abi/deployment.json"

export const CONTRACT_ADDRESS = deployment.address as `0x${string}`
export const CHAIN_ID: number = deployment.chainId
export const CHAIN_ID_HEX = `0x${CHAIN_ID.toString(16)}` as const

const RPC_URL = import.meta.env.VITE_SEPOLIA_RPC_URL as string | undefined

export class MissingRpcUrlError extends Error {
  constructor() {
    super(
      "VITE_SEPOLIA_RPC_URL is not configured. Copy .env.example to .env.local and fill it in.",
    )
    this.name = "MissingRpcUrlError"
  }
}

export function getReadProvider(): JsonRpcProvider {
  if (!RPC_URL) throw new MissingRpcUrlError()
  return new JsonRpcProvider(RPC_URL, CHAIN_ID, { staticNetwork: true })
}

export function getReadContract(): Contract {
  return new Contract(CONTRACT_ADDRESS, abi, getReadProvider())
}

export function getWriteContract(signer: Signer): Contract {
  return new Contract(CONTRACT_ADDRESS, abi, signer)
}

export const ETHERSCAN_BASE = "https://sepolia.etherscan.io"
export const txUrl = (hash: string) => `${ETHERSCAN_BASE}/tx/${hash}`
export const addressUrl = (addr: string) => `${ETHERSCAN_BASE}/address/${addr}`
