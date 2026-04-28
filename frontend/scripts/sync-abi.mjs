#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, "..", "..")
const artifactPath = resolve(repoRoot, "out/AgentAccessPass.sol/AgentAccessPass.json")
const deploymentPath = resolve(repoRoot, "deployments/sepolia.json")
const abiOutDir = resolve(here, "..", "src/abi")

const artifact = JSON.parse(readFileSync(artifactPath, "utf8"))
const deployment = JSON.parse(readFileSync(deploymentPath, "utf8"))

mkdirSync(abiOutDir, { recursive: true })

const abiOut = resolve(abiOutDir, "AgentAccessPass.json")
const deployOut = resolve(abiOutDir, "deployment.json")

writeFileSync(abiOut, JSON.stringify(artifact.abi, null, 2) + "\n")
writeFileSync(
  deployOut,
  JSON.stringify(
    {
      chainId: deployment.chainId,
      address: deployment.contracts.AgentAccessPass.address,
      deploymentBlock: deployment.contracts.AgentAccessPass.deployment.blockNumber,
      sourceCommit: deployment.contracts.AgentAccessPass.deployment.sourceCommit,
    },
    null,
    2,
  ) + "\n",
)

console.log("Synced from", repoRoot)
console.log("  abi    ->", abiOut)
console.log("  deploy ->", deployOut)
